const { requireAuth, requireRole } = require('./auth');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('requireAuth', () => {
  test('세션에 userId가 있으면 next를 호출한다', () => {
    const req = { session: { userId: 'u1' } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('세션 자체가 없으면 401을 반환한다', () => {
    const req = { session: null };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(String) });
  });

  test('세션은 있지만 userId가 없으면 401을 반환한다', () => {
    const req = { session: {} };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('requireRole', () => {
  test('세션의 role이 일치하면 next를 호출한다', () => {
    const req = { session: { role: 'manager' } };
    const res = mockRes();
    const next = jest.fn();

    requireRole('manager')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('세션의 role이 다르면 403을 반환한다', () => {
    const req = { session: { role: 'salesperson' } };
    const res = mockRes();
    const next = jest.fn();

    requireRole('manager')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(String) });
  });
});
