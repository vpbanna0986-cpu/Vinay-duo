/* ═══════════════════════════════════════════════════════
   VINAY DUO — Challenge Socket Events
   Made by VP
   ═══════════════════════════════════════════════════════ */

const challengeService = require('../services/challenge.service');
const roomService = require('../services/room.service');
const logger = require('../utils/logger');

function registerChallenge(io, socket) {
  const userId = socket.user.id;

  socket.on('challenge:send', async (payload, ack) => {
    try {
      const room = await roomService.getRoomForUser(userId);
      if (!room) return ack?.({ ok: false, error: 'NO_ROOM' });
      const { gameKey } = payload || {};
      if (!gameKey) return ack?.({ ok: false, error: 'MISSING_GAME' });

      const ch = await challengeService.createChallenge({
        roomId: room.id,
        challengerId: userId,
        gameKey
      });

      io.to(`room:${room.id}`).emit('challenge:new', ch);

      ack?.({ ok: true, challenge: ch });
    } catch (e) {
      logger.error('challenge:send failed:', e.message);
      ack?.({ ok: false, error: e.code || 'SEND_FAILED', message: e.message });
    }
  });

  socket.on('challenge:respond', async (payload, ack) => {
    try {
      const { challengeId, accept } = payload || {};
      const updated = await challengeService.respondToChallenge({
        challengeId, userId, accept: !!accept
      });

      // Broadcast updated challenge to both players
      io.to(`room:${updated.room_id}`).emit('challenge:updated', updated);

      // If accepted, ALSO emit game:launch signal with challenge data
      if (updated.status === 'accepted') {
        io.to(`room:${updated.room_id}`).emit('game:launch', {
          challengeId: updated.id,
          gameKey: updated.game_key,
          playerAId: updated.challenger_id,
          playerBId: updated.opponent_id,
          countdownMs: 3000
        });
        logger.info(`challenge accepted → game:launch for challenge=${updated.id}`);
      }

      ack?.({ ok: true, challenge: updated });
    } catch (e) {
      logger.error('challenge:respond failed:', e.message);
      ack?.({ ok: false, error: e.code || 'RESPOND_FAILED', message: e.message });
    }
  });

  socket.on('challenge:cancel', async (payload, ack) => {
    try {
      const { challengeId } = payload || {};
      const result = await challengeService.cancelChallenge({ challengeId, userId });
      const room = await roomService.getRoomForUser(userId);
      if (room) {
        io.to(`room:${room.id}`).emit('challenge:cancelled', result);
      }
      ack?.({ ok: true });
    } catch (e) {
      ack?.({ ok: false, error: e.code || 'CANCEL_FAILED' });
    }
  });

  socket.on('challenge:current', async (payload, ack) => {
    try {
      const room = await roomService.getRoomForUser(userId);
      if (!room) return ack?.({ ok: true, challenge: null });
      const ch = await challengeService.getActiveChallenge(room.id);
      ack?.({ ok: true, challenge: ch });
    } catch (e) {
      ack?.({ ok: false, error: 'FETCH_FAILED' });
    }
  });
}

module.exports = { registerChallenge };
