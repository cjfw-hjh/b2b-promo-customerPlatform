const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');
const salesLogService = require('../services/salesLogService');

const SALES_EMPLOYEE_NO = '900401';
const SALES_EMAIL = 'saleslog.route.sales.test@example.com';
const OTHER_SALES_EMPLOYEE_NO = '900402';
const OTHER_SALES_EMAIL = 'saleslog.route.other.test@example.com';
const MANAGER_EMPLOYEE_NO = '900403';
const MANAGER_EMAIL = 'saleslog.route.manager.test@example.com';
const OTHER_MANAGER_EMPLOYEE_NO = '900404';
const OTHER_MANAGER_EMAIL = 'saleslog.route.othermanager.test@example.com';
const TEAM_LEAD_EMAIL = 'saleslog.route.teamlead.test@example.com'; // 실제 가입되지 않는, managerEmail 필드용 값

const CUSTOMER_ID = 1; // 시드 거래처(id 1~3) 중 하나

async function cleanup() {
  const employeeNos = [
    SALES_EMPLOYEE_NO,
    OTHER_SALES_EMPLOYEE_NO,
    MANAGER_EMPLOYEE_NO,
    OTHER_MANAGER_EMPLOYEE_NO,
  ];
  await pool.query(
    `DELETE FROM comments WHERE sales_log_id IN (
       SELECT id FROM sales_logs WHERE author_id IN (
         SELECT id FROM users WHERE employee_no = ANY($1)
       )
     )`,
    [employeeNos]
  );
  await pool.query(
    `DELETE FROM sales_logs WHERE author_id IN (
       SELECT id FROM users WHERE employee_no = ANY($1)
     )`,
    [employeeNos]
  );
  await pool.query('DELETE FROM users WHERE employee_no = ANY($1)', [employeeNos]);
}

afterEach(cleanup);

afterAll(async () => {
  await cleanup();
  await pool.end();
});

// 실제 /api/auth/signup + /login을 거쳐 인증한다(BE-3/BE-5와 같은 컨벤션).
async function signupAndLogin(agent, { employeeNo, email, role, managerEmail }) {
  await request(app).post('/api/auth/signup').send({
    employeeNo,
    email,
    password: 'password1',
    role,
    managerEmail,
  });
  await agent.post('/api/auth/login').send({ email, password: 'password1' });
}

