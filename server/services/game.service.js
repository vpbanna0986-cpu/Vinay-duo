/* ═══════════════════════════════════════════════════════
   VINAY DUO — Game Service (Session + Engine Bridge)
   Made by VP
   ═══════════════════════════════════════════════════════ */

const db = require('../config/db');
const roomService = require('./room.service');
const xpService = require('./xp.service');
const { GameEngine } = require('../games/engine');
const registry = require('../games/registry');
const logger = require('../utils/logger');

const liveSessions = new Map();

async function createSession({ roomId, gameKey, playerAId, playerBId, challengeId }) {
  await roomService.assertMember(roomId, playerAId);
  await roomService.assertMember(roomId, playerBId);

  const { rows } = await db.query(
    `INSERT INTO game_sessions (room_id, challenge_id, game_key, status, player_a_id, player_b_id)
     VALUES ($1, $2, $3, 'waiting', $4, $5)
     RETURNING *`,
    [roomId, challengeId || null, gameKey, playerAId, playerBId]
  );
  return rows[0];
}

async function startEngine(sessionRow, io) {
  const def = registry.get(sessionRow.game_key);
  if (!def) throw new Error(`Game not registered: ${sessionRow.game_key}`);

  const engine = new GameEngine({
    sessionId: sessionRow.id,
    gameKey: sessionRow.game_key,
    playerAId: sessionRow.player_a_id,
    playerBId: sessionRow.player_b_id,
    definition: def,
    io
  });

  engine.on('finished', async (result) => {
    try {
      await persistResult(result);
      const unlocked = await xpService.processMatchResult(result);
      for (const [uid, list] of Object.entries(unlocked)) {
        io.to(`user:${uid}`).emit('achievement:unlocked', { achievements: list });
      }
    } catch (e) {
      logger.error('persistResult failed:', e.message);
    } finally {
      liveSessions.delete(sessionRow.id);
    }
  });

  liveSessions.set(sessionRow.id, engine);

  await db.query(
    `UPDATE game_sessions SET status='countdown', started_at=NOW() WHERE id=$1`,
    [sessionRow.id]
  );

  engine.start();
  return engine;
}

async function persistResult(result) {
  await db.query(
    `INSERT INTO game_results
       (session_id, room_id, game_key, player_a_id, player_b_id,
        score_a, score_b, winner_id, is_tie, details)
     VALUES ($1, (SELECT room_id FROM game_sessions WHERE id=$1), $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      result.sessionId, result.gameKey, result.playerAId, result.playerBId,
      result.scoreA, result.scoreB, result.winnerId, result.isTie,
      result.details || {}
    ]
  );
  await db.query(
    `UPDATE game_sessions SET status='result', ended_at=NOW(), state=$2 WHERE id=$1`,
    [result.sessionId, JSON.stringify(result)]
  );
}

function getEngine(sessionId) {
  return liveSessions.get(sessionId) || null;
}

async function handleAction({ sessionId, userId, action, payload }) {
  const engine = liveSessions.get(sessionId);
  if (!engine) return { ok: false, error: 'SESSION_NOT_ACTIVE' };
  return engine.handleAction({ userId, action, payload });
}

async function cancelSession(sessionId, reason) {
  const engine = liveSessions.get(sessionId);
  if (engine) engine.cancel(reason);
  liveSessions.delete(sessionId);
  await db.query(
    `UPDATE game_sessions SET status='cancelled', ended_at=NOW() WHERE id=$1`,
    [sessionId]
  );
}

async function getRecentResults(roomId, limit = 20) {
  const { rows } = await db.query(
    `SELECT gr.*, g.title AS game_title
       FROM game_results gr
       JOIN games g ON g.key = gr.game_key
      WHERE gr.room_id = $1
      ORDER BY gr.created_at DESC LIMIT $2`,
    [roomId, limit]
  );
  return rows;
}

module.exports = {
  createSession, startEngine, persistResult, getEngine,
  handleAction, cancelSession, getRecentResults,
  liveSessions
};
