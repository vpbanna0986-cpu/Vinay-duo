const db = require('../config/db');
const env = require('../config/env');
const logger = require('../utils/logger');

let timer = null;
let running = false;

async function runOnce() {
  if (running) return;
  running = true;
  try {
    // Delete expired reactions
    const r1 = await db.query(
      `DELETE FROM message_reactions WHERE expires_at < NOW()`
    );

    // Delete expired media rows (files in storage handled separately)
    const r2 = await db.query(
      `DELETE FROM message_media WHERE expires_at < NOW()`
    );

    // Delete expired messages (CASCADE removes reactions + media rows too)
    const r3 = await db.query(
      `DELETE FROM messages WHERE expires_at < NOW()`
    );

    if (r1.rowCount || r2.rowCount || r3.rowCount) {
      logger.info(`cleanup: reactions=${r1.rowCount} media=${r2.rowCount} messages=${r3.rowCount}`);
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
  // Run once immediately on startup
  runOnce();
  logger.info(`cleanup job started (interval=${env.CLEANUP_INTERVAL_SECONDS}s)`);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop, runOnce };
