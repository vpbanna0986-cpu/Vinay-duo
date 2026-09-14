const db = require('../config/db');
const env = require('../config/env');
const logger = require('../utils/logger');
const challengeService = require('../services/challenge.service');

let timer = null;
let running = false;

async function runOnce() {
  if (running) return;
  running = true;
  try {
    const r1 = await db.query(`DELETE FROM message_reactions WHERE expires_at < NOW()`);
    const r2 = await db.query(`DELETE FROM message_media WHERE expires_at < NOW()`);
    const r3 = await db.query(`DELETE FROM messages WHERE expires_at < NOW()`);
    const expiredChallenges = await challengeService.expireStale();

    // Cancel stale waiting/countdown sessions older than 5 min
    const stale = await db.query(
      `UPDATE game_sessions
          SET status='cancelled', ended_at=NOW()
        WHERE status IN ('waiting','countdown')
          AND created_at < NOW() - INTERVAL '5 minutes'`
    );

    if (r1.rowCount || r2.rowCount || r3.rowCount || expiredChallenges || stale.rowCount) {
      logger.info(`cleanup: reactions=${r1.rowCount} media=${r2.rowCount} messages=${r3.rowCount} challenges_expired=${expiredChallenges} stale_sessions=${stale.rowCount}`);
    }
  } catch (e) {
    logger.error('cleanup failed:', e.message);
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  const intervalMs = env.CLEANUP_INTERVAL_SECONDS * 1000;
  timer = setInterval(runOnce, intervalMs);
  runOnce();
  logger.info(`cleanup job started (interval=${env.CLEANUP_INTERVAL_SECONDS}s)`);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { start, stop, runOnce };
