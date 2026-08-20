const authService = require('./authService');
const organizationService = require('./organizationService');
const pool = require('../db/pool');

const TEST_EMPLOYEE_NOS = ['900101', '900102', '900103', '900104'];
const TEST_EMAILS = [
  'org.manager1.test@example.com',
  'org.sales1.test@example.com',
  'org.sales2.test@example.com',
  'org.manager2.test@example.com',
];

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

describe('getManagedSalespeople', () => {
  test('RULE-ORG-003 / RULE-ORG-008: manager_email만 저장되고 manager_id는 NULL인 영업사원은 팀장의 관리 목록에서 조회되지 않는다(빈 결과)', async () => {
    const manager = await authService.signup({
      employeeNo: '900101',
      email: 'org.manager1.test@example.com',
      password: 'password1',
      role: 'manager',
    });

    const sales = await authService.signup({
      employeeNo: '900102',
      email: 'org.sales1.test@example.com',
      password: 'password1',
      role: 'salesperson',
      // 이미 존재하는 팀장의 이메일이어도 RULE-ORG-005(백필)는 BE-4 범위 밖이라 자동 연결되지 않는다.
      managerEmail: 'org.manager1.test@example.com',
    });

    // RULE-ORG-003: manager_email은 저장되지만 manager_id는 가입 시점엔 항상 NULL.
    const salesRow = (
      await pool.query('SELECT manager_email, manager_id FROM users WHERE id = $1', [sales.id])
    ).rows[0];
    expect(salesRow.manager_email).toBe('org.manager1.test@example.com');
    expect(salesRow.manager_id).toBeNull();

    // RULE-ORG-008: 아직 매핑(manager_id 매칭)되지 않았으므로 팀장 조회 시 빈 결과.
    const managed = await organizationService.getManagedSalespeople(manager.id);
    expect(managed).toEqual([]);
  });

  test('RULE-ORG-008: manager_id가 실제로 매칭된 영업사원은 해당 팀장에게만 조회되고 다른 팀장에게는 조회되지 않는다', async () => {
    const manager1 = await authService.signup({
      employeeNo: '900101',
      email: 'org.manager1.test@example.com',
      password: 'password1',
      role: 'manager',
    });
    const manager2 = await authService.signup({
      employeeNo: '900104',
      email: 'org.manager2.test@example.com',
      password: 'password1',
      role: 'manager',
    });
    const sales = await authService.signup({
      employeeNo: '900102',
      email: 'org.sales1.test@example.com',
      password: 'password1',
      role: 'salesperson',
      managerEmail: 'org.manager1.test@example.com',
    });

    // BE-4 범위에는 RULE-ORG-005 백필 로직이 없으므로, 매칭 완료 상태를 직접 SQL로 시뮬레이션한다.
    await pool.query('UPDATE users SET manager_id = $1 WHERE id = $2', [manager1.id, sales.id]);

    const managedByManager1 = await organizationService.getManagedSalespeople(manager1.id);
    expect(managedByManager1).toHaveLength(1);
    expect(managedByManager1[0].id).toBe(sales.id);

    // 매핑되지 않은(자신에게 매핑되지 않은) 팀장이 조회하면 빈 결과.
    const managedByManager2 = await organizationService.getManagedSalespeople(manager2.id);
    expect(managedByManager2).toEqual([]);
  });
});

describe('RULE-ORG-007: 영업사원은 정확히 하나의 팀장에게만 매핑된다', () => {
  test('manager_id는 배열이 아닌 단일 값(스칼라) 컬럼이므로 영업사원 1명은 최대 1개의 manager_id만 가질 수 있다', async () => {
    // 스키마 자체가 manager_id를 배열이 아닌 단일 컬럼으로 강제하는지 재확인(회귀 방지).
    const columnInfo = await pool.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'users' AND column_name = 'manager_id'`
    );
    expect(columnInfo.rows).toHaveLength(1);
    expect(columnInfo.rows[0].data_type).not.toBe('ARRAY');

    const sales = await authService.signup({
      employeeNo: '900103',
      email: 'org.sales2.test@example.com',
      password: 'password1',
      role: 'salesperson',
      managerEmail: 'org.manager1.test@example.com',
    });

    const row = (await pool.query('SELECT manager_id FROM users WHERE id = $1', [sales.id]))
      .rows[0];
    expect(Array.isArray(row.manager_id)).toBe(false);
  });
});
