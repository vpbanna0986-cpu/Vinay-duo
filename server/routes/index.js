const router = require('express').Router();
const env = require('../config/env');

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    app: env.BRAND.name,
    author: env.BRAND.author,
    time: new Date().toISOString()
  });
});

router.use('/auth',  require('./auth.routes'));
router.use('/rooms', require('./room.routes'));
router.use('/users', require('./user.routes'));

module.exports = router;
