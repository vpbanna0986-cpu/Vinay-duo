require('dotenv').config();

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env: ${name}`);
  return v;
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 10000),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || '*',
  DATABASE_URL: required('DATABASE_URL'),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
  COOKIE_NAME: process.env.COOKIE_NAME || 'vd_token',
  CHAT_TTL_SECONDS: Number(process.env.CHAT_TTL_SECONDS || 7200),
  CLEANUP_INTERVAL_SECONDS: Number(process.env.CLEANUP_INTERVAL_SECONDS || 300),
  BRAND: { name: 'VINAY DUO', author: 'VP' }
};