describe('POST /api/sales-logs', () => {
  test('로그인하지 않으면 401', async () => {
    const res = await request(app)
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: '내용' });
    expect(res.status).toBe(401);
  });

  test('UC-003: 영업사원이 아니면(팀장 계정) 403', async () => {
    const agent = request.agent(app);
    await signupAndLogin(agent, {
      employeeNo: MANAGER_EMPLOYEE_NO,
      email: MANAGER_EMAIL,
      role: 'manager',
    });

    const res = await agent
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: '내용' });
    expect(res.status).toBe(403);
  });

  test('영업사원이 정상 입력으로 작성하면 201과 함께 상태값 "작성 완료"를 반환한다', async () => {
    const agent = request.agent(app);
    await signupAndLogin(agent, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });

    const res = await agent
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: '거래처 방문' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '거래처 방문',
      summary: null,
      createdAt: expect.any(String),
      status: '작성 완료',
    });
  });

  test('RULE-LOG-001: 요청 바디에 createdAt을 실어보내도 서버 시간으로만 기록되고 덮어써지지 않는다', async () => {
    const agent = request.agent(app);
    await signupAndLogin(agent, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });

    const spoofedDate = '2000-01-01T00:00:00.000Z';
    const before = Date.now();
    const res = await agent.post('/api/sales-logs').send({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '내용',
      createdAt: spoofedDate,
    });

    expect(res.status).toBe(201);
    expect(res.body.createdAt).not.toBe(spoofedDate);
    const createdAtMs = new Date(res.body.createdAt).getTime();
    expect(createdAtMs).toBeGreaterThanOrEqual(before);
    // DB가 원격(Supabase)이라 테스트 러너와 시계가 완전히 일치하지 않는다 — 약간의 여유를 둔다.
    expect(createdAtMs).toBeLessThanOrEqual(Date.now() + 5000);
  });

  test("activityType이 '외근'/'내근'/'기타'가 아니면 400", async () => {
    const agent = request.agent(app);
    await signupAndLogin(agent, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });

    const res = await agent
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '전화', activityContent: '내용' });
    expect(res.status).toBe(400);
  });

  test('activityContent가 없으면 400', async () => {
    const agent = request.agent(app);
    await signupAndLogin(agent, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });

    const res = await agent
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/sales-logs, GET /api/sales-logs/:id', () => {
  test('로그인하지 않으면 401', async () => {
    const res = await request(app).get('/api/sales-logs');
    expect(res.status).toBe(401);
  });

  test('본인이 작성한 영업일지만 목록에 포함되고, 다른 사람의 로그는 상세 조회 시 403이다', async () => {
    const agentA = request.agent(app);
    await signupAndLogin(agentA, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });
    const createRes = await agentA
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: 'A의 일지' });
    const logId = createRes.body.id;

    const agentB = request.agent(app);
    await signupAndLogin(agentB, {
      employeeNo: OTHER_SALES_EMPLOYEE_NO,
      email: OTHER_SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });

    const listA = await agentA.get('/api/sales-logs');
    expect(listA.status).toBe(200);
    expect(listA.body.map((l) => l.id)).toContain(logId);

    const listB = await agentB.get('/api/sales-logs');
    expect(listB.status).toBe(200);
    expect(listB.body.map((l) => l.id)).not.toContain(logId);

    const detailA = await agentA.get(`/api/sales-logs/${logId}`);
    expect(detailA.status).toBe(200);
    expect(detailA.body.status).toBe('작성 완료');

    const detailB = await agentB.get(`/api/sales-logs/${logId}`);
    expect(detailB.status).toBe(403);
  });

  test('FE-7: 담당 팀장은 소속 영업사원의 영업일지를 상세 조회할 수 있다', async () => {
    const salesAgent = request.agent(app);
    await signupAndLogin(salesAgent, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: MANAGER_EMAIL,
    });
    const createRes = await salesAgent
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: '영업사원의 일지' });
    const logId = createRes.body.id;

    const managerAgent = request.agent(app);
    await signupAndLogin(managerAgent, {
      employeeNo: MANAGER_EMPLOYEE_NO,
      email: MANAGER_EMAIL,
      role: 'manager',
    });

    const res = await managerAgent.get(`/api/sales-logs/${logId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(logId);
  });

  test('FE-7: 담당 팀장이 아닌 다른 팀장이 조회하면 403', async () => {
    const salesAgent = request.agent(app);
    await signupAndLogin(salesAgent, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: MANAGER_EMAIL,
    });
    const createRes = await salesAgent
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: '영업사원의 일지' });
    const logId = createRes.body.id;

    const otherManagerAgent = request.agent(app);
    await signupAndLogin(otherManagerAgent, {
      employeeNo: OTHER_MANAGER_EMPLOYEE_NO,
      email: OTHER_MANAGER_EMAIL,
      role: 'manager',
    });

    const res = await otherManagerAgent.get(`/api/sales-logs/${logId}`);
    expect(res.status).toBe(403);
  });

  test('존재하지 않는 id를 조회하면 404', async () => {
    const agent = request.agent(app);
    await signupAndLogin(agent, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });

    const res = await agent.get('/api/sales-logs/9999999');
    expect(res.status).toBe(404);
  });

  test('목록 조회 중 예상치 못한 에러가 발생하면 500(에러 핸들러로 위임)', async () => {
    const agent = request.agent(app);
    await signupAndLogin(agent, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });

    const spy = jest
      .spyOn(salesLogService, 'listMySalesLogs')
      .mockRejectedValueOnce(new Error('DB 오류'));
    const res = await agent.get('/api/sales-logs');
    expect(res.status).toBe(500);
    spy.mockRestore();
  });

  // BE-10: GET /api/sales-logs 검색 쿼리파라미터(도메인 정의서 13.1 / 6-wireframe.md SalesLogListPage).
  test('BE-10: activityType/customerId/keyword 쿼리파라미터로 필터링되고, RULE-SEARCH-001에 따라 타인 일지는 절대 섞이지 않는다', async () => {
    const agentA = request.agent(app);
    await signupAndLogin(agentA, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });
    const log1 = await agentA
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: '알파 거래처 방문' });
    const log2 = await agentA
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '내근', activityContent: '베타 서류 작성' });

    const agentB = request.agent(app);
    await signupAndLogin(agentB, {
      employeeNo: OTHER_SALES_EMPLOYEE_NO,
      email: OTHER_SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });
    // A의 log1과 조건(거래처/형태/키워드)이 완전히 같은 B의 일지 - author_id 필터가 항상 유지되는지 검증용.
    await agentB
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: '알파 거래처 방문' });

    const noFilter = await agentA.get('/api/sales-logs');
    expect(noFilter.status).toBe(200);
    expect(noFilter.body.map((l) => l.id).sort((a, b) => a - b)).toEqual(
      [log1.body.id, log2.body.id].sort((a, b) => a - b)
    );

    const byActivityType = await agentA.get('/api/sales-logs').query({ activityType: '내근' });
    expect(byActivityType.status).toBe(200);
    expect(byActivityType.body.map((l) => l.id)).toEqual([log2.body.id]);

    // customerId + keyword 조합(AND) — B에게도 동일 조건의 일지가 있지만 A의 결과에는 A의 log1만 나와야 한다.
    const combined = await agentA
      .get('/api/sales-logs')
      .query({ customerId: CUSTOMER_ID, keyword: '알파' });
    expect(combined.status).toBe(200);
    expect(combined.body.map((l) => l.id)).toEqual([log1.body.id]);

    // 존재하지 않는 activityType 값 - 400이 아니라 빈 결과.
    const invalidType = await agentA.get('/api/sales-logs').query({ activityType: '전화' });
    expect(invalidType.status).toBe(200);
    expect(invalidType.body).toEqual([]);
  });
});

describe('PATCH /api/sales-logs/:id', () => {
  test('RULE-LOG-002: 작성자가 아니면 403', async () => {
    const agentA = request.agent(app);
    await signupAndLogin(agentA, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });
    const createRes = await agentA
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: '원본' });

    const agentB = request.agent(app);
    await signupAndLogin(agentB, {
      employeeNo: OTHER_SALES_EMPLOYEE_NO,
      email: OTHER_SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });

    const res = await agentB
      .patch(`/api/sales-logs/${createRes.body.id}`)
      .send({ activityContent: '변조 시도' });
    expect(res.status).toBe(403);
  });

  test('RULE-LOG-004/005: 코멘트가 있어도 작성자 본인의 수정은 성공하고 created_at은 유지된다', async () => {
    const agent = request.agent(app);
    await signupAndLogin(agent, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });
    const createRes = await agent
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: '원본 내용' });
    const logId = createRes.body.id;

    // 코멘트 작성 API는 아직 없으므로(BE-8 범위) comments 테이블에 직접 INSERT한다.
    const userRow = (await pool.query('SELECT id FROM users WHERE email = $1', [SALES_EMAIL])).rows[0];
    await pool.query('INSERT INTO comments (sales_log_id, author_id, content) VALUES ($1, $2, $3)', [
      logId,
      userRow.id,
      '팀장 코멘트',
    ]);

    const res = await agent.patch(`/api/sales-logs/${logId}`).send({ activityContent: '수정된 내용' });
    expect(res.status).toBe(200);
    expect(res.body.activityContent).toBe('수정된 내용');
    expect(res.body.createdAt).toBe(createRes.body.createdAt);
    expect(res.body.status).toBe('코멘트 진행중');
  });

  test('존재하지 않는 id를 수정하려 하면 404', async () => {
    const agent = request.agent(app);
    await signupAndLogin(agent, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });

    const res = await agent.patch('/api/sales-logs/9999999').send({ activityContent: '수정' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/sales-logs/:id', () => {
  test('RULE-LOG-003: 작성자가 아니면 403', async () => {
    const agentA = request.agent(app);
    await signupAndLogin(agentA, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });
    const createRes = await agentA
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: '원본' });

    const agentB = request.agent(app);
    await signupAndLogin(agentB, {
      employeeNo: OTHER_SALES_EMPLOYEE_NO,
      email: OTHER_SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });

    const res = await agentB.delete(`/api/sales-logs/${createRes.body.id}`);
    expect(res.status).toBe(403);
  });

  test('RULE-LOG-005: 코멘트가 1건이라도 있으면 작성자 본인이 삭제를 시도해도 403', async () => {
    const agent = request.agent(app);
    await signupAndLogin(agent, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });
    const createRes = await agent
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: '원본' });
    const logId = createRes.body.id;

    const userRow = (await pool.query('SELECT id FROM users WHERE email = $1', [SALES_EMAIL])).rows[0];
    await pool.query('INSERT INTO comments (sales_log_id, author_id, content) VALUES ($1, $2, $3)', [
      logId,
      userRow.id,
      '코멘트',
    ]);

    const res = await agent.delete(`/api/sales-logs/${logId}`);
    expect(res.status).toBe(403);
  });

  test('존재하지 않는 id를 삭제하려 하면 404', async () => {
    const agent = request.agent(app);
    await signupAndLogin(agent, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });

    const res = await agent.delete('/api/sales-logs/9999999');
    expect(res.status).toBe(404);
  });

  test('코멘트가 없고 작성자 본인이면 204와 함께 실제로 삭제된다', async () => {
    const agent = request.agent(app);
    await signupAndLogin(agent, {
      employeeNo: SALES_EMPLOYEE_NO,
      email: SALES_EMAIL,
      role: 'salesperson',
      managerEmail: TEAM_LEAD_EMAIL,
    });
    const createRes = await agent
      .post('/api/sales-logs')
      .send({ customerId: CUSTOMER_ID, activityType: '외근', activityContent: '원본' });
    const logId = createRes.body.id;

    const res = await agent.delete(`/api/sales-logs/${logId}`);
    expect(res.status).toBe(204);

    const row = (await pool.query('SELECT 1 FROM sales_logs WHERE id = $1', [logId])).rows[0];
    expect(row).toBeUndefined();
  });
});
