/* ═══════════════════════════════════════════════════════
   VINAY DUO — Reaction Battle (Final)
   Made by VP
   ═══════════════════════════════════════════════════════ */

module.exports = {
  totalRounds: 3,
  delays: [],
  startTimes: {},
  results: {},
  awarded: {},

  onStart(engine) {
    this.delays = Array.from({ length: 3 }, () => 2000 + Math.floor(Math.random() * 4000));
    this.startTimes = {};
    this.results = {};
    this.awarded = {};
    this.startRound(engine);
  },

  onRoundStart(engine) {
    this.startRound(engine);
  },

  startRound(engine) {
    const r = engine.round;
    const delay = this.delays[r - 1] || 3000;

    this.awarded[r] = false;
    this.results[r] = {};
    this.startTimes[r] = null;

    engine.emitToPlayers('game:reaction:wait', {
      round: r,
      totalRounds: this.totalRounds
    });

    engine.setTimer(delay, () => {
      this.startTimes[r] = Date.now();
      engine.emitToPlayers('game:reaction:go', {
        round: r,
        serverTs: this.startTimes[r]
      });

      // No-tap fallback after 9s
      engine.setTimer(9000, () => {
        if (!this.awarded[r]) {
          this.awarded[r] = true;
          this.finishRound(engine, r, null);
        }
      });
    });
  },

  handleAction(engine, { userId, action }) {
    if (action !== 'tap') return { ok: false, error: 'BAD_ACTION' };

    const r = engine.round;

    // ✅ Idempotent — round already decided
    if (this.awarded[r]) return { ok: false, error: 'ROUND_OVER' };

    const startTime = this.startTimes[r];

    // Early tap (before GO) → other player wins
    if (!startTime) {
      this.awarded[r] = true;
      const other = userId === engine.playerAId ? engine.playerBId : engine.playerAId;
      engine.emitToPlayers('game:reaction:early', { userId, round: r });
      this.finishRound(engine, r, other);
      return { ok: true, early: true };
    }

    // Already tapped by this user
    if (this.results[r][userId] !== undefined) {
      return { ok: false, error: 'ALREADY_TAPPED' };
    }

    const elapsed = Date.now() - startTime;
    this.results[r][userId] = elapsed;

    engine.emitToPlayers('game:reaction:tap', { round: r, userId, elapsed });

    // ✅ First valid tap wins — immediately lock the round
    this.awarded[r] = true;
    this.finishRound(engine, r, userId);

    return { ok: true, elapsed };
  },

  finishRound(engine, round, winnerId) {
    if (winnerId) engine.awardPoints(winnerId, 1);

    engine.emitToPlayers('game:reaction:round-result', {
      round,
      totalRounds: this.totalRounds,
      winnerId,
      times: { ...(this.results[round] || {}) },
      isLastRound: round >= this.totalRounds
    });

    engine.setTimer(2200, () => engine.roundComplete());
  },

  onFinish(engine) {
    return { details: { scores: { ...engine.scores } } };
  }
};
