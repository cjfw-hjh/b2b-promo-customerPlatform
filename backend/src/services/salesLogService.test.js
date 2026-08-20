const authService = require('./authService');
const salesLogService = require('./salesLogService');
const notificationService = require('./notificationService');
const pool = require('../db/pool');

const TEST_EMPLOYEE_NOS = ['900301', '900302'];
const TEST_EMAILS = ['saleslog.a.test@example.com', 'saleslog.b.test@example.com'];
const TEAM_LEAD_EMAIL = 'saleslog.teamlead.test@example.com';

const CUSTOMER_ID = 1; // 시드 거래처(id 1~3) 중 하나
const NON_EXISTENT_CUSTOMER_ID = 999999;

async function cleanup() {
  // FK가 전부 RESTRICT이므로 comments -> sales_logs -> users 순서로 지운다.
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

let userA;
let userB;

beforeEach(async () => {
  userA = await authService.signup({
    employeeNo: TEST_EMPLOYEE_NOS[0],
    email: TEST_EMAILS[0],
    password: 'password1',
    role: 'salesperson',
    managerEmail: TEAM_LEAD_EMAIL,
  });
  userB = await authService.signup({
    employeeNo: TEST_EMPLOYEE_NOS[1],
    email: TEST_EMAILS[1],
    password: 'password1',
    role: 'salesperson',
    managerEmail: TEAM_LEAD_EMAIL,
  });
});

afterEach(cleanup);

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe('createSalesLog', () => {
  test('정상 입력 시 comments가 없으므로 상태는 "작성 완료"로 반환된다', async () => {
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '거래처 방문 미팅',
      authorId: userA.id,
    });

    expect(log).toEqual({
      id: expect.any(Number),
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '거래처 방문 미팅',
      createdAt: expect.any(String),
      status: '작성 완료',
    });
  });

  // RULE-LOG-001: created_at은 서버 시간(now())으로만 설정된다.
  // 이 함수는 애초에 createdAt을 인자로 받지 않으므로 호출자가 값을 실어 보내도 반영될 여지가 없다.
  test('RULE-LOG-001: created_at은 호출 시점의 서버 시간으로 자동 설정된다', async () => {
    const before = Date.now();
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '내용',
      authorId: userA.id,
    });
    const createdAtMs = new Date(log.createdAt).getTime();
    expect(createdAtMs).toBeGreaterThanOrEqual(before);
    expect(createdAtMs).toBeLessThanOrEqual(Date.now());
  });

  test("activityType이 '외근'/'내근'/'기타'가 아니면 400", async () => {
    await expect(
      salesLogService.createSalesLog({
        customerId: CUSTOMER_ID,
        activityType: '전화',
        activityContent: '내용',
        authorId: userA.id,
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('activityContent가 빈 문자열이면 400', async () => {
    await expect(
      salesLogService.createSalesLog({
        customerId: CUSTOMER_ID,
        activityType: '외근',
        activityContent: '',
        authorId: userA.id,
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('activityContent가 누락이면 400', async () => {
    await expect(
      salesLogService.createSalesLog({
        customerId: CUSTOMER_ID,
        activityType: '외근',
        authorId: userA.id,
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('RULE-CUSTOMER-001: 존재하지 않는 거래처면 400(FK 위반을 캐치해 변환)', async () => {
    await expect(
      salesLogService.createSalesLog({
        customerId: NON_EXISTENT_CUSTOMER_ID,
        activityType: '외근',
        activityContent: '내용',
        authorId: userA.id,
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('FK 위반이 아닌 예상치 못한 DB 오류는 그대로 전파된다(400으로 변환하지 않음)', async () => {
    const spy = jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('DB 오류'));
    await expect(
      salesLogService.createSalesLog({
        customerId: CUSTOMER_ID,
        activityType: '외근',
        activityContent: '내용',
        authorId: userA.id,
      })
    ).rejects.toThrow('DB 오류');
    spy.mockRestore();
  });
});

describe('createSalesLog 알림(BE-9)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // RULE-ORG-004: TEAM_LEAD_EMAIL로는 실제 가입된 계정이 없다(beforeEach에서 userA/userB만 가입).
  // 그래도 manager_email 컬럼값 그대로 발송을 시도해야 한다.
  test('RULE-ORG-004: 미가입 팀장이어도 manager_email로 알림 발송을 시도한다', async () => {
    const spy = jest.spyOn(notificationService, 'sendNotification').mockResolvedValue();

    await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '내용',
      authorId: userA.id,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ to: TEAM_LEAD_EMAIL }));
  });

  // RULE-NOTIFICATION-001: 알림 발송 함수가 강제로 예외를 던져도 영업일지 저장 자체는 성공해야 한다.
  test('RULE-NOTIFICATION-001: 알림 발송이 실패해도 영업일지 저장은 성공하고 DB에 실제로 남는다', async () => {
    jest.spyOn(notificationService, 'sendNotification').mockRejectedValueOnce(new Error('SMTP 다운'));

    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '내용',
      authorId: userA.id,
    });

    expect(log.id).toEqual(expect.any(Number));
    const row = (await pool.query('SELECT 1 FROM sales_logs WHERE id = $1', [log.id])).rows[0];
    expect(row).toBeDefined();
  });
});

describe('listMySalesLogs', () => {
  test('본인이 작성한 영업일지만 반환하고, status는 comments 개수 기준으로 정확히 계산된다', async () => {
    const logA = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: 'A 방문',
      authorId: userA.id,
    });
    await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '내근',
      activityContent: 'B 작성',
      authorId: userB.id,
    });

    // 코멘트 작성 API는 아직 없으므로(BE-8 범위) comments 테이블에 직접 INSERT한다.
    await pool.query('INSERT INTO comments (sales_log_id, author_id, content) VALUES ($1, $2, $3)', [
      logA.id,
      userB.id,
      '피드백',
    ]);

    const listA = await salesLogService.listMySalesLogs(userA.id);
    expect(listA).toHaveLength(1);
    expect(listA[0].id).toBe(logA.id);
    expect(listA[0].status).toBe('코멘트 진행중');

    const listB = await salesLogService.listMySalesLogs(userB.id);
    expect(listB).toHaveLength(1);
    expect(listB[0].status).toBe('작성 완료');
  });
});

describe('listMySalesLogs 검색 필터(BE-10)', () => {
  test('두 번째 인자 없이 호출해도(하위 호환) 기존처럼 전체 목록을 반환한다', async () => {
    await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '내용',
      authorId: userA.id,
    });
    const list = await salesLogService.listMySalesLogs(userA.id);
    expect(list).toHaveLength(1);
  });

  test('from/to/customerId/activityType/keyword 단독·조합 필터링 및 RULE-SEARCH-001(타인 일지 미포함)', async () => {
    const log1 = await salesLogService.createSalesLog({
      customerId: 1,
      activityType: '외근',
      activityContent: '알파 거래처 방문',
      authorId: userA.id,
    });
    const log2 = await salesLogService.createSalesLog({
      customerId: 2,
      activityType: '내근',
      activityContent: '베타 서류 작성',
      authorId: userA.id,
    });
    // RULE-SEARCH-001 검증용: 다른 영업사원(B)의 일지. customerId/activityType/키워드까지
    // log1과 동일하게 맞춰서, 필터가 걸려도 author_id 조건이 항상 유지되는지 강하게 확인한다.
    await salesLogService.createSalesLog({
      customerId: 1,
      activityType: '외근',
      activityContent: '알파 거래처 방문',
      authorId: userB.id,
    });

    // 기간 필터 검증을 위해 log1만 과거 날짜로 이동.
    const pastDate = '2020-01-01';
    await pool.query("UPDATE sales_logs SET created_at = $1::date WHERE id = $2", [pastDate, log1.id]);
    const today = new Date().toISOString().slice(0, 10);

    const byCustomerId = await salesLogService.listMySalesLogs(userA.id, { customerId: 2 });
    expect(byCustomerId.map((l) => l.id)).toEqual([log2.id]);

    const byActivityType = await salesLogService.listMySalesLogs(userA.id, { activityType: '내근' });
    expect(byActivityType.map((l) => l.id)).toEqual([log2.id]);

    const byKeyword = await salesLogService.listMySalesLogs(userA.id, { keyword: '알파' });
    expect(byKeyword.map((l) => l.id)).toEqual([log1.id]);

    // 존재하지 않는 activityType 값 - 400이 아니라 그냥 빈 결과.
    const byInvalidActivityType = await salesLogService.listMySalesLogs(userA.id, { activityType: '전화' });
    expect(byInvalidActivityType).toEqual([]);

    const byFrom = await salesLogService.listMySalesLogs(userA.id, { from: today });
    expect(byFrom.map((l) => l.id)).toEqual([log2.id]);

    const byTo = await salesLogService.listMySalesLogs(userA.id, { to: pastDate });
    expect(byTo.map((l) => l.id)).toEqual([log1.id]);

    // AND 조합: customerId=1 + keyword='알파' -> 본인(A)의 log1만.
    const combined = await salesLogService.listMySalesLogs(userA.id, { customerId: 1, keyword: '알파' });
    expect(combined.map((l) => l.id)).toEqual([log1.id]);

    // RULE-SEARCH-001: 필터 유무와 무관하게 userB의 일지는 절대 섞이지 않는다.
    const all = await salesLogService.listMySalesLogs(userA.id);
    expect(all.map((l) => l.id).sort((a, b) => a - b)).toEqual([log1.id, log2.id].sort((a, b) => a - b));
  });
});

describe('listManagedSalesLogs', () => {
  test('authorIds가 빈 배열이면 쿼리 없이 빈 배열을 반환한다', async () => {
    const spy = jest.spyOn(pool, 'query');
    const result = await salesLogService.listManagedSalesLogs([]);
    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('여러 작성자의 일지를 모두 반환하고 authorEmployeeNo(작성자 식별용)를 포함한다', async () => {
    const logA = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: 'A 방문',
      authorId: userA.id,
    });
    const logB = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '내근',
      activityContent: 'B 작성',
      authorId: userB.id,
    });

    const result = await salesLogService.listManagedSalesLogs([userA.id, userB.id]);
    expect(result).toHaveLength(2);
    const byId = Object.fromEntries(result.map((log) => [log.id, log]));
    expect(byId[logA.id].authorEmployeeNo).toBe(TEST_EMPLOYEE_NOS[0]);
    expect(byId[logB.id].authorEmployeeNo).toBe(TEST_EMPLOYEE_NOS[1]);
  });

  test('RULE-ORG-008: authorIds에 포함되지 않은 작성자의 일지는 결과에서 제외된다', async () => {
    await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: 'A 방문',
      authorId: userA.id,
    });

    const result = await salesLogService.listManagedSalesLogs([userB.id]);
    expect(result).toEqual([]);
  });
});

describe('getSalesLogById', () => {
  test('존재하지 않으면 404', async () => {
    await expect(salesLogService.getSalesLogById(9999999, userA.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  test('RULE-LOG-002: 작성자가 아니면 403', async () => {
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '내용',
      authorId: userA.id,
    });
    await expect(salesLogService.getSalesLogById(log.id, userB.id)).rejects.toMatchObject({
      status: 403,
    });
  });

  test('작성자 본인이면 status가 포함된 로그를 반환한다', async () => {
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '내용',
      authorId: userA.id,
    });
    const found = await salesLogService.getSalesLogById(log.id, userA.id);
    expect(found.status).toBe('작성 완료');
  });

  describe('FE-7: 팀장 접근', () => {
    const FE7_SALES_EMPLOYEE_NO = '900308';
    const FE7_SALES_EMAIL = 'saleslog.fe7sales.test@example.com';
    const FE7_MANAGER_EMPLOYEE_NO = '900309';
    const FE7_MANAGER_EMAIL = 'saleslog.fe7manager.test@example.com';
    const FE7_OTHER_MANAGER_EMPLOYEE_NO = '900310';
    const FE7_OTHER_MANAGER_EMAIL = 'saleslog.fe7othermanager.test@example.com';

    afterEach(async () => {
      const employeeNos = [
        FE7_SALES_EMPLOYEE_NO,
        FE7_MANAGER_EMPLOYEE_NO,
        FE7_OTHER_MANAGER_EMPLOYEE_NO,
      ];
      await pool.query(
        `DELETE FROM sales_logs WHERE author_id IN (
           SELECT id FROM users WHERE employee_no = ANY($1)
         )`,
        [employeeNos]
      );
      await pool.query('DELETE FROM users WHERE employee_no = ANY($1)', [employeeNos]);
    });

    test('담당 팀장은 소속 영업사원의 영업일지를 조회할 수 있다', async () => {
      const sales = await authService.signup({
        employeeNo: FE7_SALES_EMPLOYEE_NO,
        email: FE7_SALES_EMAIL,
        password: 'password1',
        role: 'salesperson',
        managerEmail: FE7_MANAGER_EMAIL,
      });
      const log = await salesLogService.createSalesLog({
        customerId: CUSTOMER_ID,
        activityType: '외근',
        activityContent: '내용',
        authorId: sales.id,
      });
      const manager = await authService.signup({
        employeeNo: FE7_MANAGER_EMPLOYEE_NO,
        email: FE7_MANAGER_EMAIL,
        password: 'password1',
        role: 'manager',
      });

      const found = await salesLogService.getSalesLogById(log.id, manager.id, 'manager');
      expect(found.id).toBe(log.id);
      expect(found.authorEmployeeNo).toBe(FE7_SALES_EMPLOYEE_NO);
    });

    test('담당 팀장이 아닌 다른 팀장이 조회하면 403', async () => {
      const sales = await authService.signup({
        employeeNo: FE7_SALES_EMPLOYEE_NO,
        email: FE7_SALES_EMAIL,
        password: 'password1',
        role: 'salesperson',
        managerEmail: FE7_MANAGER_EMAIL,
      });
      const log = await salesLogService.createSalesLog({
        customerId: CUSTOMER_ID,
        activityType: '외근',
        activityContent: '내용',
        authorId: sales.id,
      });
      const otherManager = await authService.signup({
        employeeNo: FE7_OTHER_MANAGER_EMPLOYEE_NO,
        email: FE7_OTHER_MANAGER_EMAIL,
        password: 'password1',
        role: 'manager',
      });

      await expect(
        salesLogService.getSalesLogById(log.id, otherManager.id, 'manager')
      ).rejects.toMatchObject({ status: 403 });
    });
  });
});

describe('updateSalesLog', () => {
  test('존재하지 않으면 404', async () => {
    await expect(
      salesLogService.updateSalesLog(9999999, userA.id, { activityContent: '수정' })
    ).rejects.toMatchObject({ status: 404 });
  });

  test('RULE-LOG-002: 작성자가 아니면 403', async () => {
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '내용',
      authorId: userA.id,
    });
    await expect(
      salesLogService.updateSalesLog(log.id, userB.id, { activityContent: '변조 시도' })
    ).rejects.toMatchObject({ status: 403 });
  });

  test('일부 필드만 보내도 나머지 필드는 그대로 유지된다', async () => {
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '원본 내용',
      authorId: userA.id,
    });
    const updated = await salesLogService.updateSalesLog(log.id, userA.id, {
      activityContent: '수정된 내용',
    });
    expect(updated.activityContent).toBe('수정된 내용');
    expect(updated.activityType).toBe('외근');
    expect(updated.customerId).toBe(CUSTOMER_ID);
  });

  test('RULE-LOG-004: 수정해도 created_at은 최초 저장 시점과 동일하다', async () => {
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '원본',
      authorId: userA.id,
    });
    const updated = await salesLogService.updateSalesLog(log.id, userA.id, {
      activityContent: '수정',
    });
    expect(updated.createdAt).toBe(log.createdAt);
  });

  test('RULE-LOG-005: 코멘트가 있어도 수정은 항상 성공한다(삭제만 막힘)', async () => {
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '원본',
      authorId: userA.id,
    });
    await pool.query('INSERT INTO comments (sales_log_id, author_id, content) VALUES ($1, $2, $3)', [
      log.id,
      userB.id,
      '코멘트',
    ]);

    const updated = await salesLogService.updateSalesLog(log.id, userA.id, {
      activityContent: '수정됨',
    });
    expect(updated.activityContent).toBe('수정됨');
    expect(updated.status).toBe('코멘트 진행중');
  });

  test('activityType을 유효한 다른 값으로 수정하면 반영된다', async () => {
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '원본',
      authorId: userA.id,
    });
    const updated = await salesLogService.updateSalesLog(log.id, userA.id, { activityType: '내근' });
    expect(updated.activityType).toBe('내근');
  });

  test('activityType을 잘못된 값으로 수정 시도하면 400', async () => {
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '원본',
      authorId: userA.id,
    });
    await expect(
      salesLogService.updateSalesLog(log.id, userA.id, { activityType: '전화' })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('activityContent를 빈 문자열로 수정 시도하면 400', async () => {
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '원본',
      authorId: userA.id,
    });
    await expect(
      salesLogService.updateSalesLog(log.id, userA.id, { activityContent: '' })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('RULE-CUSTOMER-001: 존재하지 않는 customerId로 수정 시도하면 400', async () => {
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '원본',
      authorId: userA.id,
    });
    await expect(
      salesLogService.updateSalesLog(log.id, userA.id, { customerId: NON_EXISTENT_CUSTOMER_ID })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('수정할 필드가 없으면(빈 객체) 기존 값 그대로 반환한다', async () => {
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '원본',
      authorId: userA.id,
    });
    const updated = await salesLogService.updateSalesLog(log.id, userA.id, {});
    expect(updated).toEqual(log);
  });

  test('FK 위반이 아닌 예상치 못한 DB 오류는 그대로 전파된다(400으로 변환하지 않음)', async () => {
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '원본',
      authorId: userA.id,
    });

    const originalQuery = pool.query.bind(pool);
    const spy = jest.spyOn(pool, 'query');
    // 첫 호출(requireOwnedRow의 SELECT)은 실제로 통과시키고, 두 번째 호출(UPDATE)만 실패시킨다.
    spy.mockImplementationOnce((...args) => originalQuery(...args));
    spy.mockRejectedValueOnce(new Error('DB 오류'));

    await expect(
      salesLogService.updateSalesLog(log.id, userA.id, { activityContent: '수정' })
    ).rejects.toThrow('DB 오류');
    spy.mockRestore();
  });
});

