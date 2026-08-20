const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');
const commentService = require('../services/commentService');

const MANAGER_A_NO = '900801';
const MANAGER_A_EMAIL = 'comment.route.managerA.test@example.com';
const MANAGER_B_NO = '900802';
const MANAGER_B_EMAIL = 'comment.route.managerB.test@example.com';
const S1_NO = '900803';
const S1_EMAIL = 'comment.route.s1.test@example.com';
const S2_NO = '900804';
const S2_EMAIL = 'comment.route.s2.test@example.com';
const EMPLOYEE_NOS = [MANAGER_A_NO, MANAGER_B_NO, S1_NO, S2_NO];

const CUSTOMER_ID = 1; // 시드 거래처(id 1~3) 중 하나

async function cleanup() {
  // FK가 전부 RESTRICT이므로 comments -> sales_logs -> users 순서로 지운다.
  await pool.query(
    `DELETE FROM comments WHERE sales_log_id IN (
       SELECT id FROM sales_logs WHERE author_id IN (
         SELECT id FROM users WHERE employee_no = ANY($1)
       )
     )`,
    [EMPLOYEE_NOS]
  );
  await pool.query(
    `DELETE FROM sales_logs WHERE author_id IN (
       SELECT id FROM users WHERE employee_no = ANY($1)
     )`,
    [EMPLOYEE_NOS]
  );
  await pool.query('DELETE FROM users WHERE employee_no = ANY($1)', [EMPLOYEE_NOS]);
}

async function signupAndLogin({ employeeNo, email, role, managerEmail }) {
  const agent = request.agent(app);
  await agent.post('/api/auth/signup').send({ employeeNo, email, password: 'password1', role, managerEmail });
  await agent.post('/api/auth/login').send({ email, password: 'password1' });
  return agent;
}

async function userIdByEmail(email) {
  const row = (await pool.query('SELECT id FROM users WHERE email = $1', [email])).rows[0];
  return row.id;
}

let agentA; // 매니저 A (S1의 담당 팀장)
let agentB; // 매니저 B (S1의 담당 팀장이 아님)
let agentS1; // 영업사원 S1 (log의 작성자)
let agentS2; // 영업사원 S2 (S1과 무관)
let logId;

beforeEach(async () => {
  agentA = await signupAndLogin({ employeeNo: MANAGER_A_NO, email: MANAGER_A_EMAIL, role: 'manager' });
  agentB = await signupAndLogin({ employeeNo: MANAGER_B_NO, email: MANAGER_B_EMAIL, role: 'manager' });
  agentS1 = await signupAndLogin({
    employeeNo: S1_NO,
    email: S1_EMAIL,
    role: 'salesperson',
    managerEmail: MANAGER_A_EMAIL,
  });
  agentS2 = await signupAndLogin({
    employeeNo: S2_NO,
    email: S2_EMAIL,
    role: 'salesperson',
    managerEmail: MANAGER_B_EMAIL,
  });

  const [managerAId, s1Id, s2Id] = await Promise.all([
    userIdByEmail(MANAGER_A_EMAIL),
    userIdByEmail(S1_EMAIL),
    userIdByEmail(S2_EMAIL),
  ]);
  // RULE-ORG-005 백필 미구현 상태이므로 manager_id 매칭을 직접 시뮬레이션한다(BE-4/BE-7과 동일 패턴).
  await pool.query('UPDATE users SET manager_id = $1 WHERE id = $2', [managerAId, s1Id]);
  const managerBId = await userIdByEmail(MANAGER_B_EMAIL);
  await pool.query('UPDATE users SET manager_id = $1 WHERE id = $2', [managerBId, s2Id]);

  const createRes = await agentS1
    .post('/api/sales-logs')
    .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: 'S1의 영업일지' });
  logId = createRes.body.id;
});

