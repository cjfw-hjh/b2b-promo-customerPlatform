const express = require('express');
const salesLogController = require('../controllers/salesLogController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// UC-003(영업일지 작성)의 Actor는 영업사원뿐이다.
router.post('/', requireAuth, requireRole('salesperson'), salesLogController.create);
router.get('/', requireAuth, salesLogController.list);
router.get('/:id', requireAuth, salesLogController.getById);
router.patch('/:id', requireAuth, salesLogController.update);
router.delete('/:id', requireAuth, salesLogController.remove);

module.exports = router;
