const QUESTIONS = [
  { q: 'What is the capital of India?', options: ['Mumbai', 'New Delhi', 'Kolkata', 'Chennai'], answer: 1 },
  { q: 'Which planet is closest to the Sun?', options: ['Venus', 'Earth', 'Mercury', 'Mars'], answer: 2 },
  { q: 'How many days in a leap year?', options: ['364', '365', '366', '367'], answer: 2 },
  { q: 'Largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3 },
  { q: 'Who wrote Romeo and Juliet?', options: ['Dickens', 'Shakespeare', 'Tolstoy', 'Hemingway'], answer: 1 },
  { q: 'What color is chlorophyll?', options: ['Red', 'Blue', 'Green', 'Yellow'], answer: 2 },
  { q: 'How many continents?', options: ['5', '6', '7', '8'], answer: 2 },
  { q: 'Chemical symbol for gold?', options: ['Go', 'Gd', 'Au', 'Ag'], answer: 2 },
  { q: 'Largest mammal?', options: ['Elephant', 'Blue whale', 'Giraffe', 'Hippo'], answer: 1 },
  { q: 'Fastest land animal?', options: ['Lion', 'Horse', 'Cheetah', 'Tiger'], answer: 2 },
  { q: 'How many sides in a hexagon?', options: ['5', '6', '7', '8'], answer: 1 },
  { q: 'Which gas do plants absorb?', options: ['Oxygen', 'Nitrogen', 'CO2', 'Hydrogen'], answer: 2 },
  { q: 'Tallest mountain?', options: ['K2', 'Everest', 'Kilimanjaro', 'Alps'], answer: 1 },
  { q: 'Which animal is known as "ship of the desert"?', options: ['Horse', 'Camel', 'Donkey', 'Elephant'], answer: 1 },
  { q: 'How many players in a cricket team?', options: ['9', '10', '11', '12'], answer: 2 },
  { q: 'Sun rises in which direction?', options: ['North', 'South', 'East', 'West'], answer: 2 },
  { q: 'Who invented the telephone?', options: ['Edison', 'Bell', 'Tesla', 'Newton'], answer: 1 },
  { q: 'What does "WWW" stand for?', options: ['World Wide Web', 'World Web Wide', 'Wide World Web', 'Web World Wide'], answer: 0 },
  { q: 'Largest country by area?', options: ['China', 'USA', 'Russia', 'Canada'], answer: 2 },
  { q: 'Which shape has no sides?', options: ['Triangle', 'Square', 'Circle', 'Pentagon'], answer: 2 },
  { q: 'Which is a prime number?', options: ['4', '9', '11', '15'], answer: 2 },
  { q: 'What is 12 x 12?', options: ['124', '132', '144', '154'], answer: 2 },
  { q: 'Which planet has rings?', options: ['Mars', 'Saturn', 'Venus', 'Mercury'], answer: 1 },
  { q: 'What is H2O?', options: ['Salt', 'Water', 'Oxygen', 'Hydrogen'], answer: 1 },
  { q: 'Which language has the most speakers?', options: ['English', 'Hindi', 'Chinese', 'Spanish'], answer: 2 },
  { q: 'Fastest bird?', options: ['Eagle', 'Peregrine falcon', 'Hawk', 'Ostrich'], answer: 1 },
  { q: 'How many zeros in one million?', options: ['5', '6', '7', '8'], answer: 1 },
  { q: 'Hardest natural substance?', options: ['Gold', 'Iron', 'Diamond', 'Quartz'], answer: 2 },
  { q: 'Which is a vowel?', options: ['B', 'E', 'K', 'M'], answer: 1 },
  { q: 'How many minutes in a day?', options: ['1200', '1440', '1600', '1800'], answer: 1 }
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
    const question = this.pickQuestion();

    // Shuffle options but keep track of correct answer
    const indexed = question.options.map((text, i) => ({ text, original: i }));
    const shuffled = shuffle(indexed);
    const correctIdx = shuffled.findIndex(o => o.original === question.answer);

    this.roundState[r] = {
      question: question.q,
      options: shuffled.map(o => o.text),
      correctIdx,
      answers: {}, // userId -> { idx, correct, at }
      resolved: false,
      roundStart: Date.now()
    };

    engine.emitToPlayers('game:quiz:question', {
      round: r,
      totalRounds: 6,
      question: question.q,
      options: this.roundState[r].options
    });

    // 12s per question
    engine.setTimer(12000, () => {
      if (!this.roundState[r].resolved) {
        this.resolveRound(engine, r);
      }
    });
  },

  handleAction(engine, { userId, action, payload }) {
    if (action !== 'answer') return { ok: false, error: 'BAD_ACTION' };
    const r = engine.round;
    const st = this.roundState[r];
    if (!st || st.resolved) return { ok: false, error: 'ROUND_OVER' };
    if (st.answers[userId]) return { ok: false, error: 'ALREADY_ANSWERED' };

    const idx = Number(payload?.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= st.options.length) {
      return { ok: false, error: 'BAD_INDEX' };
    }

    const correct = idx === st.correctIdx;
    st.answers[userId] = {
      idx,
      correct,
      at: Date.now()
    };

    // Only tell the user themselves their result so opponent doesn't copy
    engine.io.to(`user:${userId}`).emit('game:quiz:your-answer', {
      round: r, idx, correct
    });

    // Both answered → resolve
    if (st.answers[engine.playerAId] && st.answers[engine.playerBId]) {
      this.resolveRound(engine, r);
    }

    return { ok: true, correct };
  },

  resolveRound(engine, r) {
    const st = this.roundState[r];
    if (st.resolved) return;
    st.resolved = true;

    const a = st.answers[engine.playerAId];
    const b = st.answers[engine.playerBId];

    let winnerId = null;
    let aScore = 0;
    let bScore = 0;

    // Correct answer = 20 points + speed bonus
    const scoreFor = (ans) => {
      if (!ans || !ans.correct) return 0;
      const elapsed = ans.at - st.roundStart;
      const speedBonus = Math.max(1, Math.floor((12000 - elapsed) / 1500));
      return 20 + speedBonus;
    };

    aScore = scoreFor(a);
    bScore = scoreFor(b);

    if (aScore > 0) engine.awardPoints(engine.playerAId, aScore);
    if (bScore > 0) engine.awardPoints(engine.playerBId, bScore);

    if (aScore > bScore) winnerId = engine.playerAId;
    else if (bScore > aScore) winnerId = engine.playerBId;

    engine.emitToPlayers('game:quiz:result', {
      round: r,
      correctIdx: st.correctIdx,
      answers: {
        [engine.playerAId]: a ? { idx: a.idx, correct: a.correct, score: aScore } : null,
        [engine.playerBId]: b ? { idx: b.idx, correct: b.correct, score: bScore } : null
      },
      winnerId
    });

    engine.setTimer(1800, () => engine.roundComplete());
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
