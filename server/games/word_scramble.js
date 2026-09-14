const WORDS = [
  'apple', 'banana', 'orange', 'mango', 'grapes',
  'tiger', 'lion', 'monkey', 'rabbit', 'panda',
  'chair', 'table', 'window', 'door', 'bottle',
  'summer', 'winter', 'autumn', 'spring', 'cloud',
  'music', 'guitar', 'piano', 'violin', 'flute',
  'happy', 'smile', 'laugh', 'friend', 'dream'
];

function scramble(word) {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // Make sure it's actually scrambled
  if (arr.join('') === word) return scramble(word);
  return arr.join('');
}

module.exports = {
  totalRounds: 5,
  roundState: {},

  onStart(engine) {
    this.roundState = {};
    this.startRound(engine);
  },

  startRound(engine) {
    const r = engine.round;
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const scrambled = scramble(word);

    this.roundState[r] = {
      word,
      scrambled,
      answered: {},
      resolved: false,
      roundStart: Date.now()
    };

    engine.emitToPlayers('game:scramble:show', {
      round: r,
      totalRounds: 5,
      scrambled
    });

    engine.setTimer(20000, () => {
      if (!this.roundState[r].resolved) {
        this.roundState[r].resolved = true;
        engine.emitToPlayers('game:scramble:timeout', {
          round: r, word
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

    const guess = String(payload?.word || '').trim().toLowerCase();
    st.answered[userId] = guess;

    if (guess === st.word) {
      const elapsed = Date.now() - st.roundStart;
      const speedBonus = Math.max(1, Math.floor((20000 - elapsed) / 2000));
      const score = 20 + speedBonus;
      engine.awardPoints(userId, score);

      engine.emitToPlayers('game:scramble:correct', {
        round: r, userId, word: guess, score
      });

      st.resolved = true;
      engine.emitToPlayers('game:scramble:round-end', {
        round: r, word: st.word
      });
      engine.setTimer(1500, () => engine.roundComplete());
    } else {
      engine.emitToPlayers('game:scramble:wrong', {
        round: r, userId
      });
    }

    return { ok: true };
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
