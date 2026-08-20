const authService = require('./authService');
const pool = require('../db/pool');

const TEST_EMPLOYEE_NOS = ['900001', '900002'];
const TEST_EMAILS = ['sales.test@example.com', 'manager.test@example.com'];

async function cleanup() {
  await pool.query('DELETE FROM users WHERE employee_no = ANY($1) OR email = ANY($2)', [
    TEST_EMPLOYEE_NOS,
    TEST_EMAILS,
  ]);
}

afterEach(cleanup);

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe('signup', () => {
  test('영업사원이 정상 입력값으로 가입에 성공하고 password_hash가 bcrypt 해시로 저장된다', async () => {
    const result = await authService.signup({
      employeeNo: '900001',
      email: 'sales.test@example.com',
      password: 'password1',
      role: 'salesperson',
      managerEmail: 'manager.test@example.com',
    });

    expect(result).toEqual({
      id: expect.any(Number),
      employeeNo: '900001',
      email: 'sales.test@example.com',
      role: 'salesperson',
    });
    expect(result.password_hash).toBeUndefined();

    const row = (await pool.query('SELECT * FROM users WHERE id = $1', [result.id])).rows[0];
    expect(row.password_hash).not.toBe('password1');
    expect(row.password_hash).toMatch(/^\$2[aby]?\$/);
    expect(row.manager_email).toBe('manager.test@example.com');
    expect(row.manager_id).toBeNull();
  });

  test('팀장이 정상 입력값으로 가입에 성공하고 managerEmail을 보내도 무시되어 NULL로 저장된다', async () => {
    const result = await authService.signup({
      employeeNo: '900002',
      email: 'manager.test@example.com',
      password: 'password1',
      role: 'manager',
      managerEmail: 'ignored@example.com',
    });

    expect(result.role).toBe('manager');

    const row = (await pool.query('SELECT * FROM users WHERE id = $1', [result.id])).rows[0];
    expect(row.manager_email).toBeNull();
    expect(row.password_hash).toMatch(/^\$2[aby]?\$/);
  });

  test('사번이 6자리가 아니면 400', async () => {
    await expect(
      authService.signup({
        employeeNo: '90001',
        email: 'sales.test@example.com',
        password: 'password1',
        role: 'salesperson',
        managerEmail: 'manager.test@example.com',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('이메일 형식이 잘못되면 400', async () => {
    await expect(
      authService.signup({
        employeeNo: '900001',
        email: 'not-an-email',
        password: 'password1',
        role: 'salesperson',
        managerEmail: 'manager.test@example.com',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('비밀번호가 7자리 미만이면 400', async () => {
    await expect(
      authService.signup({
        employeeNo: '900001',
        email: 'sales.test@example.com',
        password: '123456',
        role: 'salesperson',
        managerEmail: 'manager.test@example.com',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('영업사원 가입 시 managerEmail이 없으면 400', async () => {
    await expect(
      authService.signup({
        employeeNo: '900001',
        email: 'sales.test@example.com',
        password: 'password1',
        role: 'salesperson',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('role이 salesperson/manager가 아니면 400', async () => {
    await expect(
      authService.signup({
        employeeNo: '900001',
        email: 'sales.test@example.com',
        password: 'password1',
        role: 'admin',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('동일 사번/이메일로 재가입 시도 시 400', async () => {
    await authService.signup({
      employeeNo: '900001',
      email: 'sales.test@example.com',
      password: 'password1',
      role: 'salesperson',
      managerEmail: 'manager.test@example.com',
    });

    await expect(
      authService.signup({
        employeeNo: '900001',
        email: 'other.email@example.com',
        password: 'password1',
        role: 'salesperson',
        managerEmail: 'manager.test@example.com',
      })
    ).rejects.toMatchObject({ status: 400 });

    // 정리용으로 other.email도 지운다(혹시 위 케이스가 실패해서 남았을 경우 대비).
    await pool.query('DELETE FROM users WHERE email = $1', ['other.email@example.com']);
  });
});

describe('login', () => {
  beforeEach(async () => {
    await authService.signup({
      employeeNo: '900001',
      email: 'sales.test@example.com',
      password: 'password1',
      role: 'salesperson',
      managerEmail: 'manager.test@example.com',
    });
  });

  test('올바른 이메일/비밀번호로 로그인에 성공한다', async () => {
    const result = await authService.login({
      email: 'sales.test@example.com',
      password: 'password1',
    });
    expect(result).toEqual({ id: expect.any(Number), role: 'salesperson' });
  });

  test('존재하지 않는 이메일이면 401', async () => {
    await expect(
      authService.login({ email: 'no-such-user@example.com', password: 'password1' })
    ).rejects.toMatchObject({ status: 401 });
  });

  test('비밀번호가 틀리면 401', async () => {
    await expect(
      authService.login({ email: 'sales.test@example.com', password: 'wrongpassword' })
    ).rejects.toMatchObject({ status: 401 });
  });
});
