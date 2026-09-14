const COLORS = ['red', 'blue', 'green', 'yellow'];

module.exports = {
  totalRounds: 3,
  roundState: {},

  onStart(engine) {
    this.roundState = {};
    this.startRound(engine);
  },

  startRound(engine) {
    const r = engine.round;
    const length = 3 + r; // round 1: 4, round 2: 5, round 3: 6
    const sequence = Array.from({ length }, () =>
      COLORS[Math.floor(Math.random() * COLORS.length)]
    );

    this.roundState[r] = {
      sequence,
      guesses: {}, // userId -> { index, correct: 0, wrong: false }
      done: {}
    };

    engine.emitToPlayers('game:sequence:show', {
      round: r,
      totalRounds: 3,
      sequence,
      displayMs: 500 * length
    });

    // After display, hide and wait for guesses
    engine.setTimer(500 * length + 500, () => {
      engine.emitToPlayers('game:sequence:hide', {
        round: r,
        length
      });
      this.roundState[r].accepting = true;

      // Auto-timeout per player after 8s
      engine.setTimer(8000, () => {
        const ready = Object.keys(this.roundState[r].done).length;
        if (ready < 2) {
          engine.emitToPlayers('game:sequence:timeout', { round: r });
          engine.roundComplete();
        }
      });
    });
  },

  handleAction(engine, { userId, action, payload }) {
    if (action !== 'tap') return { ok: false, error: 'BAD_ACTION' };
    const r = engine.round;
    const st = this.roundState[r];
    if (!st || !st.accepting) return { ok: false, error: 'NOT_TIME' };
    if (st.done[userId]) return { ok: false, error: 'ALREADY_DONE' };

    const color = String(payload?.color || '');
    if (!COLORS.includes(color)) return { ok: false, error: 'BAD_COLOR' };

    if (!st.guesses[userId]) {
      st.guesses[userId] = { index: 0, correct: 0, wrong: false };
    }
    const g = st.guesses[userId];

    if (g.wrong) return { ok: false, error: 'ALREADY_WRONG' };

    if (color === st.sequence[g.index]) {
      g.correct++;
      g.index++;

      engine.emitToPlayers('game:sequence:tap', {
        round: r, userId, color, correct: true
      });

      if (g.index >= st.sequence.length) {
        // Completed sequence
        st.done[userId] = true;
        const score = g.correct * 10;
        engine.awardPoints(userId, score);
        engine.emitToPlayers('game:sequence:complete', {
          round: r, userId, score
        });
        this.maybeFinish(engine, r);
      }
    } else {
      g.wrong = true;
      st.done[userId] = true;
      engine.emitToPlayers('game:sequence:tap', {
        round: r, userId, color, correct: false
      });
      engine.awardPoints(userId, g.correct * 10);
      engine.emitToPlayers('game:sequence:complete', {
        round: r, userId, score: g.correct * 10
      });
      this.maybeFinish(engine, r);
    }

    return { ok: true };
  },

  maybeFinish(engine, r) {
    const done = Object.keys(this.roundState[r].done).length;
    if (done >= 2) {
      engine.setTimer(1200, () => engine.roundComplete());
    }
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
