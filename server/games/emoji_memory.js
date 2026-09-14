const EMOJI_POOL = ['🍎','🍌','🍇','🍓','🍒','🥝','🍍','🥥','🍋','🍉','🥭','🍑','🌽','🥕','🍄','🌶️','🥑','🍅','🫐','🥒'];

module.exports = {
  totalRounds: 3,
  roundState: {},

  onStart(engine) {
    this.roundState = {};
    this.startRound(engine);
  },

  startRound(engine) {
    const r = engine.round;
    const count = 3 + r; // round 1: 4, round 2: 5, round 3: 6

    const shuffled = [...EMOJI_POOL].sort(() => Math.random() - 0.5);
    const sequence = shuffled.slice(0, count);

    this.roundState[r] = {
      sequence,
      answers: {},
      done: {},
      roundStart: Date.now()
    };

    engine.emitToPlayers('game:emojimem:show', {
      round: r,
      totalRounds: 3,
      sequence,
      displayMs: 1500 + count * 400
    });

    const displayMs = 1500 + count * 400;

    engine.setTimer(displayMs, () => {
      engine.emitToPlayers('game:emojimem:hide', { round: r, count });
      this.roundState[r].accepting = true;

      engine.setTimer(10000, () => {
        if (Object.keys(this.roundState[r].done).length < 2) {
          engine.emitToPlayers('game:emojimem:timeout', { round: r });
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

    const guess = Array.isArray(payload?.sequence) ? payload.sequence : [];
    st.done[userId] = true;
    st.answers[userId] = guess;

    // Score: +10 per correct position (in order)
    let correct = 0;
    const len = Math.min(guess.length, st.sequence.length);
    for (let i = 0; i < len; i++) {
      if (guess[i] === st.sequence[i]) correct++;
    }
    const score = correct * 10;
    engine.awardPoints(userId, score);

    engine.emitToPlayers('game:emojimem:result', {
      round: r, userId, correct, score
    });

    if (Object.keys(st.done).length >= 2) {
      engine.emitToPlayers('game:emojimem:reveal', {
        round: r, sequence: st.sequence
      });
      engine.setTimer(1500, () => engine.roundComplete());
    }

    return { ok: true, correct, score };
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
