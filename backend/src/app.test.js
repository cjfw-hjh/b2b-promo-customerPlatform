const request = require('supertest');
const app = require('./app');
const pool = require('./db/pool');

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
