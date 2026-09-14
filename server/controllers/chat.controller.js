const chatService = require('../services/chat.service');
const roomService = require('../services/room.service');

async function getHistory(req, res, next) {
  try {
    const room = await roomService.getRoomForUser(req.user.id);
    if (!room) return res.json({ ok: true, messages: [] });

    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const messages = await chatService.getRecentMessages(room.id, limit);
    res.json({ ok: true, messages });
  } catch (e) { next(e); }
}

module.exports = { getHistory };
