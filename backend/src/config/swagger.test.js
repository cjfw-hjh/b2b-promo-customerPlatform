const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');
const swaggerSpec = require('./swagger');

afterAll(async () => {
  await pool.end();
});

describe('GET /api-docs', () => {
  test('200과 swagger-ui HTML을 반환한다', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('swagger-ui');
  });
});

describe('swagger 스펙 객체', () => {
  test('15개 엔드포인트 경로가 모두 포함되어 있다', () => {
    const expectedPaths = [
      '/health',
      '/api/auth/signup',
      '/api/auth/login',
      '/api/auth/logout',
      '/api/customers',
      '/api/customers/{id}/knowhow',
      '/api/sales-logs',
      '/api/sales-logs/{id}',
      '/api/sales-logs/{id}/comments',
      '/api/managed/sales-logs',
      '/api/managed/comments',
    ];
    expect(swaggerSpec.paths).toBeDefined();
    expect(Object.keys(swaggerSpec.paths)).toEqual(expect.arrayContaining(expectedPaths));

    // GET/POST/PATCH/DELETE를 합쳐 문서화 대상 15개 오퍼레이션이 되는지 확인한다.
    const operationCount = Object.values(swaggerSpec.paths).reduce(
      (sum, methods) => sum + Object.keys(methods).length,
      0
    );
    expect(operationCount).toBe(15);
  });
});
