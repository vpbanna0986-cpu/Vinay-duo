// Both players answer the same question about the OTHER person.
// They score if their answer matches the other person's self-answer.

const QUESTIONS = [
  { q: 'What is my favorite color?', options: ['Red', 'Blue', 'Green', 'Yellow', 'Black', 'White', 'Purple'] },
  { q: 'What is my favorite food?', options: ['Pizza', 'Biryani', 'Burger', 'Pasta', 'Dosa', 'Noodles'] },
  { q: 'Am I a morning person or night person?', options: ['Morning', 'Night', 'Both'] },
  { q: 'Coffee or Tea?', options: ['Coffee', 'Tea', 'Both', 'Neither'] },
  { q: 'What is my dream vacation?', options: ['Beach', 'Mountains', 'City', 'Adventure'] },
  { q: 'Am I an introvert or extrovert?', options: ['Introvert', 'Extrovert', 'In-between'] },
  { q: 'Favorite movie genre?', options: ['Action', 'Comedy', 'Drama', 'Horror', 'Romance', 'Sci-Fi'] },
  { q: 'Cats or Dogs?', options: ['Cats', 'Dogs', 'Both', 'Neither'] },
  { q: 'Early bird or night owl?', options: ['Early bird', 'Night owl'] },
  { q: 'Sweet or spicy?', options: ['Sweet', 'Spicy', 'Both', 'Neither'] },
  { q: 'Text or call?', options: ['Text', 'Call', 'Either'] },
  { q: 'Favorite season?', options: ['Summer', 'Winter', 'Monsoon', 'Spring', 'Autumn'] },
  { q: 'Favorite drink?', options: ['Water', 'Juice', 'Soda', 'Tea', 'Coffee', 'Milkshake'] },
  { q: 'Favorite dessert?', options: ['Ice cream', 'Cake', 'Chocolate', 'Fruit', 'Cookies'] },
  { q: 'Beach or mountains?', options: ['Beach', 'Mountains', 'Both'] },
  { q: 'What do I do to relax?', options: ['Music', 'Reading', 'Gaming', 'Sleeping', 'Walking'] },
  { q: 'Favourite time of day?', options: ['Dawn', 'Morning', 'Afternoon', 'Evening', 'Night'] },
  { q: 'Favorite sport to watch?', options: ['Cricket', 'Football', 'Tennis', 'Basketball', 'None'] },
  { q: 'Would I rather cook or order food?', options: ['Cook', 'Order', 'Both'] },
  { q: 'Favorite fruit?', options: ['Mango', 'Apple', 'Banana', 'Grapes', 'Watermelon', 'Orange'] }
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
  totalRounds: 6,
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
    const q = this.pickQuestion();

    // Round 1 → self-answer phase: each player answers about themselves
    // Round 2 → guess phase: each player answers about the OTHER person
    // Alternating: odd rounds = self, even rounds = guess
    const phase = r % 2 === 1 ? 'self' : 'guess';

    this.roundState[r] = {
      question: q.q,
      options: shuffle(q.options),
      phase,
      answers: {}, // userId -> choice
      resolved: false,
      roundStart: Date.now()
    };

    engine.emitToPlayers('game:friendquiz:start', {
      round: r,
      totalRounds: 6,
      question: q.q,
      options: this.roundState[r].options,
      phase // 'self' | 'guess'
    });

    // 15s
    engine.setTimer(15000, () => {
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
    if (st.answers[userId]) return { ok: false, error: 'ALREADY_PICKED' };

    const choice = String(payload?.choice || '');
    if (!st.options.includes(choice)) return { ok: false, error: 'BAD_CHOICE' };

    st.answers[userId] = choice;

    engine.io.to(`user:${userId}`).emit('game:friendquiz:locked', {
      round: r, choice
    });

    // If both answered → resolve
    if (st.answers[engine.playerAId] && st.answers[engine.playerBId]) {
      this.resolveRound(engine, r);
    }

    return { ok: true };
  },

  resolveRound(engine, r) {
    const st = this.roundState[r];
    if (st.resolved) return;
    st.resolved = true;

    const a = st.answers[engine.playerAId];
    const b = st.answers[engine.playerBId];

    if (st.phase === 'self') {
      // Self-phase: players answered about themselves. No points, just reveal.
      // The self-answers will be used in the NEXT (guess) round.
      engine.emitToPlayers('game:friendquiz:self-reveal', {
        round: r,
        playerA: a || null,
        playerB: b || null
      });
      engine.setTimer(1500, () => engine.roundComplete());
      return;
    }

    // Guess phase: Each player is guessing about the OTHER person.
    // We compare current 'guess' answers vs the previous round's 'self' answers.
    const prev = this.roundState[r - 1];
    if (!prev) {
      // Fallback: no previous — no points
      engine.emitToPlayers('game:friendquiz:result', {
        round: r,
        note: 'no previous self answers'
      });
      engine.setTimer(1500, () => engine.roundComplete());
      return;
    }

    // Player A's guess is about Player B (opposite)
    // Player B's guess is about Player A
    const aGuessedForB = a;
    const bGuessedForA = b;
    const bSelfAnswer = prev.answers[engine.playerBId];
    const aSelfAnswer = prev.answers[engine.playerAId];

    if (aGuessedForB && bSelfAnswer && aGuessedForB === bSelfAnswer) {
      engine.awardPoints(engine.playerAId, 2);
    }
    if (bGuessedForA && aSelfAnswer && bGuessedForA === aSelfAnswer) {
      engine.awardPoints(engine.playerBId, 2);
    }

    engine.emitToPlayers('game:friendquiz:result', {
      round: r,
      playerAGuessed: aGuessedForB,
      playerBGuessed: bGuessedForA,
      playerBAnswer: bSelfAnswer,
      playerAAnswer: aSelfAnswer,
      aCorrect: aGuessedForB === bSelfAnswer,
      bCorrect: bGuessedForA === aSelfAnswer
    });

    engine.setTimer(2000, () => engine.roundComplete());
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
