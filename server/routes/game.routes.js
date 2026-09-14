const router = require('express').Router();
const ctrl = require('../controllers/game.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/list', ctrl.listGames);
router.get('/results', ctrl.recentResults);

module.exports = router;
