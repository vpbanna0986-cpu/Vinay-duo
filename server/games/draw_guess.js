const WORDS = [
  'cat', 'dog', 'house', 'tree', 'sun', 'moon', 'star', 'car',
  'fish', 'bird', 'flower', 'chair', 'table', 'book', 'cup',
  'apple', 'banana', 'pizza', 'cake', 'ice cream', 'balloon',
  'rainbow', 'cloud', 'mountain', 'river', 'boat', 'train',
  'airplane', 'bicycle', 'clock', 'phone', 'camera', 'key',
  'hat', 'shoe', 'umbrella', 'candle', 'mushroom', 'butterfly',
  'spider', 'snake', 'elephant', 'giraffe', 'penguin', 'robot',
  'rocket', 'diamond', 'crown', 'heart', 'smiley'
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = {
  totalRounds: 4,
  roundState: {},
  usedWords: [],

  onStart(engine) {
    this.roundState = {};
    this.usedWords = [];
    this.startRound(engine);
  },

  pickWord() {
    const available = WORDS.filter(w => !this.usedWords.includes(w));
    if (available.length === 0) {
      this.usedWords = [];
      return this.pickWord();
    }
    const picked = available[Math.floor(Math.random() * available.length)];
    this.usedWords.push(picked);
    return picked;
  },

  startRound(engine) {
    const r = engine.round;

    // Alternate: round 1 → A draws, round 2 → B draws, etc.
    const drawerId = r % 2 === 1 ? engine.playerAId : engine.playerBId;
    const guesserId = r % 2 === 1 ? engine.playerBId : engine.playerAId;
    const word = this.pickWord();

    this.roundState[r] = {
      word,
      drawerId,
      guesserId,
      strokes: [],
      guesses: [],
      resolved: false,
      roundStart: Date.now()
    };

    engine.emitToPlayers('game:draw:start', {
      round: r,
      totalRounds: 4,
      drawerId,
      guesserId,
      canvasWidth: 400,
      canvasHeight: 400,
      timeMs: 60000
    });

    // Private word to drawer
    engine.io.to(`user:${drawerId}`).emit('game:draw:your-word', {
      round: r,
      word
    });

    engine.setTimer(60000, () => {
      if (!this.roundState[r].resolved) {
        this.roundState[r].resolved = true;
        engine.emitToPlayers('game:draw:timeout', {
          round: r, word
        });
        engine.setTimer(1500, () => engine.roundComplete());
      }
    });
  },

  handleAction(engine, { userId, action, payload }) {
    const r = engine.round;
    const st = this.roundState[r];
    if (!st || st.resolved) return { ok: false, error: 'ROUND_OVER' };

    if (action === 'stroke') {
      if (userId !== st.drawerId) return { ok: false, error: 'NOT_DRAWER' };
      // payload: { x1, y1, x2, y2, color, width, erase }
      const stroke = {
        x1: Number(payload?.x1) || 0,
        y1: Number(payload?.y1) || 0,
        x2: Number(payload?.x2) || 0,
        y2: Number(payload?.y2) || 0,
        color: typeof payload?.color === 'string' ? payload.color.slice(0, 12) : '#000000',
        width: Math.min(Math.max(Number(payload?.width) || 2, 1), 40),
        erase: !!payload?.erase
      };
      st.strokes.push(stroke);

      // Send to guesser only (drawer already has it locally)
      engine.io.to(`user:${st.guesserId}`).emit('game:draw:stroke', {
        round: r,
        stroke
      });
      return { ok: true };
    }

    if (action === 'clear') {
      if (userId !== st.drawerId) return { ok: false, error: 'NOT_DRAWER' };
      st.strokes = [];
      engine.io.to(`user:${st.guesserId}`).emit('game:draw:clear', { round: r });
      return { ok: true };
    }

    if (action === 'guess') {
      if (userId !== st.guesserId) return { ok: false, error: 'NOT_GUESSER' };
      const guess = String(payload?.word || '').trim().toLowerCase();
      if (!guess) return { ok: false, error: 'EMPTY' };
      st.guesses.push({ userId, guess, at: Date.now() });

      if (guess === st.word.toLowerCase()) {
        const elapsed = Date.now() - st.roundStart;
        const speedBonus = Math.max(1, Math.floor((60000 - elapsed) / 6000));
        const guesserScore = 20 + speedBonus;
        const drawerScore = 10;

        engine.awardPoints(st.guesserId, guesserScore);
        engine.awardPoints(st.drawerId, drawerScore);

        engine.emitToPlayers('game:draw:correct', {
          round: r,
          guesserId: st.guesserId,
          drawerId: st.drawerId,
          guess,
          word: st.word,
          guesserScore,
          drawerScore
        });

        st.resolved = true;
        engine.setTimer(1500, () => engine.roundComplete());
      } else {
        engine.emitToPlayers('game:draw:wrong', {
          round: r, userId, guess
        });
      }
      return { ok: true };
    }

    return { ok: false, error: 'BAD_ACTION' };
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
