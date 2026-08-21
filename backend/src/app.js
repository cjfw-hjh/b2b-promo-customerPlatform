const express = require('express');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const session = require('./config/session');
const errorHandler = require('./middleware/errorHandler');
const { requireAuth, requireRole } = require('./middleware/auth');
const salesLogController = require('./controllers/salesLogController');
const commentController = require('./controllers/commentController');
const swaggerSpec = require('./config/swagger');

const app = express();

// Vercel이 TLS를 엣지에서 종료하고 함수에는 평문 HTTP로 전달하므로, 이 설정이 없으면
// req.secure가 항상 false가 되어 세션 쿠키의 secure:true(session.js)가 아예 발급되지 않는다.
app.set('trust proxy', 1);

// 프론트/백엔드를 서로 다른 Vercel 도메인에 나눠 배포하므로 크로스오리진 요청을 허용한다.
// 로컬 개발은 Vite 프록시로 same-origin처럼 동작해 FRONTEND_ORIGIN이 필요 없다(vite.config.js).
if (process.env.FRONTEND_ORIGIN) {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
}

app.use(morgan('dev'));
app.use(session);
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/sales-logs', require('./routes/salesLogRoutes'));
// mergeParams: true인 commentRoutes.js가 req.params.id로 영업일지 id를 받도록 중첩 마운트한다.
app.use('/api/sales-logs/:id/comments', require('./routes/commentRoutes'));
// /api/sales-logs와 prefix가 다른 팀장 전용 조회라 salesLogRoutes.js에 넣으면 경로가
// 틀어진다(/api/sales-logs/managed가 되어버림). /api/managed/* prefix가 더 늘어나면
// 그때 라우터 파일로 리팩터링한다(지금은 2줄뿐이라 오버엔지니어링 방지 차원에서 직접 등록).
app.get('/api/managed/sales-logs', requireAuth, requireRole('manager'), salesLogController.listManaged);
app.get('/api/managed/comments', requireAuth, requireRole('manager'), commentController.listManagedComments);

app.use(errorHandler);

module.exports = app;
