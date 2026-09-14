const gameService = require('../services/game.service');
const roomService = require('../services/room.service');
const registry = require('../games/registry');

async function listGames(req, res, next) {
  try {
    const { rows } = await require('../config/db').query(
      `SELECT key, title, category, metadata FROM games WHERE is_active=TRUE ORDER BY category, title`
    );
    // Mark which ones have registered definitions (playable)
    const list = rows.map(r => ({ ...r, playable: registry.has(r.key) }));
    res.json({ ok: true, games: list });
  } catch (e) { next(e); }
}

async function recentResults(req, res, next) {
  try {
    const room = await roomService.getRoomForUser(req.user.id);
    if (!room) return res.json({ ok: true, results: [] });
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const results = await gameService.getRecentResults(room.id, limit);
    res.json({ ok: true, results });
  } catch (e) { next(e); }
}

module.exports = { listGames, recentResults };
