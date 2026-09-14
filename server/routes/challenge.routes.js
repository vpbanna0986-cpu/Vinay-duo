const router = require('express').Router();
const ctrl = require('../controllers/challenge.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/current', ctrl.current);
router.post('/create', ctrl.create);
router.post('/respond', ctrl.respond);

module.exports = router;