afterEach(cleanup);

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe('POST /api/sales-logs/:id/comments', () => {
  test('로그인하지 않으면 401', async () => {
    const res = await request(app).post(`/api/sales-logs/${logId}/comments`).send({ content: '내용' });
    expect(res.status).toBe(401);
  });

  test('존재하지 않는 영업일지면 404', async () => {
    const res = await agentA.post('/api/sales-logs/9999999/comments').send({ content: '내용' });
    expect(res.status).toBe(404);
  });

  test('content가 없으면 400', async () => {
    const res = await agentA.post(`/api/sales-logs/${logId}/comments`).send({});
    expect(res.status).toBe(400);
  });

  test('content가 빈 문자열이면 400', async () => {
    const res = await agentA.post(`/api/sales-logs/${logId}/comments`).send({ content: '' });
    expect(res.status).toBe(400);
  });

  // 완료조건1: 팀장이 아닌 사용자가 코멘트 작성을 시도하면 403이 반환된다.
  // (S2는 팀장이 아니며, S1의 영업일지 작성자도 아니므로 어느 경로로도 권한이 없다)
  test('완료조건1: 팀장이 아닌 사용자(S2)가 다른 사람의 영업일지에 코멘트 작성을 시도하면 403', async () => {
    const res = await agentS2.post(`/api/sales-logs/${logId}/comments`).send({ content: '남의 일지 답변 시도' });
    expect(res.status).toBe(403);
  });

  // RULE-FEEDBACK-003: 담당 팀장이 아닌 팀장(B)의 코멘트 시도도 403.
  test('RULE-FEEDBACK-003: S1의 담당 팀장이 아닌 매니저 B가 코멘트를 시도하면 403', async () => {
    const res = await agentB.post(`/api/sales-logs/${logId}/comments`).send({ content: '남의 팀 코멘트' });
    expect(res.status).toBe(403);
  });

  // 완료조건2/6: 최초 코멘트는 팀장부터 — 코멘트가 하나도 없는 상태에서 작성자 본인의 답변 시도도 실패한다.
  test('완료조건2/6(RULE-REPLY-001): 코멘트가 하나도 없는 영업일지에 작성자 S1이 곧바로 답변을 시도하면 403', async () => {
    const res = await agentS1.post(`/api/sales-logs/${logId}/comments`).send({ content: '최초 답변 시도' });
    expect(res.status).toBe(403);
  });

  // 완료조건4: 팀장도 같은 영업일지에 여러 번 코멘트를 남길 수 있다(RULE-FEEDBACK-001/002).
  test('완료조건4: 담당 팀장 A는 같은 영업일지에 여러 번 코멘트를 남겨도 전부 201', async () => {
    const first = await agentA.post(`/api/sales-logs/${logId}/comments`).send({ content: '첫 코멘트' });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ content: '첫 코멘트', type: '팀장 코멘트' });

    const second = await agentA.post(`/api/sales-logs/${logId}/comments`).send({ content: '두번째 코멘트' });
    expect(second.status).toBe(201);
    expect(second.body).toMatchObject({ content: '두번째 코멘트', type: '팀장 코멘트' });
    expect(second.body.id).not.toBe(first.body.id);
  });

  // 완료조건3: 팀장 코멘트 등록 후 같은 영업사원이 여러 번 답변해도 전부 성공한다(RULE-REPLY-004).
  test('완료조건3: 팀장 코멘트 등록 후 작성자 S1이 여러 번 답변해도 전부 201', async () => {
    await agentA.post(`/api/sales-logs/${logId}/comments`).send({ content: '팀장 코멘트' });

    const reply1 = await agentS1.post(`/api/sales-logs/${logId}/comments`).send({ content: '답변1' });
    expect(reply1.status).toBe(201);
    expect(reply1.body.type).toBe('답변');

    const reply2 = await agentS1.post(`/api/sales-logs/${logId}/comments`).send({ content: '답변2' });
    expect(reply2.status).toBe(201);
    expect(reply2.body.type).toBe('답변');
  });

  test('POST 처리 중 예상치 못한 에러가 발생하면 500(에러 핸들러로 위임)', async () => {
    const spy = jest.spyOn(commentService, 'createComment').mockRejectedValueOnce(new Error('DB 오류'));
    const res = await agentA.post(`/api/sales-logs/${logId}/comments`).send({ content: '내용' });
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});

describe('GET /api/sales-logs/:id/comments', () => {
  test('로그인하지 않으면 401', async () => {
    const res = await request(app).get(`/api/sales-logs/${logId}/comments`);
    expect(res.status).toBe(401);
  });

  test('존재하지 않는 영업일지면 404', async () => {
    const res = await agentA.get('/api/sales-logs/9999999/comments');
    expect(res.status).toBe(404);
  });

  test('작성자 본인도 담당 팀장도 아니면(S2) 403', async () => {
    const res = await agentS2.get(`/api/sales-logs/${logId}/comments`);
    expect(res.status).toBe(403);
  });

  test('담당 팀장이 아닌 다른 팀장(B)이면 403', async () => {
    const res = await agentB.get(`/api/sales-logs/${logId}/comments`);
    expect(res.status).toBe(403);
  });

  // 스레드 조회: type이 등록 순서대로 '팀장 코멘트','팀장 코멘트','답변','답변'으로 정확히 매겨지는지 확인.
  test('스레드 조회 시 created_at 오름차순으로 정렬되고 type이 정확히 매겨진다', async () => {
    await agentA.post(`/api/sales-logs/${logId}/comments`).send({ content: '코멘트1' });
    await agentA.post(`/api/sales-logs/${logId}/comments`).send({ content: '코멘트2' });
    await agentS1.post(`/api/sales-logs/${logId}/comments`).send({ content: '답변1' });
    await agentS1.post(`/api/sales-logs/${logId}/comments`).send({ content: '답변2' });

    const resAsAuthor = await agentS1.get(`/api/sales-logs/${logId}/comments`);
    expect(resAsAuthor.status).toBe(200);
    expect(resAsAuthor.body.map((c) => c.type)).toEqual(['팀장 코멘트', '팀장 코멘트', '답변', '답변']);
    expect(resAsAuthor.body.map((c) => c.content)).toEqual(['코멘트1', '코멘트2', '답변1', '답변2']);
    resAsAuthor.body.forEach((c) => {
      expect(Object.keys(c).sort()).toEqual(['content', 'createdAt', 'id', 'type']);
    });

    const resAsManager = await agentA.get(`/api/sales-logs/${logId}/comments`);
    expect(resAsManager.status).toBe(200);
    expect(resAsManager.body).toEqual(resAsAuthor.body);
  });

  test('GET 처리 중 예상치 못한 에러가 발생하면 500(에러 핸들러로 위임)', async () => {
    const spy = jest.spyOn(commentService, 'listComments').mockRejectedValueOnce(new Error('DB 오류'));
    const res = await agentS1.get(`/api/sales-logs/${logId}/comments`);
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});
