const authService = require('./authService');
const salesLogService = require('./salesLogService');
const commentService = require('./commentService');
const notificationService = require('./notificationService');
const pool = require('../db/pool');

const TEST_EMPLOYEE_NOS = ['900601', '900602', '900603', '900604'];
const MANAGER_A_EMAIL = 'comment.svc.managerA.test@example.com';
const MANAGER_B_EMAIL = 'comment.svc.managerB.test@example.com';
const S1_EMAIL = 'comment.svc.s1.test@example.com';
const S2_EMAIL = 'comment.svc.s2.test@example.com';

const CUSTOMER_ID = 1; // 시드 거래처(id 1~3) 중 하나

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
  await pool.query('DELETE FROM users WHERE employee_no = ANY($1)', [TEST_EMPLOYEE_NOS]);
}

let managerA;
let managerB;
let s1;
let s2;
let log; // S1이 작성, 담당 팀장은 managerA

beforeEach(async () => {
  managerA = await authService.signup({
    employeeNo: TEST_EMPLOYEE_NOS[0],
    email: MANAGER_A_EMAIL,
    password: 'password1',
    role: 'manager',
  });
  managerB = await authService.signup({
    employeeNo: TEST_EMPLOYEE_NOS[1],
    email: MANAGER_B_EMAIL,
    password: 'password1',
    role: 'manager',
  });
  s1 = await authService.signup({
    employeeNo: TEST_EMPLOYEE_NOS[2],
    email: S1_EMAIL,
    password: 'password1',
    role: 'salesperson',
    managerEmail: MANAGER_A_EMAIL,
  });
  s2 = await authService.signup({
    employeeNo: TEST_EMPLOYEE_NOS[3],
    email: S2_EMAIL,
    password: 'password1',
    role: 'salesperson',
    managerEmail: MANAGER_B_EMAIL,
  });
  // RULE-ORG-005 백필 미구현 상태이므로 manager_id 매칭을 직접 시뮬레이션한다(BE-4/BE-7과 동일 패턴).
  await pool.query('UPDATE users SET manager_id = $1 WHERE id = $2', [managerA.id, s1.id]);
  await pool.query('UPDATE users SET manager_id = $1 WHERE id = $2', [managerB.id, s2.id]);

  log = await salesLogService.createSalesLog({
    customerId: CUSTOMER_ID,
    activityType: '외근',
    activityContent: 'S1의 영업일지',
    authorId: s1.id,
  });
});

afterEach(cleanup);

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe('createComment', () => {
  test('존재하지 않는 영업일지면 404', async () => {
    await expect(
      commentService.createComment(9999999, managerA.id, 'manager', '내용')
    ).rejects.toMatchObject({ status: 404 });
  });

  test('content가 빈 문자열이면 400', async () => {
    await expect(commentService.createComment(log.id, managerA.id, 'manager', '')).rejects.toMatchObject({
      status: 400,
    });
  });

  test('content가 누락이면 400', async () => {
    await expect(
      commentService.createComment(log.id, managerA.id, 'manager', undefined)
    ).rejects.toMatchObject({ status: 400 });
  });

  test('RULE-FEEDBACK-003: 담당 팀장이 아닌 팀장(managerB)이 코멘트를 시도하면 403', async () => {
    await expect(
      commentService.createComment(log.id, managerB.id, 'manager', '남의 팀 코멘트')
    ).rejects.toMatchObject({ status: 403 });
  });

  test('RULE-FEEDBACK-001/002: 담당 팀장(managerA)은 코멘트를 여러 번 남길 수 있고 type은 "팀장 코멘트"다', async () => {
    const first = await commentService.createComment(log.id, managerA.id, 'manager', '첫 코멘트');
    expect(first).toEqual({
      id: expect.any(Number),
      content: '첫 코멘트',
      createdAt: expect.any(String),
      type: '팀장 코멘트',
    });

    const second = await commentService.createComment(log.id, managerA.id, 'manager', '두번째 코멘트');
    expect(second.type).toBe('팀장 코멘트');
    expect(second.id).not.toBe(first.id);
  });

  test('RULE-REPLY-002: 작성자가 아닌 영업사원(S2)이 답변을 시도하면 403', async () => {
    await expect(
      commentService.createComment(log.id, s2.id, 'salesperson', '남의 일지에 답변')
    ).rejects.toMatchObject({ status: 403 });
  });

  test('RULE-REPLY-001: 팀장 코멘트가 하나도 없는 상태에서 작성자(S1)가 답변을 시도하면 403', async () => {
    await expect(
      commentService.createComment(log.id, s1.id, 'salesperson', '최초 답변 시도')
    ).rejects.toMatchObject({ status: 403 });
  });

  test('RULE-REPLY-004: 팀장 코멘트 등록 후에는 작성자(S1)가 여러 번 답변해도 전부 성공하고 type은 "답변"이다', async () => {
    await commentService.createComment(log.id, managerA.id, 'manager', '팀장 코멘트');

    const reply1 = await commentService.createComment(log.id, s1.id, 'salesperson', '답변1');
    expect(reply1.type).toBe('답변');
    const reply2 = await commentService.createComment(log.id, s1.id, 'salesperson', '답변2');
    expect(reply2.type).toBe('답변');
  });

  test('role이 manager/salesperson이 아니면 403(방어적 분기)', async () => {
    await expect(
      commentService.createComment(log.id, s1.id, 'unknown', '알수없는 역할')
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('createComment 알림(BE-9)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // RULE-FEEDBACK-004: 팀장(managerA)이 코멘트를 남기면 영업일지 작성자(S1)에게 알림한다.
  test('RULE-FEEDBACK-004: 매니저 코멘트 시 영업일지 작성자(S1)의 이메일로 알림 발송을 시도한다', async () => {
    const spy = jest.spyOn(notificationService, 'sendNotification').mockResolvedValue();

    await commentService.createComment(log.id, managerA.id, 'manager', '코멘트');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ to: S1_EMAIL }));
  });

  // RULE-REPLY-005: 영업사원(S1)이 답변하면 담당 팀장(managerA) 계정의 이메일로 알림한다.
  test('RULE-REPLY-005: 영업사원 답변 시 담당 팀장(managerA)의 이메일로 알림 발송을 시도한다', async () => {
    await commentService.createComment(log.id, managerA.id, 'manager', '팀장 코멘트'); // 답변 가능하게 선행 조건 충족

    const spy = jest.spyOn(notificationService, 'sendNotification').mockResolvedValue();
    await commentService.createComment(log.id, s1.id, 'salesperson', '답변');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ to: MANAGER_A_EMAIL }));
  });

  // RULE-NOTIFICATION-001: 알림 발송 함수가 강제로 예외를 던져도 코멘트 저장 자체는 성공해야 한다.
  test('RULE-NOTIFICATION-001: 알림 발송이 실패해도 코멘트 저장은 성공하고 DB에 실제로 남는다', async () => {
    jest.spyOn(notificationService, 'sendNotification').mockRejectedValueOnce(new Error('SMTP 다운'));

    const comment = await commentService.createComment(log.id, managerA.id, 'manager', '코멘트');

    expect(comment.id).toEqual(expect.any(Number));
    const row = (await pool.query('SELECT 1 FROM comments WHERE id = $1', [comment.id])).rows[0];
    expect(row).toBeDefined();
  });
});

