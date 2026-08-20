// 이 파일은 Express 라우팅/미들웨어 없이 컨트롤러 함수를 직접 호출해서
// req/res 배선(params/session/body -> service 호출 -> status/json, 에러 시 next(err))만 검증한다.
// 권한/도메인 규칙(403/404 등)은 commentService.test.js가, HTTP 전체 흐름은 commentRoutes.test.js가 담당한다.
// 실제 서비스 함수를 그대로 호출하므로(모킹 금지 컨벤션) 실제 로컬 DB에 접근한다.
const commentController = require('./commentController');
const commentService = require('../services/commentService');
const authService = require('../services/authService');
const salesLogService = require('../services/salesLogService');
const pool = require('../db/pool');

const TEST_EMPLOYEE_NOS = ['900701', '900702'];
const MANAGER_EMAIL = 'comment.ctrl.manager.test@example.com';
const SALES_EMAIL = 'comment.ctrl.sales.test@example.com';

const CUSTOMER_ID = 1; // 시드 거래처(id 1~3) 중 하나

async function cleanup() {
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

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

let manager;
let salesperson;
let log;

beforeEach(async () => {
  manager = await authService.signup({
    employeeNo: TEST_EMPLOYEE_NOS[0],
    email: MANAGER_EMAIL,
    password: 'password1',
    role: 'manager',
  });
  salesperson = await authService.signup({
    employeeNo: TEST_EMPLOYEE_NOS[1],
    email: SALES_EMAIL,
    password: 'password1',
    role: 'salesperson',
    managerEmail: MANAGER_EMAIL,
  });
  await pool.query('UPDATE users SET manager_id = $1 WHERE id = $2', [manager.id, salesperson.id]);

  log = await salesLogService.createSalesLog({
    customerId: CUSTOMER_ID,
    activityType: '외근',
    activityContent: '컨트롤러 테스트용 일지',
    authorId: salesperson.id,
  });
});

afterEach(cleanup);

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe('create', () => {
  test('담당 팀장 세션이면 201과 함께 생성된 코멘트를 반환한다', async () => {
    const req = {
      params: { id: String(log.id) },
      session: { userId: manager.id, role: 'manager' },
      body: { content: '컨트롤러 경유 코멘트' },
    };
    const res = mockRes();
    const next = jest.fn();

    await commentController.create(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ content: '컨트롤러 경유 코멘트', type: '팀장 코멘트' })
    );
  });

  test('service가 에러를 던지면(예: 존재하지 않는 영업일지) next(err)로 위임한다', async () => {
    const req = {
      params: { id: '9999999' },
      session: { userId: manager.id, role: 'manager' },
      body: { content: '내용' },
    };
    const res = mockRes();
    const next = jest.fn();

    await commentController.create(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
  });
});

describe('list', () => {
  test('조회 권한이 있는 세션(작성자 본인)이면 200과 함께 배열을 반환한다', async () => {
    await commentService.createComment(log.id, manager.id, 'manager', '팀장 코멘트');

    const req = {
      params: { id: String(log.id) },
      session: { userId: salesperson.id, role: 'salesperson' },
    };
    const res = mockRes();
    const next = jest.fn();

    await commentController.list(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ content: '팀장 코멘트', type: '팀장 코멘트' }),
    ]);
  });

  test('service가 에러를 던지면(예: 권한 없음) next(err)로 위임한다', async () => {
    const other = await authService.signup({
      employeeNo: '900703',
      email: 'comment.ctrl.other.test@example.com',
      password: 'password1',
      role: 'salesperson',
      managerEmail: MANAGER_EMAIL,
    });

    const req = {
      params: { id: String(log.id) },
      session: { userId: other.id, role: 'salesperson' },
    };
    const res = mockRes();
    const next = jest.fn();

    await commentController.list(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));

    await pool.query('DELETE FROM users WHERE id = $1', [other.id]);
  });
});

describe('listManagedComments', () => {
  test('200과 함께 요청자가 작성한 코멘트 배열을 반환한다', async () => {
    await commentService.createComment(log.id, manager.id, 'manager', '이력 조회용 코멘트');

    const req = { session: { userId: manager.id, role: 'manager' } };
    const res = mockRes();
    const next = jest.fn();

    await commentController.listManagedComments(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ content: '이력 조회용 코멘트', authorEmployeeNo: TEST_EMPLOYEE_NOS[1] }),
    ]);
  });

  test('service가 에러를 던지면 next(err)로 위임한다', async () => {
    const spy = jest
      .spyOn(commentService, 'listManagedComments')
      .mockRejectedValueOnce(new Error('DB 오류'));
    const req = { session: { userId: manager.id, role: 'manager' } };
    const res = mockRes();
    const next = jest.fn();

    await commentController.listManagedComments(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    spy.mockRestore();
  });
});
