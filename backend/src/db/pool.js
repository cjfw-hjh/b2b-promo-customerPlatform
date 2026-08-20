const { Pool } = require('pg');
const { requireEnv } = require('../config/env');

const pool = new Pool({ connectionString: requireEnv('DB_CONN_STRING') });

pool
  .query('SELECT 1')
  .then(() => console.log('[db] DB 연결 성공'))
  .catch((err) => console.error('[db] DB 연결 실패:', err.message));

module.exports = pool;
