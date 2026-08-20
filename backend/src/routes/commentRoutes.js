const express = require('express');
const commentController = require('../controllers/commentController');
const { requireAuth } = require('../middleware/auth');

// mergeParams: true 필수 — app.js에서 '/api/sales-logs/:id/comments'로 중첩 마운트되므로
// 이 라우터 안에서 req.params.id로 영업일지 id에 접근하려면 반드시 필요하다.
const router = express.Router({ mergeParams: true });

// 세부 권한(작성자 본인/담당 팀장 여부)은 role별로 완전히 다른 로직이라
// requireRole로 단순 게이팅할 수 없다 — commentService에서 판단해 403을 던진다.
router.get('/', requireAuth, commentController.list);
router.post('/', requireAuth, commentController.create);

module.exports = router;
