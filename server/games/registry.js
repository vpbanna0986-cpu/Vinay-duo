/**
 * Game registry.
 * Each game registers a definition with lifecycle hooks:
 *   - totalRounds: number
 *   - onStart(engine): called when PLAYING begins
 *   - onRoundStart(engine): optional
 *   - handleAction(engine, { userId, action, payload }): server-side validation & scoring
 *   - onFinish(engine): return { details }
 */
const definitions = new Map();

function register(key, def) {
  if (definitions.has(key)) return;
  definitions.set(key, def);
}

function get(key) {
  return definitions.get(key) || null;
}

function has(key) {
  return definitions.has(key);
}

function list() {
  return Array.from(definitions.keys());
}

module.exports = { register, get, has, list };
