const roomService = require('../services/room.service');

async function create(req, res, next) {
  try {
    const room = await roomService.createRoom(req.user.id);
    const full = await roomService.attachMembers(room);
    res.json({ ok: true, room: full });
  } catch (e) { next(e); }
}

async function join(req, res, next) {
  try {
    const room = await roomService.joinRoom(req.user.id, req.body.code);
    const full = await roomService.attachMembers(room);
    res.json({ ok: true, room: full });
  } catch (e) { next(e); }
}

async function current(req, res, next) {
  try {
    const room = await roomService.getRoomForUser(req.user.id);
    res.json({ ok: true, room });
  } catch (e) { next(e); }
}

async function leave(req, res, next) {
  try {
    const r = await roomService.leaveRoom(req.user.id);
    res.json({ ok: true, ...r });
  } catch (e) { next(e); }
}

module.exports = { create, join, current, leave };
