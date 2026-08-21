const request = require('supertest');
const app = require('./app');
const pool = require('./db/pool');
const salesLogService = require('./services/salesLogService');
const commentService = require('./services/commentService');

afterAll(async () => {
  await pool.end();
});

describe('GET /health', () => {
  test('200과 status ok를 반환한다', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('존재하지 않는 라우트', () => {
  test('404를 반환한다', async () => {
    const res = await request(app).get('/no-such-route');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/managed/sales-logs', () => {
  const MANAGER_A_NO = '900501';
  const MANAGER_A_EMAIL = 'managed.managerA.test@example.com';
  const MANAGER_B_NO = '900502';
  const MANAGER_B_EMAIL = 'managed.managerB.test@example.com';
  const MANAGER_C_NO = '900503';
  const MANAGER_C_EMAIL = 'managed.managerC.test@example.com';
  const SALES_S1_NO = '900504';
  const SALES_S1_EMAIL = 'managed.s1.test@example.com';
  const SALES_S2_NO = '900505';
  const SALES_S2_EMAIL = 'managed.s2.test@example.com';
  const EMPLOYEE_NOS = [MANAGER_A_NO, MANAGER_B_NO, MANAGER_C_NO, SALES_S1_NO, SALES_S2_NO];

  const CUSTOMER_ID = 1; // 시드 거래처(id 1~3) 중 하나

  async function cleanup() {
    // FK가 RESTRICT이므로 sales_logs -> users 순서로 지운다.
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

  let agentA;
  let agentB;
  let agentC;
  let agentS1;
  let logS1Id;
  let logS2Id;

  beforeEach(async () => {
    agentA = await signupAndLogin({ employeeNo: MANAGER_A_NO, email: MANAGER_A_EMAIL, role: 'manager' });
    agentB = await signupAndLogin({ employeeNo: MANAGER_B_NO, email: MANAGER_B_EMAIL, role: 'manager' });
    agentC = await signupAndLogin({ employeeNo: MANAGER_C_NO, email: MANAGER_C_EMAIL, role: 'manager' });
    agentS1 = await signupAndLogin({
      employeeNo: SALES_S1_NO,
      email: SALES_S1_EMAIL,
      role: 'salesperson',
      managerEmail: MANAGER_A_EMAIL,
    });
    const agentS2 = await signupAndLogin({
      employeeNo: SALES_S2_NO,
      email: SALES_S2_EMAIL,
      role: 'salesperson',
      managerEmail: MANAGER_B_EMAIL,
    });

    const [managerAId, managerBId, s1Id, s2Id] = await Promise.all([
      userIdByEmail(MANAGER_A_EMAIL),
      userIdByEmail(MANAGER_B_EMAIL),
      userIdByEmail(SALES_S1_EMAIL),
      userIdByEmail(SALES_S2_EMAIL),
    ]);

    // BE-4 범위에는 RULE-ORG-005 백필이 없으므로 manager_id 매칭 완료 상태를 직접 시뮬레이션한다.
    await pool.query('UPDATE users SET manager_id = $1 WHERE id = $2', [managerAId, s1Id]);
    await pool.query('UPDATE users SET manager_id = $1 WHERE id = $2', [managerBId, s2Id]);

    const createS1 = await agentS1
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: 'S1의 영업일지' });
    logS1Id = createS1.body.id;
    const createS2 = await agentS2
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '내근', activityContent: 'S2의 영업일지' });
    logS2Id = createS2.body.id;
  });

  afterEach(cleanup);

  test('로그인하지 않으면 401', async () => {
    const res = await request(app).get('/api/managed/sales-logs');
    expect(res.status).toBe(401);
  });

  test('완료조건1: 팀장 계정으로 호출 시 자신에게 매핑된 영업사원(S1)의 일지만 반환되고 authorEmployeeNo가 포함된다', async () => {
    const res = await agentA.get('/api/managed/sales-logs');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: logS1Id,
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: 'S1의 영업일지',
      status: '작성 완료',
      authorEmployeeNo: SALES_S1_NO,
    });
  });

  test('완료조건2: 다른 팀장(B)에게 매핑된 영업사원(S2)의 일지는 팀장 A의 결과에 포함되지 않는다', async () => {
    const resA = await agentA.get('/api/managed/sales-logs');
    expect(resA.body.map((l) => l.id)).not.toContain(logS2Id);

    const resB = await agentB.get('/api/managed/sales-logs');
    expect(resB.status).toBe(200);
    expect(resB.body.map((l) => l.id)).toEqual([logS2Id]);
    expect(resB.body[0].authorEmployeeNo).toBe(SALES_S2_NO);
  });

  test('완료조건3: 영업사원 계정으로 호출하면 403', async () => {
    const res = await agentS1.get('/api/managed/sales-logs');
    expect(res.status).toBe(403);
  });

  test('매핑된 영업사원이 한 명도 없는 매니저는 빈 배열을 받는다(쿼리 생략 경로)', async () => {
    const res = await agentC.get('/api/managed/sales-logs');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('조회 중 예상치 못한 에러가 발생하면 500(에러 핸들러로 위임)', async () => {
    const spy = jest
      .spyOn(salesLogService, 'listManagedSalesLogs')
      .mockRejectedValueOnce(new Error('DB 오류'));
    const res = await agentA.get('/api/managed/sales-logs');
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});

describe('GET /api/managed/comments', () => {
  const MANAGER_A_NO = '900511';
  const MANAGER_A_EMAIL = 'managedcomments.managerA.test@example.com';
  const MANAGER_B_NO = '900512';
  const MANAGER_B_EMAIL = 'managedcomments.managerB.test@example.com';
  const SALES_S1_NO = '900513';
  const SALES_S1_EMAIL = 'managedcomments.s1.test@example.com';
  const SALES_S2_NO = '900514';
  const SALES_S2_EMAIL = 'managedcomments.s2.test@example.com';
  const EMPLOYEE_NOS = [MANAGER_A_NO, MANAGER_B_NO, SALES_S1_NO, SALES_S2_NO];

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

  let managerAgentA;
  let managerAgentB;
  let salesAgentS1;
  let logS1Id;
  let otherLogS1Id;

  beforeEach(async () => {
    managerAgentA = await signupAndLogin({ employeeNo: MANAGER_A_NO, email: MANAGER_A_EMAIL, role: 'manager' });
    managerAgentB = await signupAndLogin({ employeeNo: MANAGER_B_NO, email: MANAGER_B_EMAIL, role: 'manager' });
    salesAgentS1 = await signupAndLogin({
      employeeNo: SALES_S1_NO,
      email: SALES_S1_EMAIL,
      role: 'salesperson',
      managerEmail: MANAGER_A_EMAIL,
    });
    const salesAgentS2 = await signupAndLogin({
      employeeNo: SALES_S2_NO,
      email: SALES_S2_EMAIL,
      role: 'salesperson',
      managerEmail: MANAGER_B_EMAIL,
    });

    const [managerAId, managerBId, s1Id, s2Id] = await Promise.all([
      userIdByEmail(MANAGER_A_EMAIL),
      userIdByEmail(MANAGER_B_EMAIL),
      userIdByEmail(SALES_S1_EMAIL),
      userIdByEmail(SALES_S2_EMAIL),
    ]);
    // RULE-ORG-005 백필 미구현 상태이므로 manager_id 매칭을 직접 시뮬레이션한다(BE-4/BE-7과 동일 패턴).
    await pool.query('UPDATE users SET manager_id = $1 WHERE id = $2', [managerAId, s1Id]);
    await pool.query('UPDATE users SET manager_id = $1 WHERE id = $2', [managerBId, s2Id]);

    // RULE-FEEDBACK-003상 매니저는 자신이 담당하는 영업사원의 일지에만 코멘트를 남길 수 있으므로,
    // "매니저 A가 다른 영업일지에도 코멘트를 남긴" 시나리오는 S1이 작성한 두번째 일지로 구성한다.
    const createLog = await salesAgentS1
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: 'S1의 첫번째 일지' });
    logS1Id = createLog.body.id;
    const createOtherLog = await salesAgentS1
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '내근', activityContent: 'S1의 두번째 일지' });
    otherLogS1Id = createOtherLog.body.id;
    const createS2Log = await salesAgentS2
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: 'S2의 일지' });
    const logS2Id = createS2Log.body.id;

    // 매니저 A가 S1의 두 일지에 코멘트를 남긴다(RULE-FEEDBACK-001: 여러 건 가능).
    await managerAgentA.post(`/api/sales-logs/${logS1Id}/comments`).send({ content: 'A의 첫 코멘트' });
    await managerAgentA.post(`/api/sales-logs/${otherLogS1Id}/comments`).send({ content: 'A의 두번째 코멘트' });
    // 매니저 B가 자신이 담당하는 S2의 일지에 코멘트를 남긴다 — A의 이력에는 나오면 안 된다.
    await managerAgentB.post(`/api/sales-logs/${logS2Id}/comments`).send({ content: 'B의 코멘트' });
    // S1이 A의 코멘트에 답변한다 — 코멘트 작성자가 A가 아니므로 A의 이력에는 나오면 안 된다.
    await salesAgentS1.post(`/api/sales-logs/${logS1Id}/comments`).send({ content: 'S1의 답변' });
  });

  afterEach(cleanup);

  test('로그인하지 않으면 401', async () => {
    const res = await request(app).get('/api/managed/comments');
    expect(res.status).toBe(401);
  });

  test('영업사원 계정으로 호출하면 403', async () => {
    const res = await salesAgentS1.get('/api/managed/comments');
    expect(res.status).toBe(403);
  });

  // 완료조건5: 해당 팀장이 과거에 남긴 코멘트만 시간순(최신순)으로 반환된다.
  test('완료조건5: 매니저 A가 남긴 코멘트만, 최신순으로 반환되고 B의 코멘트/S1의 답변은 제외된다', async () => {
    const res = await managerAgentA.get('/api/managed/comments');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // 최신순(내림차순)이므로 나중에 작성한 "A의 두번째 코멘트"가 먼저 온다.
    expect(res.body.map((c) => c.content)).toEqual(['A의 두번째 코멘트', 'A의 첫 코멘트']);
    expect(res.body[0]).toMatchObject({
      salesLogId: otherLogS1Id,
      customerName: '교촌 치킨',
      authorEmployeeNo: SALES_S1_NO,
    });
    res.body.forEach((c) => {
      expect(Object.keys(c).sort()).toEqual(
        ['authorEmployeeNo', 'content', 'createdAt', 'customerName', 'id', 'salesLogId'].sort()
      );
    });
  });

  test('본인이 남긴 코멘트가 없는 팀장(B는 S2에게만 남김)은 자신이 남긴 것만 반환한다', async () => {
    const res = await managerAgentB.get('/api/managed/comments');
    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.content)).toEqual(['B의 코멘트']);
  });

  test('조회 중 예상치 못한 에러가 발생하면 500(에러 핸들러로 위임)', async () => {
    const spy = jest
      .spyOn(commentService, 'listManagedComments')
      .mockRejectedValueOnce(new Error('DB 오류'));
    const res = await managerAgentA.get('/api/managed/comments');
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});