describe('listComments', () => {
  test('존재하지 않는 영업일지면 404', async () => {
    await expect(commentService.listComments(9999999, s1.id, 'salesperson')).rejects.toMatchObject({
      status: 404,
    });
  });

  test('작성자 본인(S1)도 담당 팀장(managerA)도 아닌 사용자(S2)가 조회하면 403', async () => {
    await expect(commentService.listComments(log.id, s2.id, 'salesperson')).rejects.toMatchObject({
      status: 403,
    });
  });

  test('담당 팀장이 아닌 다른 팀장(managerB)이 조회하면 403', async () => {
    await expect(commentService.listComments(log.id, managerB.id, 'manager')).rejects.toMatchObject({
      status: 403,
    });
  });

  test('작성자 본인(S1)과 담당 팀장(managerA)은 조회 가능하고, created_at 오름차순으로 type이 정확히 매겨진다', async () => {
    await commentService.createComment(log.id, managerA.id, 'manager', '코멘트1');
    await commentService.createComment(log.id, managerA.id, 'manager', '코멘트2');
    await commentService.createComment(log.id, s1.id, 'salesperson', '답변1');
    await commentService.createComment(log.id, s1.id, 'salesperson', '답변2');

    const asAuthor = await commentService.listComments(log.id, s1.id, 'salesperson');
    expect(asAuthor.map((c) => c.type)).toEqual(['팀장 코멘트', '팀장 코멘트', '답변', '답변']);
    expect(asAuthor.map((c) => c.content)).toEqual(['코멘트1', '코멘트2', '답변1', '답변2']);

    const asManager = await commentService.listComments(log.id, managerA.id, 'manager');
    expect(asManager).toEqual(asAuthor);
  });

  test('코멘트가 없으면 빈 배열을 반환한다', async () => {
    const result = await commentService.listComments(log.id, s1.id, 'salesperson');
    expect(result).toEqual([]);
  });
});

describe('listManagedComments', () => {
  test('요청자(팀장) 본인이 작성한 코멘트만, 최신순으로 반환한다', async () => {
    const otherLog = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '내근',
      activityContent: 'S1의 두번째 영업일지',
      authorId: s1.id,
    });
    const s2Log = await salesLogService.createSalesLog({
      customerId: CUSTOMER_ID,
      activityType: '외근',
      activityContent: 'S2의 영업일지',
      authorId: s2.id,
    });

    const c1 = await commentService.createComment(log.id, managerA.id, 'manager', 'A의 첫 코멘트');
    const c2 = await commentService.createComment(otherLog.id, managerA.id, 'manager', 'A의 두번째 코멘트');
    // managerB가 자신이 담당하는 S2의 일지에 남긴 코멘트 — managerA의 이력에는 나오면 안 된다.
    await commentService.createComment(s2Log.id, managerB.id, 'manager', 'B의 코멘트');
    // S1의 답변 — 코멘트 작성자가 managerA가 아니므로 나오면 안 된다.
    await commentService.createComment(log.id, s1.id, 'salesperson', 'S1의 답변');

    const result = await commentService.listManagedComments(managerA.id);
    expect(result).toHaveLength(2);
    // 최신순(내림차순)이므로 두번째로 작성한 c2가 먼저 나와야 한다.
    expect(result[0].id).toBe(c2.id);
    expect(result[1].id).toBe(c1.id);
    expect(result[0]).toEqual({
      id: c2.id,
      content: 'A의 두번째 코멘트',
      createdAt: expect.any(String),
      salesLogId: otherLog.id,
      customerName: '교촌 치킨',
      authorEmployeeNo: TEST_EMPLOYEE_NOS[2], // S1의 사번(코멘트 작성자가 아니라 영업일지 작성자)
    });
  });

  test('본인이 작성한 코멘트가 없으면 빈 배열을 반환한다', async () => {
    const result = await commentService.listManagedComments(managerB.id);
    expect(result).toEqual([]);
  });
});
