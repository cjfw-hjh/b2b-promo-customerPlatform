const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// 인증 자체를 하는 라우트이므로 requireAuth/requireRole을 걸지 않는다.
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

module.exports = router;
