module.exports = {
  totalRounds: 3,
  roundDelays: [],
  roundStartTimes: {},
  roundResults: {},

  onStart(engine) {
    this.roundDelays = Array.from({ length: 3 }, () =>
      2000 + Math.floor(Math.random() * 4000)
    );
    this.roundStartTimes = {};
    this.roundResults = {};
    this.startRound(engine);
  },

  startRound(engine) {
    const r = engine.round;
    const delay = this.roundDelays[r - 1];

    engine.emitToPlayers('game:reaction:wait', {
      round: r,
      totalRounds: 3,
      message: 'Wait for green...'
    });

    engine.setTimer(delay, () => {
      const startedAt = Date.now();
      this.roundStartTimes[r] = startedAt;
      this.roundResults[r] = {};

      engine.emitToPlayers('game:reaction:go', {
        round: r,
        serverTs: startedAt
      });

      engine.setTimer(3000, () => {
        if (Object.keys(this.roundResults[r]).length === 0) {
          engine.emitToPlayers('game:reaction:timeout', { round: r });
          engine.roundComplete();
        }
      });
    });
  },

  handleAction(engine, { userId, action }) {
    if (action !== 'tap') return { ok: false, error: 'BAD_ACTION' };

    const r = engine.round;
    const roundStart = this.roundStartTimes[r];

    if (!roundStart) {
      engine.emitToPlayers('game:reaction:early', { userId, round: r });
      this.awardRound(engine, r, this.other(engine, userId));
      return { ok: true, early: true };
    }

    if (this.roundResults[r][userId]) return { ok: false, error: 'ALREADY_TAPPED' };

    const elapsed = Date.now() - roundStart;
    this.roundResults[r][userId] = elapsed;

    engine.emitToPlayers('game:reaction:tap', {
      round: r, userId, elapsed
    });

    this.awardRound(engine, r, userId);
    return { ok: true, elapsed };
  },

  awardRound(engine, round, winnerId) {
    engine.awardPoints(winnerId, 1);
    engine.emitToPlayers('game:reaction:round-result', {
      round, winnerId, times: this.roundResults[round]
    });
    engine.setTimer(1200, () => engine.roundComplete());
  },

  other(engine, userId) {
    return userId === engine.playerAId ? engine.playerBId : engine.playerAId;
  },

  onFinish(engine) {
    return {
      details: {
        scores: engine.scores,
        delays: this.roundDelays
      }
    };
  }
};
