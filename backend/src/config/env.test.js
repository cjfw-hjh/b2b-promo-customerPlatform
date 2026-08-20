const { requireEnv } = require('./env');

describe('requireEnv', () => {
  test('값이 있으면 그대로 반환한다', () => {
    process.env.TEST_ENV_KEY = 'value';
    expect(requireEnv('TEST_ENV_KEY')).toBe('value');
    delete process.env.TEST_ENV_KEY;
  });

  test('값이 없으면 에러를 던진다', () => {
    expect(() => requireEnv('NOT_SET_KEY')).toThrow(/NOT_SET_KEY/);
  });
});
