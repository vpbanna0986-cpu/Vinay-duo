// Truth-style questions — safe, friendly, age-appropriate.
// Each round: question shown. Both players choose whether they'd answer YES or NO.
// If they agree → +2 each. If they disagree → +1 each (fun reveal matters more).
// Mix of self-reflection + fun. Never embarrassing.

const QUESTIONS = [
  'Have you ever pretended to be busy to avoid someone?',
  'Do you talk to yourself when alone?',
  'Have you ever laughed so hard you cried?',
  'Do you check your phone first thing in the morning?',
  'Have you ever sung loudly in the shower?',
  'Do you dance when no one is watching?',
  'Have you ever forgotten someone\'s name right after meeting them?',
  'Do you ever re-watch your favorite shows?',
  'Have you ever stayed up all night for no reason?',
  'Do you talk to your pets like they understand you?',
  'Have you ever cried during a happy movie?',
  'Do you enjoy rainy days more than sunny days?',
  'Have you ever eaten food that fell on the floor?',
  'Do you plan your day in advance?',
  'Have you ever gotten lost in your own city?',
  'Do you enjoy meeting new people?',
  'Have you ever bought something and never used it?',
  'Do you make your bed every morning?',
  'Have you ever lied to get out of plans?',
  'Do you enjoy being alone sometimes?',
  'Have you ever forgotten an important birthday?',
  'Do you overthink conversations later?',
  'Have you ever screamed at a bug?',
  'Do you talk during movies?',
  'Have you ever eaten dessert before dinner?',
  'Do you feel sleepy after eating a big meal?',
  'Have you ever skipped a workout you planned?',
  'Do you enjoy trying new foods?',
  'Have you ever tripped in public?',
  'Do you talk to inanimate objects (like your phone or laptop)?',
  'Have you ever fallen asleep during a call?',
  'Do you drink enough water every day?'
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
    const available = QUESTIONS.filter(q => !this.usedQuestions.includes(q));
    if (available.length === 0) {
      this.usedQuestions = [];
      return this.pickQuestion();
    }
    const picked = available[Math.floor(Math.random() * available.length)];
    this.usedQuestions.push(picked);
    return picked;
  },

  startRound(engine) {
    const r = engine.round;
    const question = this.pickQuestion();

    this.roundState[r] = {
      question,
      answers: {
        [engine.playerAId]: null,
        [engine.playerBId]: null
      },
      resolved: false,
      roundStart: Date.now()
    };

    engine.emitToPlayers('game:truth:start', {
      round: r,
      totalRounds: 8,
      question
    });

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
    if (st.answers[userId] !== null) return { ok: false, error: 'ALREADY_ANSWERED' };

    const ans = String(payload?.answer || '').toUpperCase();
    if (ans !== 'YES' && ans !== 'NO') return { ok: false, error: 'BAD_ANSWER' };

    st.answers[userId] = ans;

    // Only confirm to the user; don't reveal to opponent
    engine.io.to(`user:${userId}`).emit('game:truth:locked', {
      round: r
    });

    if (
      st.answers[engine.playerAId] !== null &&
      st.answers[engine.playerBId] !== null
    ) {
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

    const agreement = a && b && a === b;

    if (agreement) {
      // Same answer → +2 each
      engine.awardPoints(engine.playerAId, 2);
      engine.awardPoints(engine.playerBId, 2);
    } else {
      // Different → +1 each (still encourage honesty)
      engine.awardPoints(engine.playerAId, 1);
      engine.awardPoints(engine.playerBId, 1);
    }

    engine.emitToPlayers('game:truth:result', {
      round: r,
      question: st.question,
      aAnswer: a || null,
      bAnswer: b || null,
      agreement
    });

    engine.setTimer(1800, () => engine.roundComplete());
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
