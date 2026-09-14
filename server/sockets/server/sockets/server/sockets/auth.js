const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const logger = require('../utils/logger');

async function socketAuth(socket, next) {
  try {
    let token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token;

    if (!token && socket.handshake.headers.cookie) {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      token = cookies[env.COOKIE_NAME];
    }

    if (!token) {
      return next(new Error('AUTH_REQUIRED'));
    }

    const payload = jwt.verify(token, env.JWT_SECRET);

    const { rows } = await db.query(
      `SELECT id, username, display_name, avatar_url, xp, level
         FROM users WHERE id = $1`,
      [payload.sub]
    );

    if (!rows[0]) return next(new Error('USER_NOT_FOUND'));

    socket.user = rows[0];
    next();
  } catch (err) {
    logger.warn('socket auth failed:', err.message);
    next(new Error('AUTH_FAILED'));
  }
}

function parseCookies(cookieHeader) {
  const out = {};
  cookieHeader.split(';').forEach(pair => {
    const [k, ...v] = pair.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('='));
  });
  return out;
}

module.exports = { socketAuth };
