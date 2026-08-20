const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// 인증 자체를 하는 라우트이므로 requireAuth/requireRole을 걸지 않는다.
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
// 프론트엔드가 새로고침 시 세션 상태(로그인 여부/role)를 확인하기 위한 엔드포인트.
router.get('/me', requireAuth, authController.me);

module.exports = router;
