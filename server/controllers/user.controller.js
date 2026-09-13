const userService = require('../services/user.service');

async function getProfile(req, res, next) {
  try {
    const profile = await userService.getPublicProfile(req.params.id);
    if (!profile) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    const [stats, achievements] = await Promise.all([
      userService.getStats(req.params.id),
      userService.getAchievements(req.params.id)
    ]);
    res.json({ ok: true, profile, stats, achievements });
  } catch (e) { next(e); }
}

async function meFull(req, res, next) {
  try {
    const [stats, achievements, history] = await Promise.all([
      userService.getStats(req.user.id),
      userService.getAchievements(req.user.id),
      userService.getMatchHistory(req.user.id, 25)
    ]);
    res.json({ ok: true, user: req.user, stats, achievements, history });
  } catch (e) { next(e); }
}

module.exports = { getProfile, meFull };
