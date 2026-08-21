const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('../db/pool');
const { requireEnv } = require('./env');

module.exports = session({
  store: new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: false,
  }),
  secret: requireEnv('SESSION_SECRET'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
    // 프론트/백엔드를 서로 다른 Vercel 도메인에 나눠 배포하므로 프로덕션에서는
    // 크로스사이트 쿠키 전송이 필요하다(SameSite=None은 Secure 없이는 브라우저가 거부한다).
    ...(process.env.NODE_ENV === 'production' ? { sameSite: 'none', secure: true } : {}),
  },
});
