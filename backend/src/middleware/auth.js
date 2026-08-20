// requireRole은 인증(req.session.userId 존재)이 이미 확인됐다는 전제로 동작한다.
// 라우트에서 반드시 requireAuth 다음에 체이닝할 것.

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ error: '로그인이 필요합니다.' });
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.session.role === role) {
      return next();
    }
    res.status(403).json({ error: '접근 권한이 없습니다.' });
  };
}

module.exports = { requireAuth, requireRole };
