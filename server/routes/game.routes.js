/* ═══════════════════════════════════════════════════════
   VINAY DUO — Game Routes
   Made by VP
   ═══════════════════════════════════════════════════════ */

const router = require('express').Router();
const ctrl = require('../controllers/game.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/list', ctrl.listGames);
router.get('/results', ctrl.recentResults);
router.post('/action', ctrl.action);      // ✅ NEW — reliable HTTP action

module.exports = router;
