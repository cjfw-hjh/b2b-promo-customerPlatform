const express = require('express');
const request = require('supertest');
const session = require('./session');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

// BE-3에서 실제 로그인 API가 생기기 전까지, 세션/인증 미들웨어 자체를 검증하기 위한
// 테스트 전용 라우트. 프로덕션 app.js에는 추가하지 않는다.
function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(session);

  app.post('/__test/login', (req, res) => {
    req.session.userId = 'u1';
    req.session.role = req.body.role;
    res.sendStatus(200);
  });

  app.get('/__test/protected', requireAuth, (req, res) => {
    res.sendStatus(200);
  });

  app.get('/__test/manager-only', requireAuth, requireRole('manager'), (req, res) => {
    res.sendStatus(200);
  });

  return app;
}

describe('session 미들웨어', () => {
  let app;

  beforeAll(() => {
    app = buildTestApp();
  });

  afterAll(async () => {
    await pool.end();
  });

  test('로그인하지 않은 상태로 보호된 라우트 호출 시 401', async () => {
    const res = await request(app).get('/__test/protected');
    expect(res.status).toBe(401);
  });

  test('로그인 시 httpOnly 쿠키가 발급되고 DB session 테이블에 저장된다', async () => {
    const before = await pool.query('SELECT count(*) FROM session');

    const agent = request.agent(app);
    const loginRes = await agent.post('/__test/login').send({ role: 'salesperson' });
    const setCookie = loginRes.headers['set-cookie'][0];
    expect(setCookie).toMatch(/HttpOnly/i);

    const after = await pool.query('SELECT count(*) FROM session');
    expect(Number(after.rows[0].count)).toBeGreaterThan(Number(before.rows[0].count));

    const found = await pool.query(
      "SELECT 1 FROM session WHERE sess->>'userId' = 'u1'"
    );
    expect(found.rowCount).toBeGreaterThan(0);
  });

  test('role이 다른 사용자가 접근 제한 라우트 호출 시 403, 본인 라우트는 200', async () => {
    const agent = request.agent(app);
    await agent.post('/__test/login').send({ role: 'salesperson' });

    const managerOnlyRes = await agent.get('/__test/manager-only');
    expect(managerOnlyRes.status).toBe(403);

    const protectedRes = await agent.get('/__test/protected');
    expect(protectedRes.status).toBe(200);
  });

  test('role이 일치하면 접근 제한 라우트도 200', async () => {
    const agent = request.agent(app);
    await agent.post('/__test/login').send({ role: 'manager' });

    const res = await agent.get('/__test/manager-only');
    expect(res.status).toBe(200);
  });
});
