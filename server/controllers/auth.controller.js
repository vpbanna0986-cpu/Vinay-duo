const authService = require('../services/auth.service');
const env = require('../config/env');

function setCookie(res, token) {
  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'none',
    secure: env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 30
  });
}

async function register(req, res, next) {
  try {
    const { token, user } = await authService.register(req.body);
    setCookie(res, token);
    res.json({ ok: true, token, user });
  } catch (e) { next(e); }
}

async function login(req, res, next) {
  try {
    const { token, user } = await authService.login(req.body);
    setCookie(res, token);
    res.json({ ok: true, token, user });
  } catch (e) { next(e); }
}

async function logout(req, res, next) {
  try {
    if (req.user) await authService.touchOnline(req.user.id, false);
    res.clearCookie(env.COOKIE_NAME);
    res.json({ ok: true });
  } catch (e) { next(e); }
}

async function me(req, res) {
  res.json({ ok: true, user: req.user });
}

module.exports = { register, login, logout, me };
