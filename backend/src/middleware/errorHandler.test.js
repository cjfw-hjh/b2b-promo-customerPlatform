const errorHandler = require('./errorHandler');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('errorHandler', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('err.status가 있으면 해당 상태코드로 응답한다', () => {
    const res = mockRes();
    const err = Object.assign(new Error('찾을 수 없음'), { status: 404 });

    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: '찾을 수 없음' });
  });

  test('err.status가 없으면 500으로 응답한다', () => {
    const res = mockRes();
    const err = new Error('알 수 없는 에러');

    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: '알 수 없는 에러' });
  });
});
