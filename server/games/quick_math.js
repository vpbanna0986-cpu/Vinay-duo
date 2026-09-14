function makeQuestion(round) {
  const max = 10 + round * 10;
  const ops = round === 1 ? ['+', '-'] : ['+', '-', '*'];

  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, answer;

  if (op === '*') {
    a = 2 + Math.floor(Math.random() * Math.min(9, max / 5));
    b = 2 + Math.floor(Math.random() * Math.min(9, max / 5));
    answer = a * b;
  } else if (op === '+') {
    a = 1 + Math.floor(Math.random() * max);
    b = 1 + Math.floor(Math.random() * max);
    answer = a + b;
  } else {
    a = 1 + Math.floor(Math.random() * max);
    b = 1 + Math.floor(Math.random() * max);
    if (a < b) [a, b] = [b, a];
    answer = a - b;
  }

  return { text: `${a} ${op} ${b}`, answer };
}

module.exports = {
  totalRounds: 8,
  roundState: {},

  onStart(engine) {
    this.roundState = {};
    this.startRound(engine);
  },

  startRound(engine) {
    const r = engine.round;
    const q = makeQuestion(r);

    this.roundState[r] = {
      question: q,
      answered: {},
      roundStart: Date.now()
    };

    engine.emitToPlayers('game:math:question', {
      round: r,
      totalRounds: 8,
      text: q.text
    });

    // Time limit per round: 10s
    engine.setTimer(10000, () => {
      if (!this.roundState[r].resolved) {
        this.roundState[r].resolved = true;
        engine.emitToPlayers('game:math:timeout', {
          round: r, answer: q.answer
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
    const correct = val === st.question.answer;

    if (correct) {
      // Speed-based scoring: faster = more points
      const elapsed = Date.now() - st.roundStart;
      const speedBonus = Math.max(1, Math.floor((10000 - elapsed) / 1000));
      const score = 10 + speedBonus;
      engine.awardPoints(userId, score);

      engine.emitToPlayers('game:math:correct', {
        round: r, userId, value: val, score
      });

      // First correct answer ends the round
      st.resolved = true;
      engine.emitToPlayers('game:math:round-end', {
        round: r, answer: st.question.answer
      });
      engine.setTimer(1500, () => engine.roundComplete());
    } else {
      engine.emitToPlayers('game:math:wrong', {
        round: r, userId, value: val
      });
    }

    return { ok: true, correct };
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
