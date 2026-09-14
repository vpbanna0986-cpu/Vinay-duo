const challengeService = require('../services/challenge.service');
const roomService = require('../services/room.service');
const logger = require('../utils/logger');

function registerChallenge(io, socket) {
  const userId = socket.user.id;

  // ── Send challenge ──
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

      // Broadcast to entire room
      io.to(`room:${room.id}`).emit('challenge:new', ch);

      ack?.({ ok: true, challenge: ch });
    } catch (e) {
      logger.error('challenge:send failed:', e.message);
      ack?.({ ok: false, error: e.code || 'SEND_FAILED', message: e.message });
    }
  });

  // ── Accept / Decline ──
  socket.on('challenge:respond', async (payload, ack) => {
    try {
      const { challengeId, accept } = payload || {};
      const updated = await challengeService.respondToChallenge({
        challengeId, userId, accept: !!accept
      });

      io.to(`room:${updated.room_id}`).emit('challenge:updated', updated);

      // If accepted, kick off game start
      if (updated.status === 'accepted') {
        io.to(`room:${updated.room_id}`).emit('game:launch', {
          challengeId: updated.id,
          gameKey: updated.game_key,
          playerAId: updated.challenger_id,
          playerBId: updated.opponent_id,
          countdownMs: 3000
        });
      }

      ack?.({ ok: true, challenge: updated });
    } catch (e) {
      ack?.({ ok: false, error: e.code || 'RESPOND_FAILED', message: e.message });
    }
  });

  // ── Cancel ──
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

  // ── Get current active challenge ──
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
