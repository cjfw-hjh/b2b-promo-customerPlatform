const app = require('./app');
require('./db/pool'); // 부팅 시 DB 연결 확인 로그를 남기기 위해 로드

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
