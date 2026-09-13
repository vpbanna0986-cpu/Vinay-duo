const router = require('express').Router();
const ctrl = require('../controllers/room.controller');
const validate = require('../middleware/validate');
const v = require('../utils/validators');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.post('/',       ctrl.create);
router.post('/join',   validate(v.joinRoomSchema), ctrl.join);
router.get('/current', ctrl.current);
router.post('/leave',  ctrl.leave);

module.exports = router;
