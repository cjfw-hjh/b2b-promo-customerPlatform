const request = require('supertest');
const app = require('../app');
const authService = require('../services/authService');
const customerService = require('../services/customerService');
const salesLogService = require('../services/salesLogService');
const commentService = require('../services/commentService');
const pool = require('../db/pool');

const TEST_EMPLOYEE_NO = '900201';
const TEST_EMAIL = 'customer.route.test@example.com';
const TEST_MANAGER_EMAIL = 'customer.route.manager.test@example.com';

async function cleanup() {
  await pool.query('DELETE FROM users WHERE employee_no = $1 OR email = $1', [TEST_EMPLOYEE_NO]);
}

afterEach(cleanup);

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe('GET /api/customers', () => {
  test('로그인하지 않으면 401', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
  });

  test('로그인 후 호출하면 200과 함께 시드된 거래처가 포함된 배열을 반환한다', async () => {
    await authService.signup({
      employeeNo: TEST_EMPLOYEE_NO,
      email: TEST_EMAIL,
      password: 'password1',
      role: 'salesperson',
      managerEmail: TEST_MANAGER_EMAIL,
    });

    const agent = request.agent(app);
    const loginRes = await agent
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: 'password1' });
    expect(loginRes.status).toBe(200);

    const res = await agent.get('/api/customers');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const names = res.body.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['테스트거래처1', '테스트거래처2', '테스트거래처3']));

    // 응답 필드는 id, name만 있어야 한다(RULE-CUSTOMER-003: 최소 컬럼 구성).
    res.body.forEach((customer) => {
      expect(Object.keys(customer).sort()).toEqual(['id', 'name']);
    });
  });

  test('서비스 조회 중 에러가 발생하면 500(에러 핸들러로 위임)', async () => {
    await authService.signup({
      employeeNo: TEST_EMPLOYEE_NO,
      email: TEST_EMAIL,
      password: 'password1',
      role: 'salesperson',
      managerEmail: TEST_MANAGER_EMAIL,
    });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: TEST_EMAIL, password: 'password1' });

    const spy = jest.spyOn(customerService, 'listCustomers').mockRejectedValueOnce(new Error('DB 오류'));
    const res = await agent.get('/api/customers');
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});

describe('RULE-CUSTOMER-003: 거래처 등록/수정 라우트는 존재하지 않는다', () => {
  test('POST /api/customers는 404를 반환한다(등록 라우트 없음)', async () => {
    const res = await request(app).post('/api/customers').send({ name: '신규거래처' });
    expect(res.status).toBe(404);
  });
});

