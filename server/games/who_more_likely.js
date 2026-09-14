// Both players choose who is MORE LIKELY to do something.
// Options: 'A' (player A), 'B' (player B), or 'Both' / 'Neither'.
// If both players agree on the same answer → +2 each.
// If they disagree → 0 points. Simple, fun, no wrong answers.

const QUESTIONS = [
  'Who is more likely to be late?',
  'Who is more likely to laugh at a bad joke?',
  'Who is more likely to text first?',
  'Who is more likely to forget a password?',
  'Who is more likely to sing in the shower?',
  'Who is more likely to eat the last slice?',
  'Who is more likely to stay up all night?',
  'Who is more likely to send a long voice note?',
  'Who is more likely to cry during a movie?',
  'Who is more likely to get lost in a new city?',
  'Who is more likely to talk to strangers?',
  'Who is more likely to become famous?',
  'Who is more likely to win a dance-off?',
  'Who is more likely to forget an important date?',
  'Who is more likely to be the group photographer?',
  'Who is more likely to try exotic food?',
  'Who is more likely to fall asleep during a movie?',
  'Who is more likely to become a millionaire?',
  'Who is more likely to lose their phone?',
  'Who is more likely to be the last one to reply?',
  'Who is more likely to be a morning person?',
  'Who is more likely to overthink?',
  'Who is more likely to be the planner?',
  'Who is more likely to be spontaneous?',
  'Who is more likely to be adventurous?'
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
      choices: {
        [engine.playerAId]: null,
        [engine.playerBId]: null
      },
      resolved: false,
      roundStart: Date.now()
    };

    engine.emitToPlayers('game:likely:start', {
      round: r,
      totalRounds: 8,
      question,
      playerAId: engine.playerAId,
      playerBId: engine.playerBId
    });

    engine.setTimer(12000, () => {
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
    if (!['A', 'B', 'BOTH', 'NEITHER'].includes(pick)) {
      return { ok: false, error: 'BAD_CHOICE' };
    }

    st.choices[userId] = pick;

    engine.io.to(`user:${userId}`).emit('game:likely:locked', {
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

    engine.emitToPlayers('game:likely:result', {
      round: r,
      question: st.question,
      aChoice: a || 'SKIPPED',
      bChoice: b || 'SKIPPED',
      agreement
    });

    engine.setTimer(1800, () => engine.roundComplete());
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
