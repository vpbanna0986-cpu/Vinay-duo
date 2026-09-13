const db = require('../config/db');

async function getPublicProfile(userId) {
  const { rows } = await db.query(
    `SELECT id, username, display_name, avatar_url, xp, level, is_online, last_active_at, created_at
       FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
}

async function getStats(userId) {
  const { rows } = await db.query(
    `SELECT * FROM player_stats WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

async function getAchievements(userId) {
  const { rows } = await db.query(
    `SELECT a.key, a.title, a.description, a.icon, a.xp_reward, pa.unlocked_at
       FROM player_achievements pa
       JOIN achievements a ON a.key = pa.achievement_key
      WHERE pa.user_id = $1
      ORDER BY pa.unlocked_at DESC`,
    [userId]
  );
  return rows;
}

async function getMatchHistory(userId, limit = 25) {
  const { rows } = await db.query(
    `SELECT gr.id, gr.game_key, g.title AS game_title, gr.score_a, gr.score_b,
            gr.winner_id, gr.is_tie, gr.created_at, gr.player_a_id, gr.player_b_id
       FROM game_results gr
       JOIN games g ON g.key = gr.game_key
      WHERE gr.player_a_id = $1 OR gr.player_b_id = $1
      ORDER BY gr.created_at DESC
      LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

module.exports = { getPublicProfile, getStats, getAchievements, getMatchHistory };
