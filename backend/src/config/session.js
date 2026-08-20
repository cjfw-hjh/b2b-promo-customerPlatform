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
  },
});
