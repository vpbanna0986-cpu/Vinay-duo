const challengeService = require('../services/challenge.service');
const roomService = require('../services/room.service');

async function current(req, res, next) {
  try {
    const room = await roomService.getRoomForUser(req.user.id);
    if (!room) return res.json({ ok: true, challenge: null });
    const ch = await challengeService.getActiveChallenge(room.id);
    res.json({ ok: true, challenge: ch });
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const room = await roomService.getRoomForUser(req.user.id);
    if (!room) return res.status(400).json({ ok: false, error: 'NO_ROOM' });
    const { gameKey } = req.body || {};
    if (!gameKey) return res.status(400).json({ ok: false, error: 'MISSING_GAME' });
    const ch = await challengeService.createChallenge({
      roomId: room.id,
      challengerId: req.user.id,
      gameKey
    });
    res.json({ ok: true, challenge: ch });
  } catch (e) { next(e); }
}

async function respond(req, res, next) {
  try {
    const { challengeId, accept } = req.body || {};
    const ch = await challengeService.respondToChallenge({
      challengeId, userId: req.user.id, accept: !!accept
    });
    res.json({ ok: true, challenge: ch });
  } catch (e) { next(e); }
}

module.exports = { current, create, respond };