describe('deleteSalesLog', () => {
  test('존재하지 않으면 404', async () => {
    await expect(salesLogService.deleteSalesLog(9999999, userA.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  test('RULE-LOG-003: 작성자가 아니면 403', async () => {
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '내용',
      authorId: userA.id,
    });
    await expect(salesLogService.deleteSalesLog(log.id, userB.id)).rejects.toMatchObject({
      status: 403,
    });
  });

  test('RULE-LOG-005: 코멘트가 1건 이상 있으면 작성자 본인이 삭제를 시도해도 403', async () => {
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '내용',
      authorId: userA.id,
    });
    await pool.query('INSERT INTO comments (sales_log_id, author_id, content) VALUES ($1, $2, $3)', [
      log.id,
      userB.id,
      '코멘트',
    ]);

    await expect(salesLogService.deleteSalesLog(log.id, userA.id)).rejects.toMatchObject({
      status: 403,
    });
  });

  test('코멘트가 없고 작성자 본인이면 삭제에 성공하고 실제로 row가 사라진다', async () => {
    const log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: '내용',
      authorId: userA.id,
    });
    await salesLogService.deleteSalesLog(log.id, userA.id);

    const row = (await pool.query('SELECT 1 FROM sales_logs WHERE id = $1', [log.id])).rows[0];
    expect(row).toBeUndefined();
  });
});
