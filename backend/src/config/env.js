// 필요한 환경변수가 없으면 즉시 에러를 던져 기동을 막는다.
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경변수 ${name}가 설정되지 않았습니다. .env를 확인하세요.`);
  }
  return value;
}

module.exports = { requireEnv };
