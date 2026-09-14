const PUZZLES = [
  { emoji: '🌧️☀️🌈', answer: 'rainbow' },
  { emoji: '🍎📱', answer: 'apple' },
  { emoji: '🐝🏠', answer: 'beehive' },
  { emoji: '🌊🏄', answer: 'surfing' },
  { emoji: '🔥🚒', answer: 'fire truck' },
  { emoji: '🚗🔑', answer: 'car key' },
  { emoji: '🌙⭐', answer: 'night sky' },
  { emoji: '☕🍩', answer: 'coffee and donut' },
  { emoji: '🐟🌊', answer: 'fish in water' },
  { emoji: '🦁👑', answer: 'lion king' },
  { emoji: '🎸🎵', answer: 'music' },
  { emoji: '📚✏️', answer: 'study' },
  { emoji: '🐘🌍', answer: 'elephant world' },
  { emoji: '🚀🌕', answer: 'rocket to moon' },
  { emoji: '🌻🌞', answer: 'sunflower' },
  { emoji: '⛄❄️', answer: 'snowman' },
  { emoji: '🎂🎉', answer: 'birthday party' },
  { emoji: '🐍🍎', answer: 'snake and apple' },
  { emoji: '🏰👸', answer: 'princess castle' },
  { emoji: '🌮🌶️', answer: 'spicy taco' },
  { emoji: '🍕🍕', answer: 'pizza' },
  { emoji: '🐱🐶', answer: 'cat and dog' },
  { emoji: '🍔🍟', answer: 'burger and fries' },
  { emoji: '🧊🍋', answer: 'lemonade' },
  { emoji: '🌳🍃', answer: 'tree' },
  { emoji: '🏀⛹️', answer: 'basketball' },
  { emoji: '⚽🥅', answer: 'football' },
  { emoji: '🕐⏰', answer: 'clock' },
  { emoji: '📷🖼️', answer: 'camera' },
  { emoji: '🎈🎉', answer: 'party' },
  { emoji: '🧊🐧', answer: 'penguin' },
  { emoji: '🦋🌸', answer: 'butterfly flower' },
  { emoji: '🚁🏙️', answer: 'helicopter' },
  { emoji: '🍦🍫', answer: 'chocolate ice cream' },
  { emoji: '🥤🍿', answer: 'movie time' },
  { emoji: '🛌😴', answer: 'sleeping' },
  { emoji: '🧼🚿', answer: 'shower' },
  { emoji: '🦷🪥', answer: 'brushing teeth' },
  { emoji: '📞🗣️', answer: 'phone call' },
  { emoji: '✉️📮', answer: 'mail' },
  { emoji: '💡🧠', answer: 'idea' },
  { emoji: '🔥👨‍🚒', answer: 'firefighter' },
  { emoji: '🌡️🤒', answer: 'fever' },
  { emoji: '💊🏥', answer: 'hospital' },
  { emoji: '🚓👮', answer: 'police' },
  { emoji: '🎯🏹', answer: 'archery' },
  { emoji: '🛒🥛', answer: 'grocery shopping' },
  { emoji: '🌅🏖️', answer: 'beach sunrise' },
  { emoji: '🏔️❄️', answer: 'snow mountain' },
  { emoji: '🐢🏁', answer: 'turtle racing' },
  { emoji: '🍀🌱', answer: 'lucky plant' }
];

// Shuffle helper
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
  usedPuzzleIndices: [],

  onStart(engine) {
    this.roundState = {};
    // Reset used puzzle history for this match
    this.usedPuzzleIndices = [];
    this.startRound(engine);
  },

  pickRandomPuzzle() {
    // Filter out used puzzles
    const available = PUZZLES
      .map((p, i) => ({ ...p, idx: i }))
      .filter(p => !this.usedPuzzleIndices.includes(p.idx));

    // If all used, reset pool
    if (available.length === 0) {
      this.usedPuzzleIndices = [];
      return this.pickRandomPuzzle();
    }

    const picked = available[Math.floor(Math.random() * available.length)];
    this.usedPuzzleIndices.push(picked.idx);
    return picked;
  },

  startRound(engine) {
    const r = engine.round;
    const puzzle = this.pickRandomPuzzle();

    const normalize = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
    const accepted = normalize(puzzle.answer);

    this.roundState[r] = {
      emoji: puzzle.emoji,
      answer: puzzle.answer,
      accepted,
      answered: {},
      resolved: false,
      roundStart: Date.now()
    };

    engine.emitToPlayers('game:emojiguess:show', {
      round: r,
      totalRounds: 5,
      emoji: puzzle.emoji
    });

    engine.setTimer(20000, () => {
      if (!this.roundState[r].resolved) {
        this.roundState[r].resolved = true;
        engine.emitToPlayers('game:emojiguess:timeout', {
          round: r, answer: puzzle.answer
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

    const guess = String(payload?.answer || '').toLowerCase().replace(/\s+/g, ' ').trim();
    st.answered[userId] = guess;

    const accepted = st.accepted;
    const words = accepted.split(' ');
    const isCorrect =
      guess === accepted ||
      guess.includes(accepted) ||
      accepted.includes(guess) ||
      (words.length > 1 && words.every(w => guess.includes(w)));

    if (isCorrect && guess.length >= 3) {
      const elapsed = Date.now() - st.roundStart;
      const speedBonus = Math.max(1, Math.floor((20000 - elapsed) / 2000));
      const score = 20 + speedBonus;
      engine.awardPoints(userId, score);

      engine.emitToPlayers('game:emojiguess:correct', {
        round: r, userId, guess, answer: st.answer, score
      });

      st.resolved = true;
      engine.emitToPlayers('game:emojiguess:round-end', {
        round: r, answer: st.answer
      });
      engine.setTimer(1500, () => engine.roundComplete());
    } else {
      engine.emitToPlayers('game:emojiguess:wrong', {
        round: r, userId, guess
      });
    }

    return { ok: true };
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
