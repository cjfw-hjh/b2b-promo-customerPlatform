const express = require('express');
const request = require('supertest');
const session = require('../config/session');
const authRoutes = require('./authRoutes');
const { requireAuth } = require('../middleware/auth');
const errorHandler = require('../middleware/errorHandler');
const pool = require('../db/pool');

// 로그인 후 세션이 실제로 생성/제거되는지 확인하기 위한 테스트 전용 보호 라우트.
// 프로덕션 app.js에는 추가하지 않는다.
function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(session);
  app.use('/api/auth', authRoutes);
  app.get('/__test/protected', requireAuth, (req, res) => {
    res.sendStatus(200);
  });
  app.use(errorHandler);
  return app;
}

const TEST_EMPLOYEE_NO = '900011';
const TEST_EMAIL = 'route.sales.test@example.com';
const TEST_MANAGER_EMAIL = 'route.manager.test@example.com';

async function cleanup() {
  await pool.query('DELETE FROM users WHERE employee_no = $1 OR email = $1 OR email = $2', [
    TEST_EMPLOYEE_NO,
    TEST_EMAIL,
  ]);
}

let app;

beforeAll(() => {
  app = buildTestApp();
});

afterEach(cleanup);

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe('POST /api/auth/signup', () => {
  test('정상 입력값으로 가입 성공 시 201과 password_hash 없는 응답을 반환한다', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      employeeNo: TEST_EMPLOYEE_NO,
      email: TEST_EMAIL,
      password: 'password1',
      role: 'salesperson',
      managerEmail: TEST_MANAGER_EMAIL,
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      employeeNo: TEST_EMPLOYEE_NO,
      email: TEST_EMAIL,
      role: 'salesperson',
    });
    expect(res.body.password_hash).toBeUndefined();
  });

  test('사번이 6자리가 아니면 400', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      employeeNo: '12345',
      email: TEST_EMAIL,
      password: 'password1',
      role: 'salesperson',
      managerEmail: TEST_MANAGER_EMAIL,
    });
    expect(res.status).toBe(400);
  });

  test('이메일 형식이 잘못되면 400', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      employeeNo: TEST_EMPLOYEE_NO,
      email: 'bad-email',
      password: 'password1',
      role: 'salesperson',
      managerEmail: TEST_MANAGER_EMAIL,
    });
    expect(res.status).toBe(400);
  });

  test('비밀번호가 7자리 미만이면 400', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      employeeNo: TEST_EMPLOYEE_NO,
      email: TEST_EMAIL,
      password: '123456',
      role: 'salesperson',
      managerEmail: TEST_MANAGER_EMAIL,
    });
    expect(res.status).toBe(400);
  });

  test('동일 사번/이메일로 재가입 시도 시 400', async () => {
    await request(app).post('/api/auth/signup').send({
      employeeNo: TEST_EMPLOYEE_NO,
      email: TEST_EMAIL,
      password: 'password1',
      role: 'salesperson',
      managerEmail: TEST_MANAGER_EMAIL,
    });

    const res = await request(app).post('/api/auth/signup').send({
      employeeNo: TEST_EMPLOYEE_NO,
      email: TEST_EMAIL,
      password: 'password1',
      role: 'salesperson',
      managerEmail: TEST_MANAGER_EMAIL,
    });
    expect(res.status).toBe(400);
  });

  test('영업사원 가입 시 managerEmail 누락이면 400', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      employeeNo: TEST_EMPLOYEE_NO,
      email: TEST_EMAIL,
      password: 'password1',
      role: 'salesperson',
    });
    expect(res.status).toBe(400);
  });

  test('팀장 가입 시 managerEmail을 보내도 DB에는 NULL로 저장된다', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      employeeNo: TEST_EMPLOYEE_NO,
      email: TEST_EMAIL,
      password: 'password1',
      role: 'manager',
      managerEmail: TEST_MANAGER_EMAIL,
    });
    expect(res.status).toBe(201);

    const row = (await pool.query('SELECT manager_email FROM users WHERE id = $1', [res.body.id]))
      .rows[0];
    expect(row.manager_email).toBeNull();
  });
});

describe('로그인/로그아웃 및 세션', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/signup').send({
      employeeNo: TEST_EMPLOYEE_NO,
      email: TEST_EMAIL,
      password: 'password1',
      role: 'salesperson',
      managerEmail: TEST_MANAGER_EMAIL,
    });
  });

  test('로그인 실패: 존재하지 않는 이메일이면 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-such-user@example.com', password: 'password1' });
    expect(res.status).toBe(401);
  });

  test('로그인 실패: 비밀번호가 틀리면 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('로그인 성공 시 세션이 생성되고, 로그아웃 시 즉시 제거된다', async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: 'password1' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toEqual({ id: expect.any(Number), role: 'salesperson' });

    const userId = String(loginRes.body.id);
    const foundBefore = await pool.query("SELECT 1 FROM session WHERE sess->>'userId' = $1", [
      userId,
    ]);
    expect(foundBefore.rowCount).toBe(1);

    const protectedRes = await agent.get('/__test/protected');
    expect(protectedRes.status).toBe(200);

    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(204);

    const protectedAfterLogout = await agent.get('/__test/protected');
    expect(protectedAfterLogout.status).toBe(401);

    const foundAfter = await pool.query("SELECT 1 FROM session WHERE sess->>'userId' = $1", [
      userId,
    ]);
    expect(foundAfter.rowCount).toBe(0);
  });

  test('로그인하지 않은 상태로 로그아웃을 호출해도 204를 반환한다', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
  });
});

describe('GET /api/auth/me', () => {
  test('로그인하지 않은 상태로 호출하면 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('로그인한 상태로 호출하면 세션의 id/role을 반환한다', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      employeeNo: TEST_EMPLOYEE_NO,
      email: TEST_EMAIL,
      password: 'password1',
      role: 'salesperson',
      managerEmail: TEST_MANAGER_EMAIL,
    });
    const loginRes = await agent
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: 'password1' });

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: loginRes.body.id, role: 'salesperson' });
  });
});
