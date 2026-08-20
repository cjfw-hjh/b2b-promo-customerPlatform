const pool = require('./pool');

afterAll(async () => {
  await pool.end();
});

describe('pool', () => {
  test('로컬 DB에 SELECT 1이 성공한다', async () => {
    const result = await pool.query('SELECT 1 AS ok');
    expect(result.rows[0].ok).toBe(1);
  });
});
