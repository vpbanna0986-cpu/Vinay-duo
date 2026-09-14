const gameService = require('../services/game.service');
const roomService = require('../services/room.service');
const challengeService = require('../services/challenge.service');
const registry = require('../games/registry');
const logger = require('../utils/logger');

function registerGame(io, socket) {
  const userId = socket.user.id;

  // ── Start a game from an accepted challenge ──
  socket.on('game:start', async (payload, ack) => {
    try {
      const { challengeId } = payload || {};
      if (!challengeId) return ack?.({ ok: false, error: 'MISSING_CHALLENGE' });

      const room = await roomService.getRoomForUser(userId);
      if (!room) return ack?.({ ok: false, error: 'NO_ROOM' });

      // Fetch the challenge
      const ch = await challengeService.getActiveChallenge(room.id);
      if (!ch || ch.id !== challengeId) {
        return ack?.({ ok: false, error: 'CHALLENGE_NOT_FOUND' });
      }
      if (ch.status !== 'accepted') {
        return ack?.({ ok: false, error: 'CHALLENGE_NOT_ACCEPTED' });
      }
      if (!registry.has(ch.game_key)) {
        return ack?.({ ok: false, error: 'GAME_NOT_REGISTERED' });
      }

      // Ensure both players are in the room
      if (userId !== ch.challenger_id && userId !== ch.opponent_id) {
        return ack?.({ ok: false, error: 'NOT_A_PLAYER' });
      }

      // Update challenge status to active
      await challengeService.markActive({ challengeId: ch.id });

      const session = await gameService.createSession({
        roomId: room.id,
        gameKey: ch.game_key,
        playerAId: ch.challenger_id,
        playerBId: ch.opponent_id,
        challengeId: ch.id
      });

      // Broadcast session info
      io.to(`room:${room.id}`).emit('game:session-created', {
        sessionId: session.id,
        gameKey: ch.game_key
      });

      await gameService.startEngine(session, io);

      ack?.({ ok: true, sessionId: session.id });
    } catch (e) {
      logger.error('game:start failed:', e.message);
      ack?.({ ok: false, error: e.code || 'START_FAILED' });
    }
  });

  // ── Player action during a game ──
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

  // ── Client requests to resync live game state ──
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

  // ── Cancel / forfeit ──
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
