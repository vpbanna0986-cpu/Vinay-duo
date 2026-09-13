const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { requireAuth } = require('../middleware/auth');

router.get('/me/full', requireAuth, ctrl.meFull);
router.get('/:id',     requireAuth, ctrl.getProfile);

module.exports = router;
