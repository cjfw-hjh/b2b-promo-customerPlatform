const authService = require('./authService');
const organizationService = require('./organizationService');
const salesLogService = require('./salesLogService');
const pool = require('../db/pool');

const TEST_EMPLOYEE_NOS = ['900101', '900102', '900103', '900104'];
const TEST_EMAILS = [
  'org.manager1.test@example.com',
  'org.sales1.test@example.com',
  'org.sales2.test@example.com',
  'org.manager2.test@example.com',
];
const CUSTOMER_ID = 1; // 시드 거래처(id 1~3) 중 하나

async function cleanup() {
  // sales_logs/comments는 users를 FK로 참조하므로(ON DELETE 기본값 RESTRICT) users보다 먼저 지운다.
  await pool.query(
    `DELETE FROM comments WHERE sales_log_id IN (
       SELECT id FROM sales_logs WHERE author_id IN (
         SELECT id FROM users WHERE employee_no = ANY($1)
       )
     )`,
    [TEST_EMPLOYEE_NOS]
  );
  await pool.query(
    `DELETE FROM sales_logs WHERE author_id IN (
       SELECT id FROM users WHERE employee_no = ANY($1)
     )`,
    [TEST_EMPLOYEE_NOS]
  );
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
      // RULE-ORG-005 백필은 "팀장이 가입하는 시점"에만 트리거된다 — 팀장이 이미 가입해 있는
      // 상태에서 영업사원이 나중에 가입해도 재트리거되지 않으므로 manager_id는 NULL로 남는다.
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

    // getManagedSalespeople 자체는 signup 트리거와 무관하게 조회만 하므로, 매칭 완료 상태를 직접 SQL로 시뮬레이션한다.
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

describe('RULE-ORG-005: 미가입 팀장 자동 연결(백필, BE-12)', () => {
  test('영업사원 2명이 같은 팀장 이메일을 입력해둔 상태에서 그 이메일로 팀장이 가입하면, 두 영업사원의 manager_id가 모두 새 팀장 id로 갱신된다', async () => {
    const sales1 = await authService.signup({
      employeeNo: '900102',
      email: 'org.sales1.test@example.com',
      password: 'password1',
      role: 'salesperson',
      managerEmail: 'org.manager1.test@example.com',
    });
    const sales2 = await authService.signup({
      employeeNo: '900103',
      email: 'org.sales2.test@example.com',
      password: 'password1',
      role: 'salesperson',
      managerEmail: 'org.manager1.test@example.com',
    });

    const manager = await authService.signup({
      employeeNo: '900101',
      email: 'org.manager1.test@example.com',
      password: 'password1',
      role: 'manager',
    });

    const rows = (
      await pool.query('SELECT id, manager_id FROM users WHERE id = ANY($1) ORDER BY id', [
        [sales1.id, sales2.id],
      ])
    ).rows;
    expect(rows).toEqual([
      { id: sales1.id, manager_id: manager.id },
      { id: sales2.id, manager_id: manager.id },
    ]);
  });

  test('매칭 후 팀장이 관리 대상 영업일지를 조회하면 매칭 전에 쌓여있던 영업일지가 즉시 조회된다', async () => {
    const sales = await authService.signup({
      employeeNo: '900102',
      email: 'org.sales1.test@example.com',
      password: 'password1',
      role: 'salesperson',
      managerEmail: 'org.manager1.test@example.com',
    });
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '팀장 매칭 전에 작성된 영업일지',
      authorId: sales.id,
    });

    const manager = await authService.signup({
      employeeNo: '900101',
      email: 'org.manager1.test@example.com',
      password: 'password1',
      role: 'manager',
    });

    const managed = await organizationService.getManagedSalespeople(manager.id);
    const managedLogs = await salesLogService.listManagedSalesLogs(managed.map((s) => s.id));
    expect(managedLogs.map((l) => l.id)).toContain(log.id);
  });

  test('트랜잭션 원자성: 백필 UPDATE가 실패하면 롤백되어 manager_id가 NULL로 유지된다', async () => {
    const sales = await authService.signup({
      employeeNo: '900102',
      email: 'org.sales1.test@example.com',
      password: 'password1',
      role: 'salesperson',
      managerEmail: 'org.manager1.test@example.com',
    });

    // 존재하지 않는 managerId는 fk_users_manager_id 제약을 실제로 위반해 UPDATE가 실패한다 —
    // 모킹 없이 실제 DB 제약으로 롤백 경로를 검증한다.
    const NON_EXISTENT_MANAGER_ID = 999999999;
    await expect(
      organizationService.linkExistingSalespeople('org.manager1.test@example.com', NON_EXISTENT_MANAGER_ID)
    ).rejects.toThrow();

    const row = (await pool.query('SELECT manager_id FROM users WHERE id = $1', [sales.id]))
      .rows[0];
    expect(row.manager_id).toBeNull();
  });
});
