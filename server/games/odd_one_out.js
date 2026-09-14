const SETS = [
  { base: '🍎', odd: '🍏' },
  { base: '🔵', odd: '🔷' },
  { base: '⭐', odd: '🌟' },
  { base: '❤️', odd: '💙' },
  { base: '🌕', odd: '🌖' },
  { base: '🟥', odd: '🟧' },
  { base: '🎵', odd: '🎶' },
  { base: '🐶', odd: '🐕' },
  { base: '🌸', odd: '🌺' },
  { base: '⭕', odd: '🔴' },
  { base: '🍕', odd: '🍔' },
  { base: '🐟', odd: '🐠' }
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
    const gridSize = Math.min(3 + Math.floor(r / 2), 5); // 3, 3, 4, 4, 5
    const total = gridSize * gridSize;
    const oddIndex = Math.floor(Math.random() * total);
    const set = SETS[Math.floor(Math.random() * SETS.length)];

    const cells = Array.from({ length: total }, (_, i) =>
      i === oddIndex ? set.odd : set.base
    );

    this.roundState[r] = {
      gridSize,
      oddIndex,
      answered: {},
      resolved: false,
      roundStart: Date.now()
    };

    engine.emitToPlayers('game:odd:show', {
      round: r,
      totalRounds: 5,
      gridSize,
      cells
    });

    engine.setTimer(8000, () => {
      if (!this.roundState[r].resolved) {
        this.roundState[r].resolved = true;
        engine.emitToPlayers('game:odd:timeout', {
          round: r, oddIndex
        });
        engine.setTimer(1500, () => engine.roundComplete());
      }
    });
  },

  handleAction(engine, { userId, action, payload }) {
    if (action !== 'pick') return { ok: false, error: 'BAD_ACTION' };
    const r = engine.round;
    const st = this.roundState[r];
    if (!st || st.resolved) return { ok: false, error: 'ROUND_OVER' };
    if (st.answered[userId]) return { ok: false, error: 'ALREADY_ANSWERED' };

    const idx = Number(payload?.index);
    st.answered[userId] = idx;

    if (idx === st.oddIndex) {
      // Correct: speed-based score
      const elapsed = Date.now() - st.roundStart;
      const speedBonus = Math.max(1, Math.floor((8000 - elapsed) / 1000));
      const score = 10 + speedBonus;
      engine.awardPoints(userId, score);

      engine.emitToPlayers('game:odd:correct', {
        round: r, userId, index: idx, score
      });

      st.resolved = true;
      engine.emitToPlayers('game:odd:round-end', {
        round: r, oddIndex: st.oddIndex
      });
      engine.setTimer(1500, () => engine.roundComplete());
    } else {
      engine.emitToPlayers('game:odd:wrong', {
        round: r, userId, index: idx
      });
    }

    return { ok: true };
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
