module.exports = {
  totalRounds: 2,
  starts: {},

  onStart(engine) {
    this.starts = {};
    engine.emitToPlayers('game:ten:ready', {
      totalRounds: 2,
      targetMs: 10000,
      message: 'Tap START, then STOP exactly at 10.000s'
    });
  },

  handleAction(engine, { userId, action }) {
    const r = engine.round;

    if (action === 'start') {
      if (this.starts[userId]) return { ok: false, error: 'ALREADY_STARTED' };
      this.starts[userId] = Date.now();
      engine.emitToPlayers('game:ten:started', { round: r, userId });
      return { ok: true };
    }

    if (action === 'stop') {
      const startTs = this.starts[userId];
      if (!startTs) return { ok: false, error: 'NOT_STARTED' };
      if (this.starts[userId + ':stop']) return { ok: false, error: 'ALREADY_STOPPED' };

      const elapsed = Date.now() - startTs;
      this.starts[userId + ':stop'] = elapsed;

      const diff = Math.abs(elapsed - 10000);
      const score = Math.max(0, Math.floor(1000 - diff / 10));
      engine.awardPoints(userId, score);

      engine.emitToPlayers('game:ten:stopped', {
        round: r, userId, elapsed, diff, score
      });

      if (
        this.starts[engine.playerAId + ':stop'] !== undefined &&
        this.starts[engine.playerBId + ':stop'] !== undefined
      ) {
        engine.setTimer(1200, () => {
          this.starts = {};
          engine.roundComplete();
        });
      }

      return { ok: true, elapsed, score };
    }

    return { ok: false, error: 'BAD_ACTION' };
  },

  onFinish(engine) {
    return {
      details: { scores: engine.scores, targetMs: 10000 }
    };
  }
};
