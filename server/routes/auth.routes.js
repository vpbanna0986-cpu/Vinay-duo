const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const v = require('../utils/validators');
const { authLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');

router.post('/register', authLimiter, validate(v.registerSchema), ctrl.register);
router.post('/login',    authLimiter, validate(v.loginSchema),    ctrl.login);
router.post('/logout',   requireAuth, ctrl.logout);
router.get('/me',        requireAuth, ctrl.me);

module.exports = router;
