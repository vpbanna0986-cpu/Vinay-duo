// Both players pick between two options for the same question.
// If they pick the SAME option → +2 each.
// Simple agreement game.

const QUESTIONS = [
  { a: 'Pizza', b: 'Burger' },
  { a: 'Beach', b: 'Mountains' },
  { a: 'Cats', b: 'Dogs' },
  { a: 'Morning', b: 'Night' },
  { a: 'Coffee', b: 'Tea' },
  { a: 'Sweet', b: 'Spicy' },
  { a: 'Text', b: 'Call' },
  { a: 'Summer', b: 'Winter' },
  { a: 'Movies', b: 'Series' },
  { a: 'Books', b: 'Movies' },
  { a: 'Rain', b: 'Snow' },
  { a: 'Sunrise', b: 'Sunset' },
  { a: 'Ice cream', b: 'Chocolate' },
  { a: 'Cricket', b: 'Football' },
  { a: 'Instagram', b: 'YouTube' },
  { a: 'Early bird', b: 'Night owl' },
  { a: 'Introvert', b: 'Extrovert' },
  { a: 'Plane', b: 'Train' },
  { a: 'Play', b: 'Watch' },
  { a: 'Talk', b: 'Listen' },
  { a: 'Cook', b: 'Order' },
  { a: 'Drive', b: 'Be driven' },
  { a: 'Fiction', b: 'Non-fiction' },
  { a: 'Windows', b: 'Mac' },
  { a: 'Android', b: 'iOS' },
  { a: 'Chocolate', b: 'Vanilla' },
  { a: 'Ocean', b: 'Pool' },
  { a: 'Home', b: 'Outdoors' },
  { a: 'Music', b: 'Podcast' },
  { a: 'Book', b: 'Movie' }
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
  totalRounds: 8,
  roundState: {},
  usedQuestions: [],

  onStart(engine) {
    this.roundState = {};
    this.usedQuestions = [];
    this.startRound(engine);
  },

  pickQuestion() {
    const available = QUESTIONS
      .map((q, i) => ({ ...q, idx: i }))
      .filter(q => !this.usedQuestions.includes(q.idx));
    if (available.length === 0) {
      this.usedQuestions = [];
      return this.pickQuestion();
    }
    const picked = available[Math.floor(Math.random() * available.length)];
    this.usedQuestions.push(picked.idx);
    return picked;
  },

  startRound(engine) {
    const r = engine.round;
    const { a, b } = this.pickQuestion();

    // Randomly swap which side is "A" side to avoid order bias
    const flip = Math.random() < 0.5;
    const optionA = flip ? b : a;
    const optionB = flip ? a : b;

    this.roundState[r] = {
      optionA,
      optionB,
      choices: {
        [engine.playerAId]: null,
        [engine.playerBId]: null
      },
      resolved: false,
      roundStart: Date.now()
    };

    engine.emitToPlayers('game:tot:start', {
      round: r,
      totalRounds: 8,
      optionA,
      optionB
    });

    engine.setTimer(10000, () => {
      if (!this.roundState[r].resolved) {
        this.resolveRound(engine, r);
      }
    });
  },

  handleAction(engine, { userId, action, payload }) {
    if (action !== 'pick') return { ok: false, error: 'BAD_ACTION' };
    const r = engine.round;
    const st = this.roundState[r];
    if (!st || st.resolved) return { ok: false, error: 'ROUND_OVER' };
    if (st.choices[userId]) return { ok: false, error: 'ALREADY_PICKED' };

    const pick = String(payload?.choice || '').toUpperCase();
    if (pick !== 'A' && pick !== 'B') return { ok: false, error: 'BAD_CHOICE' };

    st.choices[userId] = pick;

    engine.io.to(`user:${userId}`).emit('game:tot:locked', {
      round: r
    });

    if (st.choices[engine.playerAId] && st.choices[engine.playerBId]) {
      this.resolveRound(engine, r);
    }

    return { ok: true };
  },

  resolveRound(engine, r) {
    const st = this.roundState[r];
    if (st.resolved) return;
    st.resolved = true;

    const a = st.choices[engine.playerAId];
    const b = st.choices[engine.playerBId];

    let agreement = false;
    if (a && b && a === b) {
      agreement = true;
      engine.awardPoints(engine.playerAId, 2);
      engine.awardPoints(engine.playerBId, 2);
    }

    engine.emitToPlayers('game:tot:result', {
      round: r,
      optionA: st.optionA,
      optionB: st.optionB,
      aChoice: a || null,
      bChoice: b || null,
      agreement
    });

    engine.setTimer(1600, () => engine.roundComplete());
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
