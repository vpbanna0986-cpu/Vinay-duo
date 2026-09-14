const WORDS = [
  { word: 'apple', hint: 'A red or green fruit' },
  { word: 'tiger', hint: 'Big striped cat' },
  { word: 'piano', hint: 'Musical keys' },
  { word: 'rain', hint: 'Comes from clouds' },
  { word: 'moon', hint: 'Shines at night' },
  { word: 'book', hint: 'You read it' },
  { word: 'chair', hint: 'You sit on it' },
  { word: 'river', hint: 'Flowing water' },
  { word: 'phone', hint: 'You talk on it' },
  { word: 'clock', hint: 'Shows time' },
  { word: 'guitar', hint: 'String instrument' },
  { word: 'sun', hint: 'Bright star' },
  { word: 'fish', hint: 'Lives in water' },
  { word: 'bird', hint: 'Has wings' },
  { word: 'mountain', hint: 'Very tall land' },
  { word: 'ocean', hint: 'Big blue water' },
  { word: 'star', hint: 'Twinkles at night' },
  { word: 'cloud', hint: 'Floats in sky' },
  { word: 'flower', hint: 'Smells sweet' },
  { word: 'candle', hint: 'Has a flame' },
  { word: 'snow', hint: 'Cold white flakes' },
  { word: 'window', hint: 'You see through it' },
  { word: 'clock', hint: 'Has hands but no arms' },
  { word: 'camera', hint: 'Captures moments' },
  { word: 'bicycle', hint: 'Has two wheels' },
  { word: 'umbrella', hint: 'Used in rain' },
  { word: 'chocolate', hint: 'Sweet brown treat' },
  { word: 'elephant', hint: 'Big animal with trunk' },
  { word: 'butterfly', hint: 'Colorful flying insect' },
  { word: 'rainbow', hint: 'Appears after rain' },
  { word: 'sandwich', hint: 'Two slices with filling' },
  { word: 'mango', hint: 'Yellow tropical fruit' },
  { word: 'coffee', hint: 'Morning drink' },
  { word: 'puzzle', hint: 'Pieces to fit' },
  { word: 'cactus', hint: 'Desert plant' },
  { word: 'lighthouse', hint: 'Guides ships' },
  { word: 'penguin', hint: 'Waddles on ice' },
  { word: 'diamond', hint: 'Very hard gem' },
  { word: 'volcano', hint: 'Erupts lava' },
  { word: 'kitchen', hint: 'Where you cook' },
  { word: 'garden', hint: 'Where plants grow' },
  { word: 'mirror', hint: 'Shows your face' },
  { word: 'shadow', hint: 'Follows you in sun' },
  { word: 'thunder', hint: 'Loud sky sound' },
  { word: 'whistle', hint: 'You blow to make sound' },
  { word: 'calendar', hint: 'Shows days of month' },
  { word: 'hospital', hint: 'Where doctors work' },
  { word: 'universe', hint: 'Everything in space' },
  { word: 'festival', hint: 'Celebration time' },
  { word: 'pencil', hint: 'Has an eraser' }
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
  totalRounds: 5,
  roundState: {},
  usedWords: [],

  onStart(engine) {
    this.roundState = {};
    this.usedWords = [];
    this.startRound(engine);
  },

  pickWord() {
    const available = WORDS.filter(w => !this.usedWords.includes(w.word));
    if (available.length === 0) {
      this.usedWords = [];
      return this.pickWord();
    }
    const picked = available[Math.floor(Math.random() * available.length)];
    this.usedWords.push(picked.word);
    return picked;
  },

  startRound(engine) {
    const r = engine.round;
    const { word, hint } = this.pickWord();

    this.roundState[r] = {
      word,
      hint,
      revealed: word[0] + '_'.repeat(word.length - 1),
      answered: {},
      resolved: false,
      roundStart: Date.now()
    };

    engine.emitToPlayers('game:guessword:show', {
      round: r,
      totalRounds: 5,
      hint,
      length: word.length,
      revealed: this.roundState[r].revealed
    });

    engine.setTimer(25000, () => {
      if (!this.roundState[r].resolved) {
        this.roundState[r].resolved = true;
        engine.emitToPlayers('game:guessword:timeout', {
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

    if (guess === st.word.toLowerCase()) {
      const elapsed = Date.now() - st.roundStart;
      const speedBonus = Math.max(1, Math.floor((25000 - elapsed) / 2500));
      const score = 25 + speedBonus;
      engine.awardPoints(userId, score);

      engine.emitToPlayers('game:guessword:correct', {
        round: r, userId, word: guess, score
      });

      st.resolved = true;
      engine.emitToPlayers('game:guessword:round-end', {
        round: r, word: st.word
      });
      engine.setTimer(1500, () => engine.roundComplete());
    } else {
      engine.emitToPlayers('game:guessword:wrong', {
        round: r, userId
      });
    }

    return { ok: true };
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
