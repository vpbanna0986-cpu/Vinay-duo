/* ═══════════════════════════════════════════════════════
   VINAY DUO — Flash Grid
   Made by VP
   ═══════════════════════════════════════════════════════ */

module.exports = {
  totalRounds: 5,
  roundState: {},

  onStart(engine) {
    this.roundState = {};
    this.startRound(engine);
  },

  // ✅ FIX: Rounds 2-5 ke liye
  onRoundStart(engine) {
    this.startRound(engine);
  },

  startRound(engine) {
    const r = engine.round;
    const gridSize = 3 + Math.floor((r - 1) / 2);
    const totalCells = gridSize * gridSize;
    const flashCount = Math.min(2 + r, Math.floor(totalCells / 2));

    const indices = Array.from({ length: totalCells }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const targetCells = indices.slice(0, flashCount).sort((a, b) => a - b);

    this.roundState[r] = {
      gridSize, targetCells, guesses: {}, revealed: false
    };

    const flashMs = Math.max(600, 1500 - r * 100);

    engine.emitToPlayers('game:flash:show', {
      round: r, totalRounds: 5, gridSize, targetCells, flashMs
    });

    engine.setTimer(flashMs, () => {
      engine.emitToPlayers('game:flash:hide', { round: r, gridSize });
      this.roundState[r].revealed = true;

      engine.setTimer(8000, () => {
        if (Object.keys(this.roundState[r].guesses).length < 2) {
          engine.emitToPlayers('game:flash:timeout', { round: r });
          engine.roundComplete();
        }
      });
    });
  },

  handleAction(engine, { userId, action, payload }) {
    if (action !== 'guess') return { ok: false, error: 'BAD_ACTION' };
    const r = engine.round;
    const st = this.roundState[r];
    if (!st || !st.revealed) return { ok: false, error: 'NOT_TIME' };
    if (st.guesses[userId]) return { ok: false, error: 'ALREADY_GUESSED' };

    const guess = Array.isArray(payload?.cells)
      ? payload.cells.map(Number).sort((a, b) => a - b) : [];
    st.guesses[userId] = guess;

    const targetSet = new Set(st.targetCells);
    let correct = 0, wrong = 0;
    for (const c of guess) {
      if (targetSet.has(c)) correct++;
      else wrong++;
    }
    const missed = st.targetCells.length - correct;
    const score = Math.max(0, correct * 10 - wrong * 5 - missed * 2);
    engine.awardPoints(userId, score);

    engine.emitToPlayers('game:flash:result', {
      round: r, userId, correct, wrong, missed, score
    });

    if (Object.keys(st.guesses).length === 2) {
      engine.setTimer(1500, () => engine.roundComplete());
    }
    return { ok: true, score };
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
