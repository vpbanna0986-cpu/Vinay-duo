const router = require('express').Router();
const ctrl = require('../controllers/chat.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/history', ctrl.getHistory);

module.exports = router;
