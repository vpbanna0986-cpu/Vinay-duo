/* ═══════════════════════════════════════════════════════
   VINAY DUO — Game Socket Events
   Made by VP
   ═══════════════════════════════════════════════════════ */

const db = require('../config/db');
const gameService = require('../services/game.service');
const roomService = require('../services/room.service');
const challengeService = require('../services/challenge.service');
const registry = require('../games/registry');
const logger = require('../utils/logger');

function registerGame(io, socket) {
  const userId = socket.user.id;

  // ─── Start a game from an accepted challenge ───
  socket.on('game:start', async (payload, ack) => {
    try {
      const { challengeId } = payload || {};
      if (!challengeId) return ack?.({ ok: false, error: 'MISSING_CHALLENGE' });

      const room = await roomService.getRoomForUser(userId);
      if (!room) return ack?.({ ok: false, error: 'NO_ROOM' });

      // ✅ Fetch challenge DIRECTLY by id (not by room-active filter)
      const { rows: chRows } = await db.query(
        `SELECT * FROM challenges WHERE id = $1`,
        [challengeId]
      );
      const ch = chRows[0];
      if (!ch) return ack?.({ ok: false, error: 'CHALLENGE_NOT_FOUND' });
      if (ch.room_id !== room.id) return ack?.({ ok: false, error: 'CHALLENGE_NOT_IN_ROOM' });

      // ✅ Accept BOTH accepted + active (race-safe)
      if (!['accepted', 'active'].includes(ch.status)) {
        return ack?.({ ok: false, error: 'CHALLENGE_NOT_ACCEPTED', got: ch.status });
      }

      if (!registry.has(ch.game_key)) {
        return ack?.({ ok: false, error: 'GAME_NOT_REGISTERED' });
      }

      if (userId !== ch.challenger_id && userId !== ch.opponent_id) {
        return ack?.({ ok: false, error: 'NOT_A_PLAYER' });
      }

      // ✅ If a live session already exists for this challenge → reuse it
      const { rows: existing } = await db.query(
        `SELECT id FROM game_sessions
          WHERE challenge_id = $1 AND status IN ('waiting','ready','countdown','playing')
          LIMIT 1`,
        [ch.id]
      );
      if (existing.length > 0) {
        logger.info(`game:start reuse session=${existing[0].id}`);
        return ack?.({ ok: true, sessionId: existing[0].id, existing: true });
      }

      // Mark challenge active (idempotent)
      await challengeService.markActive({ challengeId: ch.id });

      const session = await gameService.createSession({
        roomId: room.id,
        gameKey: ch.game_key,
        playerAId: ch.challenger_id,
        playerBId: ch.opponent_id,
        challengeId: ch.id
      });

      io.to(`room:${room.id}`).emit('game:session-created', {
        sessionId: session.id,
        gameKey: ch.game_key
      });

      await gameService.startEngine(session, io);

      logger.info(`game:start OK session=${session.id} game=${ch.game_key}`);
      ack?.({ ok: true, sessionId: session.id });
    } catch (e) {
      logger.error('game:start failed:', e.message);
      ack?.({ ok: false, error: e.code || 'START_FAILED', message: e.message });
    }
  });

  // ─── Player action during a game ───
  socket.on('game:action', async (payload, ack) => {
    try {
      const { sessionId, action, payload: innerPayload } = payload || {};
      if (!sessionId || !action) return ack?.({ ok: false, error: 'BAD_REQUEST' });

      const result = await gameService.handleAction({
        sessionId, userId, action, payload: innerPayload
      });
      ack?.(result);
    } catch (e) {
      ack?.({ ok: false, error: 'ACTION_FAILED' });
    }
  });

  socket.on('game:state', async (payload, ack) => {
    try {
      const { sessionId } = payload || {};
      const engine = gameService.getEngine(sessionId);
      if (!engine) return ack?.({ ok: false, error: 'NOT_ACTIVE' });
      ack?.({ ok: true, state: engine.toJSON() });
    } catch (e) {
      ack?.({ ok: false, error: 'STATE_FAILED' });
    }
  });

  socket.on('game:cancel', async (payload, ack) => {
    try {
      const { sessionId } = payload || {};
      await gameService.cancelSession(sessionId, 'PLAYER_CANCELLED');
      ack?.({ ok: true });
    } catch (e) {
      ack?.({ ok: false, error: 'CANCEL_FAILED' });
    }
  });
}

module.exports = { registerGame };
