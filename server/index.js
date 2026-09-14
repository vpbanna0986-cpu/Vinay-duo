const registry = require('./registry');

// ── Speed / Reaction ──
registry.register('reaction_battle', require('./reaction_battle'));
registry.register('ten_second', require('./ten_second'));
registry.register('flash_grid', require('./flash_grid'));

// ── Memory / Brain ── (next batch)
// ── Word / Creative ── (next batch)
// ── Head-to-Head ── (next batch)
// ── Social / Random ── (next batch)

module.exports = registry;