// BE-11 / RULE-KNOWHOW-001~006: 거래처 노하우(같은 팀장 산하 그룹의 영업활동 이력) 조회.
describe('GET /api/customers/:id/knowhow', () => {
  const CUSTOMER_ID = 1; // 시드 거래처(id 1~3) 중 하나
  const MANAGER_A_EMPLOYEE_NO = '900901';
  const MANAGER_A_EMAIL = 'customer.knowhow.managerA.test@example.com';
  const MANAGER_B_EMPLOYEE_NO = '900902';
  const MANAGER_B_EMAIL = 'customer.knowhow.managerB.test@example.com';
  const S1_EMPLOYEE_NO = '900903';
  const S1_EMAIL = 'customer.knowhow.s1.test@example.com';
  const S2_EMPLOYEE_NO = '900904';
  const S2_EMAIL = 'customer.knowhow.s2.test@example.com';
  const S3_EMPLOYEE_NO = '900905';
  const S3_EMAIL = 'customer.knowhow.s3.test@example.com';
  const KNOWHOW_EMPLOYEE_NOS = [
    MANAGER_A_EMPLOYEE_NO,
    MANAGER_B_EMPLOYEE_NO,
    S1_EMPLOYEE_NO,
    S2_EMPLOYEE_NO,
    S3_EMPLOYEE_NO,
  ];

  async function knowhowCleanup() {
    await pool.query(
      `DELETE FROM comments WHERE sales_log_id IN (
         SELECT id FROM sales_logs WHERE author_id IN (
           SELECT id FROM users WHERE employee_no = ANY($1)
         )
       )`,
      [KNOWHOW_EMPLOYEE_NOS]
    );
    await pool.query(
      `DELETE FROM sales_logs WHERE author_id IN (
         SELECT id FROM users WHERE employee_no = ANY($1)
       )`,
      [KNOWHOW_EMPLOYEE_NOS]
    );
    await pool.query('DELETE FROM users WHERE employee_no = ANY($1)', [KNOWHOW_EMPLOYEE_NOS]);
  }

  afterEach(knowhowCleanup);

  async function loginAgent(email) {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password: 'password1' });
    return agent;
  }

  test('로그인하지 않으면 401', async () => {
    const res = await request(app).get(`/api/customers/${CUSTOMER_ID}/knowhow`);
    expect(res.status).toBe(401);
  });

  test('존재하지 않는 거래처면 404', async () => {
    await authService.signup({
      employeeNo: MANAGER_A_EMPLOYEE_NO,
      email: MANAGER_A_EMAIL,
      password: 'password1',
      role: 'manager',
    });
    const agent = await loginAgent(MANAGER_A_EMAIL);

    const res = await agent.get('/api/customers/9999999/knowhow');
    expect(res.status).toBe(404);
  });

  test('RULE-KNOWHOW-006: 조회자와 같은 팀장 산하 그룹의 활동만 포함되고, 다른 팀장에게 매핑된 영업사원의 활동은 제외된다', async () => {
    const managerA = await authService.signup({
      employeeNo: MANAGER_A_EMPLOYEE_NO,
      email: MANAGER_A_EMAIL,
      password: 'password1',
      role: 'manager',
    });
    const managerB = await authService.signup({
      employeeNo: MANAGER_B_EMPLOYEE_NO,
      email: MANAGER_B_EMAIL,
      password: 'password1',
      role: 'manager',
    });
    const s1 = await authService.signup({
      employeeNo: S1_EMPLOYEE_NO,
      email: S1_EMAIL,
      password: 'password1',
      role: 'salesperson',
      managerEmail: MANAGER_A_EMAIL,
    });
    const s2 = await authService.signup({
      employeeNo: S2_EMPLOYEE_NO,
      email: S2_EMAIL,
      password: 'password1',
      role: 'salesperson',
      managerEmail: MANAGER_B_EMAIL,
    });
    const s3 = await authService.signup({
      employeeNo: S3_EMPLOYEE_NO,
      email: S3_EMAIL,
      password: 'password1',
      role: 'salesperson',
      managerEmail: MANAGER_A_EMAIL,
    });
    // BE-4/7/8 테스트와 같은 패턴 — RULE-ORG-005 백필 대신 직접 UPDATE로 매칭한다.
    await pool.query('UPDATE users SET manager_id = $1 WHERE id = $2', [managerA.id, s1.id]);
    await pool.query('UPDATE users SET manager_id = $1 WHERE id = $2', [managerB.id, s2.id]);
    await pool.query('UPDATE users SET manager_id = $1 WHERE id = $2', [managerA.id, s3.id]);

    await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: 'S1 활동',
      authorId: s1.id,
    });
    await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: 'S2 활동',
      authorId: s2.id,
    });
    await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: 'S3 활동',
      authorId: s3.id,
    });

    const agentManagerA = await loginAgent(MANAGER_A_EMAIL);
    const managerRes = await agentManagerA.get(`/api/customers/${CUSTOMER_ID}/knowhow`);
    expect(managerRes.status).toBe(200);
    expect(managerRes.body.map((r) => r.authorEmployeeNo).sort()).toEqual(
      [S1_EMPLOYEE_NO, S3_EMPLOYEE_NO].sort()
    );

    const agentS1 = await loginAgent(S1_EMAIL);
    const s1Res = await agentS1.get(`/api/customers/${CUSTOMER_ID}/knowhow`);
    expect(s1Res.status).toBe(200);
    expect(s1Res.body.map((r) => r.authorEmployeeNo).sort()).toEqual(
      [S1_EMPLOYEE_NO, S3_EMPLOYEE_NO].sort()
    );
  });

  test('완료조건: 응답에 코멘트/답변 데이터가 전혀 포함되지 않는다', async () => {
    const managerA = await authService.signup({
      employeeNo: MANAGER_A_EMPLOYEE_NO,
      email: MANAGER_A_EMAIL,
      password: 'password1',
      role: 'manager',
    });
    const s1 = await authService.signup({
      employeeNo: S1_EMPLOYEE_NO,
      email: S1_EMAIL,
      password: 'password1',
      role: 'salesperson',
      managerEmail: MANAGER_A_EMAIL,
    });
    await pool.query('UPDATE users SET manager_id = $1 WHERE id = $2', [managerA.id, s1.id]);

    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '코멘트 달릴 활동',
      authorId: s1.id,
    });
    await commentService.createComment(log.id, managerA.id, 'manager', '팀장 코멘트 내용');

    const agent = await loginAgent(S1_EMAIL);
    const res = await agent.get(`/api/customers/${CUSTOMER_ID}/knowhow`);
    expect(res.status).toBe(200);

    const entry = res.body.find((r) => r.activityContent === '코멘트 달릴 활동');
    expect(entry).toBeDefined();
    // 필드는 authorEmployeeNo/createdAt/activityContent 셋뿐이어야 한다(RULE-KNOWHOW-004, 와이어프레임).
    expect(Object.keys(entry).sort()).toEqual(['activityContent', 'authorEmployeeNo', 'createdAt']);
    expect(JSON.stringify(res.body)).not.toContain('팀장 코멘트 내용');
  });

  test('완료조건: 삭제된 영업일지는 결과에서 제외된다', async () => {
    const managerA = await authService.signup({
      employeeNo: MANAGER_A_EMPLOYEE_NO,
      email: MANAGER_A_EMAIL,
      password: 'password1',
      role: 'manager',
    });
    const s1 = await authService.signup({
      employeeNo: S1_EMPLOYEE_NO,
      email: S1_EMAIL,
      password: 'password1',
      role: 'salesperson',
      managerEmail: MANAGER_A_EMAIL,
    });
    await pool.query('UPDATE users SET manager_id = $1 WHERE id = $2', [managerA.id, s1.id]);

    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '삭제될 활동',
      authorId: s1.id,
    });
    await salesLogService.deleteSalesLog(log.id, s1.id);

    const agent = await loginAgent(S1_EMAIL);
    const res = await agent.get(`/api/customers/${CUSTOMER_ID}/knowhow`);
    expect(res.status).toBe(200);
    expect(res.body.map((r) => r.activityContent)).not.toContain('삭제될 활동');
  });

  test('created_at 오름차순(시간순)으로 정렬된다', async () => {
    const managerA = await authService.signup({
      employeeNo: MANAGER_A_EMPLOYEE_NO,
      email: MANAGER_A_EMAIL,
      password: 'password1',
      role: 'manager',
    });
    const s1 = await authService.signup({
      employeeNo: S1_EMPLOYEE_NO,
      email: S1_EMAIL,
      password: 'password1',
      role: 'salesperson',
      managerEmail: MANAGER_A_EMAIL,
    });
    await pool.query('UPDATE users SET manager_id = $1 WHERE id = $2', [managerA.id, s1.id]);

    await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '먼저 쓴 활동',
      authorId: s1.id,
    });
    await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '나중에 쓴 활동',
      authorId: s1.id,
    });

    const agent = await loginAgent(S1_EMAIL);
    const res = await agent.get(`/api/customers/${CUSTOMER_ID}/knowhow`);
    expect(res.status).toBe(200);

    const firstIdx = res.body.findIndex((r) => r.activityContent === '먼저 쓴 활동');
    const secondIdx = res.body.findIndex((r) => r.activityContent === '나중에 쓴 활동');
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });
});
