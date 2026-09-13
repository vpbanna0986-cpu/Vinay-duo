const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/env');
const { conflict, unauthorized } = require('../utils/errors');

const SALT_ROUNDS = 12;

async function register({ username, displayName, password }) {
  const exists = await db.query('SELECT 1 FROM users WHERE LOWER(username)=LOWER($1)', [username]);
  if (exists.rowCount) throw conflict('Username taken');

  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  const { rows } = await db.tx(async (client) => {
    const u = await client.query(
      `INSERT INTO users (username, display_name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, display_name, avatar_url, xp, level`,
      [username, displayName, hash]
    );
    await client.query(
      `INSERT INTO player_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [u.rows[0].id]
    );
    return u;
  });

  return issueSession(rows[0]);
}

async function login({ username, password }) {
  const { rows } = await db.query(
    `SELECT id, username, display_name, password_hash, avatar_url, xp, level
       FROM users WHERE LOWER(username)=LOWER($1)`,
    [username]
  );
  const u = rows[0];
  if (!u) throw unauthorized('Invalid credentials');
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) throw unauthorized('Invalid credentials');
  delete u.password_hash;
  return issueSession(u);
}

function issueSession(user) {
  const token = jwt.sign({ sub: user.id, username: user.username }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN
  });
  return { token, user };
}

async function touchOnline(userId, isOnline) {
  await db.query(
    `UPDATE users SET is_online=$2, last_active_at=NOW(), updated_at=NOW() WHERE id=$1`,
    [userId, isOnline]
  );
}

module.exports = { register, login, issueSession, touchOnline };
