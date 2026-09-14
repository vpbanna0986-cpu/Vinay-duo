const db = require('../config/db');
const logger = require('../utils/logger');

const XP_WIN = 50;
const XP_LOSS = 15;
const XP_TIE = 30;

async function awardXP(userId, amount) {
  if (amount <= 0) return;
  await db.query(
    `UPDATE users
        SET xp = xp + $2,
            level = GREATEST(1, FLOOR((xp + $2) / 500) + 1),
            updated_at = NOW()
      WHERE id = $1`,
    [userId, amount]
  );
}

async function updateStats({ userId, won, tied }) {
  const update = tied
    ? `ties = ties + 1`
    : won
      ? `wins = wins + 1, current_streak = current_streak + 1, best_streak = GREATEST(best_streak, current_streak + 1)`
      : `losses = losses + 1, current_streak = 0`;

  await db.query(
    `UPDATE player_stats
        SET games_played = games_played + 1,
            ${update},
            updated_at = NOW()
      WHERE user_id = $1`,
    [userId]
  );
}

async function unlockAchievement(userId, key) {
  const { rowCount } = await db.query(
    `INSERT INTO player_achievements (user_id, achievement_key)
     VALUES ($1, $2)
     ON CONFLICT (user_id, achievement_key) DO NOTHING`,
    [userId, key]
  );
  if (rowCount === 0) return false;

  const { rows } = await db.query(
    `SELECT key, title, description, icon, xp_reward FROM achievements WHERE key=$1`,
    [key]
  );
  if (rows[0]) {
    await awardXP(userId, rows[0].xp_reward || 0);
  }
  return rows[0] || true;
}

async function checkAutoAchievements(userId) {
  const unlocked = [];

  const stats = await db.query(
    `SELECT wins, best_streak, games_played FROM player_stats WHERE user_id=$1`,
    [userId]
  );
  const s = stats.rows[0] || {};

  if (s.wins >= 1) {
    const a = await unlockAchievement(userId, 'first_win');
    if (a && a !== true) unlocked.push(a);
  }
  if (s.best_streak >= 5) {
    const a = await unlockAchievement(userId, 'streak_5');
    if (a && a !== true) unlocked.push(a);
  }
  if (s.games_played >= 100) {
    const a = await unlockAchievement(userId, 'games_100');
    if (a && a !== true) unlocked.push(a);
  }
  return unlocked;
}

async function processMatchResult(finalResult) {
  const { playerAId, playerBId, winnerId, isTie } = finalResult;
  const players = [playerAId, playerBId];

  for (const uid of players) {
    const won = !isTie && winnerId === uid;
    const tied = isTie;

    const xp = tied ? XP_TIE : won ? XP_WIN : XP_LOSS;
    await awardXP(uid, xp);
    await updateStats({ userId: uid, won, tied });
  }

  // Achievement unlocks
  const unlockedByUser = {};
  for (const uid of players) {
    try {
      const unlocked = await checkAutoAchievements(uid);
      if (unlocked.length) unlockedByUser[uid] = unlocked;
    } catch (e) {
      logger.error('achievement check failed:', e.message);
    }
  }
  return unlockedByUser;
}

module.exports = {
  awardXP, updateStats, unlockAchievement, processMatchResult, checkAutoAchievements,
  XP_WIN, XP_LOSS, XP_TIE
};
