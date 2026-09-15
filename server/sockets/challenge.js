/* ═══════════════════════════════════════════════════════
   VINAY DUO — Challenge Socket Events
   Made by VP
   ═══════════════════════════════════════════════════════ */

const db = require('../config/db');
const challengeService = require('../services/challenge.service');
const roomService = require('../services/room.service');
const gameService = require('../services/game.service');
const registry = require('../games/registry');
const logger = require('../utils/logger');

function registerChallenge(io, socket) {
  const userId = socket.user.id;

  // ═══════════════════════════════════════════════════════
  //  challenge:send — Player A challenges Player B
  // ═══════════════════════════════════════════════════════
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

      logger.info(`challenge:send OK challenger=${userId} game=${gameKey} challenge=${ch.id}`);
      ack?.({ ok: true, challenge: ch });
    } catch (e) {
      logger.error('challenge:send failed:', e.message);
      ack?.({ ok: false, error: e.code || 'SEND_FAILED', message: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════
  //  challenge:respond — Player B accepts / declines
  //  ✅ On accept: create session + emit game:launch with sessionId
  // ═══════════════════════════════════════════════════════
  socket.on('challenge:respond', async (payload, ack) => {
    try {
      const { challengeId, accept } = payload || {};
      if (!challengeId) return ack?.({ ok: false, error: 'MISSING_CHALLENGE' });

      const updated = await challengeService.respondToChallenge({
        challengeId, userId, accept: !!accept
      });

      // Broadcast challenge update to both players
      io.to(`room:${updated.room_id}`).emit('challenge:updated', updated);

      // ✅ If accepted → create session and start game
      if (updated.status === 'accepted') {
        try {
          if (!registry.has(updated.game_key)) {
            logger.error(`challenge:respond — game not registered: ${updated.game_key}`);
            return ack?.({ ok: true, challenge: updated, warn: 'GAME_NOT_REGISTERED' });
          }

          // Check if session already exists (in case of double-accept race)
          const { rows: existing } = await db.query(
            `SELECT id FROM game_sessions
              WHERE challenge_id = $1
                AND status IN ('waiting','ready','countdown','playing')
              LIMIT 1`,
            [updated.id]
          );

          let session;
          if (existing.length > 0) {
            session = { id: existing[0].id };
            logger.info(`challenge:respond — reusing session=${session.id}`);
          } else {
            // Mark challenge as active
            await challengeService.markActive({ challengeId: updated.id });

            // Create session
            session = await gameService.createSession({
              roomId: updated.room_id,
              gameKey: updated.game_key,
              playerAId: updated.challenger_id,
              playerBId: updated.opponent_id,
              challengeId: updated.id
            });

            // Notify both players that session is created
            io.to(`room:${updated.room_id}`).emit('game:session-created', {
              sessionId: session.id,
              gameKey: updated.game_key
            });
          }

          // ✅ Emit game:launch WITH sessionId BEFORE engine starts
          // This way frontend mounts UI first, then receives game events
          io.to(`room:${updated.room_id}`).emit('game:launch', {
            sessionId: session.id,
            challengeId: updated.id,
            gameKey: updated.game_key,
            playerAId: updated.challenger_id,
            playerBId: updated.opponent_id,
            countdownMs: 3000
          });

          logger.info(`challenge:respond → game:launch emitted session=${session.id} game=${updated.game_key}`);

          // ✅ Start engine after short delay so frontend can mount overlay
          setTimeout(() => {
            gameService.startEngine(session, io)
              .then(() => logger.info(`challenge:respond → engine started session=${session.id}`))
              .catch(e => logger.error('startEngine failed:', e.message));
          }, 600);

        } catch (e) {
          logger.error('challenge:respond → game launch failed:', e.message);
        }
      }

      ack?.({ ok: true, challenge: updated });
    } catch (e) {
      logger.error('challenge:respond failed:', e.message);
      ack?.({ ok: false, error: e.code || 'RESPOND_FAILED', message: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════
  //  challenge:cancel — either player cancels
  // ═══════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════
  //  challenge:current — get active challenge
  // ═══════════════════════════════════════════════════════
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
