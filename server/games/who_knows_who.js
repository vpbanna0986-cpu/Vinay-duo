// Each round: one player is the "subject", the other is the "guesser".
// Subject picks their real answer; guesser tries to predict it.
// Points: +2 if guesser matches subject, +1 to subject if guesser misses.

const QUESTIONS = [
  { q: 'Favorite color?', options: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Black', 'White'] },
  { q: 'Favorite season?', options: ['Summer', 'Winter', 'Monsoon', 'Spring', 'Autumn'] },
  { q: 'Favorite food type?', options: ['Pizza', 'Biryani', 'Burger', 'Pasta', 'Dosa', 'Noodles'] },
  { q: 'Morning or night?', options: ['Morning', 'Night'] },
  { q: 'Coffee or tea?', options: ['Coffee', 'Tea', 'Both', 'Neither'] },
  { q: 'Favorite holiday?', options: ['Beach', 'Mountains', 'City', 'Home'] },
  { q: 'Favorite movie genre?', options: ['Action', 'Comedy', 'Drama', 'Horror', 'Romance', 'Sci-Fi'] },
  { q: 'Introvert or extrovert?', options: ['Introvert', 'Extrovert', 'In-between'] },
  { q: 'Favorite fruit?', options: ['Mango', 'Apple', 'Banana', 'Grapes', 'Orange', 'Watermelon'] },
  { q: 'Favorite sport?', options: ['Cricket', 'Football', 'Tennis', 'Badminton', 'Basketball', 'None'] },
  { q: 'Text or call?', options: ['Text', 'Call', 'Either'] },
  { q: 'Sweet or spicy?', options: ['Sweet', 'Spicy', 'Both', 'Neither'] },
  { q: 'Favorite time of day?', options: ['Dawn', 'Morning', 'Afternoon', 'Evening', 'Night'] },
  { q: 'Favorite drink?', options: ['Water', 'Juice', 'Soda', 'Tea', 'Coffee', 'Milkshake'] },
  { q: 'Cats or dogs?', options: ['Cats', 'Dogs', 'Both', 'Neither'] },
  { q: 'Favorite music mood?', options: ['Calm', 'Party', 'Sad', 'Romantic', 'Energetic'] },
  { q: 'Favorite weather?', options: ['Sunny', 'Rainy', 'Cloudy', 'Snowy', 'Windy'] },
  { q: 'Early bird or night owl?', options: ['Early bird', 'Night owl'] },
  { q: 'Favorite dessert?', options: ['Ice cream', 'Cake', 'Chocolate', 'Fruit', 'Cookies'] },
  { q: 'Beach or mountains?', options: ['Beach', 'Mountains', 'Both'] }
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

    // Alternate subject each round
    const subjectId = r % 2 === 1 ? engine.playerAId : engine.playerBId;
    const guesserId = r % 2 === 1 ? engine.playerBId : engine.playerAId;

    this.roundState[r] = {
      question: q.q,
      options: shuffle(q.options),
      subjectId,
      guesserId,
      subjectAnswer: null,
      guesserAnswer: null,
      resolved: false
    };

    engine.emitToPlayers('game:wkw:start', {
      round: r,
      totalRounds: 6,
      question: q.q,
      options: this.roundState[r].options,
      subjectId,
      guesserId
    });

    // 15s per round
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

    const choice = String(payload?.choice || '');
    if (!st.options.includes(choice)) return { ok: false, error: 'BAD_CHOICE' };

    if (userId === st.subjectId) {
      if (st.subjectAnswer) return { ok: false, error: 'ALREADY_PICKED' };
      st.subjectAnswer = choice;

      // Private confirm
      engine.io.to(`user:${userId}`).emit('game:wkw:subject-locked', {
        round: r, choice
      });

      // Inform guesser that subject has locked in
      engine.io.to(`user:${st.guesserId}`).emit('game:wkw:subject-ready', {
        round: r
      });
    } else if (userId === st.guesserId) {
      if (st.guesserAnswer) return { ok: false, error: 'ALREADY_PICKED' };
      st.guesserAnswer = choice;

      engine.io.to(`user:${userId}`).emit('game:wkw:guesser-locked', {
        round: r, choice
      });

      engine.io.to(`user:${st.subjectId}`).emit('game:wkw:guesser-ready', {
        round: r
      });
    } else {
      return { ok: false, error: 'NOT_A_PLAYER' };
    }

    // If both locked → resolve
    if (st.subjectAnswer && st.guesserAnswer) {
      this.resolveRound(engine, r);
    }

    return { ok: true };
  },

  resolveRound(engine, r) {
    const st = this.roundState[r];
    if (st.resolved) return;
    st.resolved = true;

    // Auto-fill missing
    if (!st.subjectAnswer) st.subjectAnswer = st.options[Math.floor(Math.random() * st.options.length)];
    if (!st.guesserAnswer) st.guesserAnswer = st.options[Math.floor(Math.random() * st.options.length)];

    const correct = st.guesserAnswer === st.subjectAnswer;

    if (correct) {
      engine.awardPoints(st.guesserId, 2);
      engine.awardPoints(st.subjectId, 1); // partial credit to subject
    } else {
      engine.awardPoints(st.subjectId, 1);
    }

    engine.emitToPlayers('game:wkw:result', {
      round: r,
      subjectId: st.subjectId,
      guesserId: st.guesserId,
      subjectAnswer: st.subjectAnswer,
      guesserAnswer: st.guesserAnswer,
      correct
    });

    engine.setTimer(1800, () => engine.roundComplete());
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
