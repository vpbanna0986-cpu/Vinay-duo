// Pattern generators — each returns { sequence, next }
const PATTERNS = [
  // Arithmetic
  () => {
    const start = 1 + Math.floor(Math.random() * 10);
    const step = 1 + Math.floor(Math.random() * 5);
    const seq = [start, start + step, start + step * 2, start + step * 3];
    return { sequence: seq, next: start + step * 4 };
  },
  // Geometric
  () => {
    const start = 1 + Math.floor(Math.random() * 3);
    const mul = 2 + Math.floor(Math.random() * 2);
    const seq = [start, start * mul, start * mul ** 2, start * mul ** 3];
    return { sequence: seq, next: start * mul ** 4 };
  },
  // Squares
  () => {
    const start = 1 + Math.floor(Math.random() * 3);
    const seq = [start ** 2, (start + 1) ** 2, (start + 2) ** 2, (start + 3) ** 2];
    return { sequence: seq, next: (start + 4) ** 2 };
  },
  // Fibonacci-like
  () => {
    const a = 1 + Math.floor(Math.random() * 3);
    const b = 1 + Math.floor(Math.random() * 3);
    const c = a + b;
    const d = b + c;
    const e = c + d;
    return { sequence: [a, b, c, d], next: e };
  },
  // Alternating + and -
  () => {
    const start = 10 + Math.floor(Math.random() * 5);
    const add = 2 + Math.floor(Math.random() * 3);
    const sub = 1 + Math.floor(Math.random() * 2);
    const seq = [start, start + add, start + add - sub, start + add - sub + add];
    return { sequence: seq, next: start + add - sub + add - sub };
  }
];

module.exports = {
  totalRounds: 5,
  roundState: {},

  onStart(engine) {
    this.roundState = {};
    this.startRound(engine);
  },

  startRound(engine) {
    const r = engine.round;
    const gen = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
    const { sequence, next } = gen();

    this.roundState[r] = {
      sequence,
      answer: next,
      answered: {},
      resolved: false,
      roundStart: Date.now()
    };

    engine.emitToPlayers('game:pattern:show', {
      round: r,
      totalRounds: 5,
      sequence
    });

    engine.setTimer(12000, () => {
      if (!this.roundState[r].resolved) {
        this.roundState[r].resolved = true;
        engine.emitToPlayers('game:pattern:timeout', {
          round: r, answer: next
        });
        engine.setTimer(1500, () => engine.roundComplete());
      }
    });
  },

  handleAction(engine, { userId, action, payload }) {
    if (action !== 'answer') return { ok: false, error: 'BAD_ACTION' };
    const r = engine.round;
    const st = this.roundState[r];
    if (!st || st.resolved) return { ok: false, error: 'ROUND_OVER' };
    if (st.answered[userId]) return { ok: false, error: 'ALREADY_ANSWERED' };

    const val = Number(payload?.value);
    if (!Number.isFinite(val)) return { ok: false, error: 'BAD_VALUE' };

    st.answered[userId] = val;

    if (val === st.answer) {
      const elapsed = Date.now() - st.roundStart;
      const speedBonus = Math.max(1, Math.floor((12000 - elapsed) / 1500));
      const score = 15 + speedBonus;
      engine.awardPoints(userId, score);

      engine.emitToPlayers('game:pattern:correct', {
        round: r, userId, value: val, score
      });

      st.resolved = true;
      engine.emitToPlayers('game:pattern:round-end', {
        round: r, answer: st.answer
      });
      engine.setTimer(1500, () => engine.roundComplete());
    } else {
      engine.emitToPlayers('game:pattern:wrong', {
        round: r, userId, value: val
      });
    }

    return { ok: true };
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
