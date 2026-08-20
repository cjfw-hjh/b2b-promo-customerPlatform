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
