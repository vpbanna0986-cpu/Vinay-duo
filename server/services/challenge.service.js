const db = require('../config/db');
const roomService = require('./room.service');
const { badRequest, forbidden, notFound, conflict } = require('../utils/errors');

const CHALLENGE_TTL_MINUTES = 10;

async function createChallenge({ roomId, challengerId, gameKey }) {
  await roomService.assertMember(roomId, challengerId);

  // Get the opponent
  const { rows: members } = await db.query(
    `SELECT user_id FROM room_members WHERE room_id=$1`,
    [roomId]
  );
  if (members.length < 2) throw badRequest('Room needs 2 members');
  const opponentId = members.find(m => m.user_id !== challengerId)?.user_id;
  if (!opponentId) throw badRequest('No opponent found');

  // Check game exists
  const { rowCount: gameExists } = await db.query(
    `SELECT 1 FROM games WHERE key=$1 AND is_active=TRUE`,
    [gameKey]
  );
  if (!gameExists) throw notFound('Game not found');

  // Cancel any existing pending challenge in this room
  await db.query(
    `UPDATE challenges
        SET status='cancelled'
      WHERE room_id=$1 AND status='pending'`,
    [roomId]
  );

  const { rows } = await db.query(
    `INSERT INTO challenges (room_id, challenger_id, opponent_id, game_key, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${CHALLENGE_TTL_MINUTES} minutes')
     RETURNING *`,
    [roomId, challengerId, opponentId, gameKey]
  );
  return rows[0];
}

async function respondToChallenge({ challengeId, userId, accept }) {
  const { rows } = await db.query(
    `SELECT * FROM challenges WHERE id=$1`,
    [challengeId]
  );
  const ch = rows[0];
  if (!ch) throw notFound('Challenge not found');
  if (ch.opponent_id !== userId) throw forbidden('Not your challenge');
  if (ch.status !== 'pending') throw conflict(`Challenge is ${ch.status}`);
  if (new Date(ch.expires_at) < new Date()) {
    await db.query(`UPDATE challenges SET status='expired' WHERE id=$1`, [challengeId]);
    throw badRequest('Challenge expired');
  }

  const newStatus = accept ? 'accepted' : 'declined';
  const { rows: updated } = await db.query(
    `UPDATE challenges
        SET status=$2, responded_at=NOW()
      WHERE id=$1
      RETURNING *`,
    [challengeId, newStatus]
  );
  return updated[0];
}

async function getActiveChallenge(roomId) {
  const { rows } = await db.query(
    `SELECT * FROM challenges
      WHERE room_id=$1
        AND status IN ('pending','accepted','active')
        AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1`,
    [roomId]
  );
  return rows[0] || null;
}

async function cancelChallenge({ challengeId, userId }) {
  const { rows } = await db.query(
    `SELECT * FROM challenges WHERE id=$1`,
    [challengeId]
  );
  const ch = rows[0];
  if (!ch) throw notFound('Challenge not found');
  if (ch.challenger_id !== userId && ch.opponent_id !== userId) {
    throw forbidden('Not your challenge');
  }
  if (ch.status !== 'pending' && ch.status !== 'accepted') {
    throw conflict('Cannot cancel');
  }
  await db.query(
    `UPDATE challenges SET status='cancelled' WHERE id=$1`,
    [challengeId]
  );
  return { ok: true, challengeId };
}

async function markActive({ challengeId }) {
  await db.query(
    `UPDATE challenges SET status='active' WHERE id=$1 AND status='accepted'`,
    [challengeId]
  );
}

async function markCompleted({ challengeId }) {
  await db.query(
    `UPDATE challenges
        SET status='completed', completed_at=NOW()
      WHERE id=$1`,
    [challengeId]
  );
  await db.query(
    `UPDATE player_stats
        SET challenges_completed = challenges_completed + 1,
            updated_at = NOW()
      WHERE user_id = (SELECT challenger_id FROM challenges WHERE id=$1)
         OR user_id = (SELECT opponent_id FROM challenges WHERE id=$1)`,
    [challengeId]
  );
}

async function expireStale() {
  const { rowCount } = await db.query(
    `UPDATE challenges
        SET status='expired'
      WHERE status='pending' AND expires_at < NOW()`
  );
  return rowCount;
}

module.exports = {
  createChallenge, respondToChallenge, getActiveChallenge,
  cancelChallenge, markActive, markCompleted, expireStale
};
