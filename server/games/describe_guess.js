const WORDS = [
  'pizza', 'elephant', 'rainbow', 'guitar', 'umbrella',
  'butterfly', 'mountain', 'chocolate', 'bicycle', 'camera',
  'library', 'airplane', 'sunflower', 'sandwich', 'telescope',
  'dinosaur', 'volcano', 'hospital', 'snowman', 'kangaroo',
  'octopus', 'pyramid', 'diamond', 'compass', 'penguin',
  'waterfall', 'lighthouse', 'fireworks', 'harmonica', 'chef',
  'mirror', 'umbrella', 'cactus', 'hurricane', 'tornado',
  'submarine', 'helicopter', 'astronaut', 'rainforest', 'skeleton',
  'jellyfish', 'dragonfly', 'saxophone', 'caterpillar', 'chandelier',
  'accordion', 'boomerang', 'kaleidoscope', 'labyrinth', 'avalanche'
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

    // Alternate describer each round: round 1 → playerA describes, round 2 → playerB, etc.
    const describerId = r % 2 === 1 ? engine.playerAId : engine.playerBId;
    const guesserId = r % 2 === 1 ? engine.playerBId : engine.playerAId;
    const word = this.pickWord();

    this.roundState[r] = {
      word,
      describerId,
      guesserId,
      guesses: [],
      resolved: false,
      roundStart: Date.now()
    };

    // Send word only to describer
    engine.emitToPlayers('game:describe:start', {
      round: r,
      totalRounds: 4,
      describerId,
      guesserId
    });

    // Private word to describer
    engine.io.to(`user:${describerId}`).emit('game:describe:your-word', {
      round: r,
      word
    });

    engine.emitToPlayers('game:describe:guesser-turn', {
      round: r,
      guesserId
    });

    // Time limit 60s
    engine.setTimer(60000, () => {
      if (!this.roundState[r].resolved) {
        this.roundState[r].resolved = true;
        engine.emitToPlayers('game:describe:timeout', {
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

    if (action === 'guess') {
      if (userId !== st.guesserId) return { ok: false, error: 'NOT_GUESSER' };

      const guess = String(payload?.word || '').trim().toLowerCase();
      if (!guess) return { ok: false, error: 'EMPTY' };

      st.guesses.push({ userId, guess, at: Date.now() });

      if (guess === st.word.toLowerCase()) {
        const elapsed = Date.now() - st.roundStart;
        const speedBonus = Math.max(1, Math.floor((60000 - elapsed) / 6000));
        const score = 20 + speedBonus;
        engine.awardPoints(userId, score);

        engine.emitToPlayers('game:describe:correct', {
          round: r, userId, guess, word: st.word, score
        });

        st.resolved = true;
        engine.setTimer(1500, () => engine.roundComplete());
      } else {
        engine.emitToPlayers('game:describe:wrong', {
          round: r, userId, guess
        });
      }
      return { ok: true };
    }

    if (action === 'skip') {
      if (userId !== st.describerId) return { ok: false, error: 'NOT_DESCRIBER' };
      st.resolved = true;
      engine.emitToPlayers('game:describe:skipped', {
        round: r, word: st.word
      });
      engine.setTimer(1200, () => engine.roundComplete());
      return { ok: true };
    }

    return { ok: false, error: 'BAD_ACTION' };
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
