const express = require('express');
const customerController = require('../controllers/customerController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// RULE-CUSTOMER-003: 등록/수정 라우트는 의도적으로 만들지 않는다(DB 직접 관리).
router.get('/', requireAuth, customerController.list);
// RULE-KNOWHOW-001: 역할 제한 없음 — 영업사원/팀장 모두 조회 가능.
router.get('/:id/knowhow', requireAuth, customerController.knowhow);

module.exports = router;
