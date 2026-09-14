module.exports = {
  totalRounds: 5,
  roundState: {},

  onStart(engine) {
    this.roundState = {};
    this.startRound(engine);
  },

  startRound(engine) {
    const r = engine.round;
    const target = 1 + Math.floor(Math.random() * 100); // 1-100
    const rangeLo = Math.max(1, target - 30);
    const rangeHi = Math.min(100, target + 30);

    this.roundState[r] = {
      target,
      rangeLo,
      rangeHi,
      guesses: {}, // userId -> array of {value, direction}
      resolved: false,
      roundStart: Date.now(),
      turns: {} // userId -> how many turns used
    };

    engine.emitToPlayers('game:numbattle:start', {
      round: r,
      totalRounds: 5,
      rangeLo,
      rangeHi,
      message: `Guess a number between ${rangeLo} and ${rangeHi}`
    });

    // 30s per round
    engine.setTimer(30000, () => {
      if (!this.roundState[r].resolved) {
        this.roundState[r].resolved = true;
        engine.emitToPlayers('game:numbattle:timeout', {
          round: r, target
        });
        engine.setTimer(1500, () => engine.roundComplete());
      }
    });
  },

  handleAction(engine, { userId, action, payload }) {
    if (action !== 'guess') return { ok: false, error: 'BAD_ACTION' };
    const r = engine.round;
    const st = this.roundState[r];
    if (!st || st.resolved) return { ok: false, error: 'ROUND_OVER' };

    const val = Number(payload?.value);
    if (!Number.isInteger(val) || val < st.rangeLo || val > st.rangeHi) {
      return { ok: false, error: 'OUT_OF_RANGE' };
    }

    if (!st.guesses[userId]) st.guesses[userId] = [];
    if (!st.turns[userId]) st.turns[userId] = 0;

    st.turns[userId]++;
    const diff = Math.abs(val - st.target);

    if (val === st.target) {
      // Correct — score = 30 - (turns used * 3), min 5
      const score = Math.max(5, 30 - (st.turns[userId] - 1) * 3);
      engine.awardPoints(userId, score);
      st.guesses[userId].push({ value: val, direction: 'correct' });

      engine.emitToPlayers('game:numbattle:correct', {
        round: r, userId, value: val, score, turnsUsed: st.turns[userId]
      });

      st.resolved = true;
      engine.emitToPlayers('game:numbattle:round-end', {
        round: r, target: st.target
      });
      engine.setTimer(1500, () => engine.roundComplete());
    } else {
      const direction = val < st.target ? 'higher' : 'lower';
      st.guesses[userId].push({ value: val, direction });

      // Send feedback only to that user
      engine.io.to(`user:${userId}`).emit('game:numbattle:feedback', {
        round: r, value: val, direction,
        turnsUsed: st.turns[userId]
      });

      // Tell the other player that a guess was made (no value revealed)
      const otherId = userId === engine.playerAId ? engine.playerBId : engine.playerAId;
      engine.io.to(`user:${otherId}`).emit('game:numbattle:opponent-guessed', {
        round: r
      });
    }

    return { ok: true };
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
