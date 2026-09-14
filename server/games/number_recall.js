module.exports = {
  totalRounds: 3,
  roundState: {},

  onStart(engine) {
    this.roundState = {};
    this.startRound(engine);
  },

  startRound(engine) {
    const r = engine.round;
    const digits = 3 + r; // round 1: 4, round 2: 5, round 3: 6

    let number = '';
    for (let i = 0; i < digits; i++) {
      number += Math.floor(Math.random() * 10);
    }

    this.roundState[r] = {
      number,
      answers: {},
      done: {}
    };

    engine.emitToPlayers('game:numrecall:show', {
      round: r,
      totalRounds: 3,
      number,
      displayMs: 2000 + digits * 300
    });

    const displayMs = 2000 + digits * 300;

    engine.setTimer(displayMs, () => {
      engine.emitToPlayers('game:numrecall:hide', { round: r, digits });
      this.roundState[r].accepting = true;

      engine.setTimer(8000, () => {
        if (Object.keys(this.roundState[r].done).length < 2) {
          engine.emitToPlayers('game:numrecall:timeout', { round: r });
          engine.roundComplete();
        }
      });
    });
  },

  handleAction(engine, { userId, action, payload }) {
    if (action !== 'answer') return { ok: false, error: 'BAD_ACTION' };
    const r = engine.round;
    const st = this.roundState[r];
    if (!st || !st.accepting) return { ok: false, error: 'NOT_TIME' };
    if (st.done[userId]) return { ok: false, error: 'ALREADY_DONE' };

    const guess = String(payload?.answer || '').trim();
    if (!guess) return { ok: false, error: 'EMPTY' };

    st.done[userId] = true;
    st.answers[userId] = guess;

    const correct = guess === st.number;
    let score = 0;
    if (correct) {
      score = 30; // full correct
    } else {
      // partial: count matching positions
      let matching = 0;
      const len = Math.min(guess.length, st.number.length);
      for (let i = 0; i < len; i++) {
        if (guess[i] === st.number[i]) matching++;
      }
      score = matching * 5;
    }

    engine.awardPoints(userId, score);

    engine.emitToPlayers('game:numrecall:result', {
      round: r, userId, correct, score, guess
    });

    if (Object.keys(st.done).length >= 2) {
      // Reveal actual number
      engine.emitToPlayers('game:numrecall:reveal', {
        round: r, number: st.number
      });
      engine.setTimer(1500, () => engine.roundComplete());
    }

    return { ok: true, correct, score };
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
