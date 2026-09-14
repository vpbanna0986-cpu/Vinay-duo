const { EventEmitter } = require('events');
const logger = require('../utils/logger');

const STATES = {
  WAITING: 'waiting',
  READY: 'ready',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  FINISHING: 'finishing',
  RESULT: 'result',
  CANCELLED: 'cancelled'
};

/**
 * Universal Game Engine
 * One session = one live match between 2 players.
 * Games register handlers and react to lifecycle events.
 */
class GameEngine extends EventEmitter {
  constructor({ sessionId, gameKey, playerAId, playerBId, definition, io }) {
    super();
    this.sessionId = sessionId;
    this.gameKey = gameKey;
    this.playerAId = playerAId;
    this.playerBId = playerBId;
    this.definition = definition;
    this.io = io;

    this.state = STATES.WAITING;
    this.createdAt = Date.now();
    this.startedAt = null;
    this.endedAt = null;

    this.scores = { [playerAId]: 0, [playerBId]: 0 };
    this.round = 0;
    this.totalRounds = definition.totalRounds || 1;

    this.timers = new Set();
    this.closed = false;

    // Game-specific state
    this.state_blob = {};
  }

  toJSON() {
    return {
      sessionId: this.sessionId,
      gameKey: this.gameKey,
      state: this.state,
      playerAId: this.playerAId,
      playerBId: this.playerBId,
      scores: this.scores,
      round: this.round,
      totalRounds: this.totalRounds,
      startedAt: this.startedAt,
      endedAt: this.endedAt
    };
  }

  emitToPlayers(event, payload) {
    if (!this.io) return;
    this.io.to(`user:${this.playerAId}`).emit(event, payload);
    this.io.to(`user:${this.playerBId}`).emit(event, payload);
  }

  setTimer(ms, fn) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      try { fn(); } catch (e) { logger.error('timer fn failed', e.message); }
    }, ms);
    this.timers.add(t);
    return t;
  }

  clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  async start() {
    if (this.state !== STATES.WAITING) return;
    this.state = STATES.READY;
    this.emitToPlayers('game:state', this.toJSON());

    // Countdown 3-2-1-GO
    this.state = STATES.COUNTDOWN;
    const countdownMs = 3000;
    this.emitToPlayers('game:countdown', {
      sessionId: this.sessionId,
      gameKey: this.gameKey,
      startsAt: Date.now() + countdownMs,
      countdownMs
    });

    this.setTimer(countdownMs, () => this.beginPlaying());
  }

  async beginPlaying() {
    if (this.state !== STATES.COUNTDOWN) return;
    this.state = STATES.PLAYING;
    this.startedAt = Date.now();
    this.round = 1;
    this.emitToPlayers('game:playing', {
      sessionId: this.sessionId,
      gameKey: this.gameKey,
      startedAt: this.startedAt,
      round: this.round,
      totalRounds: this.totalRounds
    });

    // Delegate to game definition
    try {
      await this.definition.onStart(this);
    } catch (e) {
      logger.error(`game.onStart failed [${this.gameKey}]:`, e.message);
      this.cancel('GAME_ERROR');
    }
  }

  // Called by game when a round is complete
  roundComplete() {
    if (this.state !== STATES.PLAYING) return;
    this.round++;
    if (this.round > this.totalRounds) {
      this.finish();
    } else {
      this.emitToPlayers('game:round-start', {
        sessionId: this.sessionId,
        round: this.round,
        totalRounds: this.totalRounds
      });
      this.definition.onRoundStart?.(this);
    }
  }

  // Player submits an action (server-authoritative)
  async handleAction({ userId, action, payload }) {
    if (this.state !== STATES.PLAYING) return { ok: false, error: 'NOT_PLAYING' };
    if (userId !== this.playerAId && userId !== this.playerBId) {
      return { ok: false, error: 'NOT_A_PLAYER' };
    }
    if (!this.definition.handleAction) {
      return { ok: false, error: 'NOT_SUPPORTED' };
    }
    try {
      const result = await this.definition.handleAction(this, { userId, action, payload });
      return result || { ok: true };
    } catch (e) {
      logger.error(`handleAction failed [${this.gameKey}]:`, e.message);
      return { ok: false, error: 'ACTION_FAILED' };
    }
  }

  awardPoints(userId, points) {
    if (!(userId in this.scores)) return;
    this.scores[userId] += Number(points) || 0;
    this.emitToPlayers('game:score', {
      sessionId: this.sessionId,
      scores: this.scores
    });
  }

  async finish() {
    if (this.state === STATES.RESULT || this.state === STATES.CANCELLED) return;
    this.state = STATES.FINISHING;
    this.emitToPlayers('game:state', this.toJSON());

    let result;
    try {
      result = await this.definition.onFinish?.(this) || {};
    } catch (e) {
      logger.error(`onFinish failed [${this.gameKey}]:`, e.message);
      result = {};
    }

    this.endedAt = Date.now();
    this.state = STATES.RESULT;

    const scoreA = this.scores[this.playerAId];
    const scoreB = this.scores[this.playerBId];
    let winnerId = null;
    let isTie = false;

    if (scoreA === scoreB) isTie = true;
    else winnerId = scoreA > scoreB ? this.playerAId : this.playerBId;

    const finalResult = {
      sessionId: this.sessionId,
      gameKey: this.gameKey,
      playerAId: this.playerAId,
      playerBId: this.playerBId,
      scoreA,
      scoreB,
      winnerId,
      isTie,
      details: result.details || {},
      endedAt: this.endedAt
    };

    this.emitToPlayers('game:result', finalResult);
    this.emit('finished', finalResult);

    this.clearTimers();
    this.closed = true;
  }

  cancel(reason) {
    if (this.closed) return;
    this.state = STATES.CANCELLED;
    this.emitToPlayers('game:cancelled', { sessionId: this.sessionId, reason });
    this.clearTimers();
    this.closed = true;
  }
}

module.exports = { GameEngine, STATES };
