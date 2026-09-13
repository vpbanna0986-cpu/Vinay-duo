const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { unauthorized } = require('../utils/errors');
const db = require('../config/db');

function extractToken(req) {
  if (req.cookies && req.cookies[env.COOKIE_NAME]) return req.cookies[env.COOKIE_NAME];
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

async function requireAuth(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw unauthorized();
    const payload = jwt.verify(token, env.JWT_SECRET);
    const { rows } = await db.query(
      'SELECT id, username, display_name, avatar_url, xp, level, is_online FROM users WHERE id = $1',
      [payload.sub]
    );
    if (!rows[0]) throw unauthorized();
    req.user = rows[0];
    next();
  } catch (e) {
    next(unauthorized('Invalid or expired session'));
  }
}

module.exports = { requireAuth, extractToken };
