// Classic "Would you rather?" — both pick A or B.
// If they pick the SAME → +2 each. If different → 0.

const QUESTIONS = [
  { a: 'Be able to fly', b: 'Be invisible' },
  { a: 'Never use social media again', b: 'Never watch movies again' },
  { a: 'Live without internet', b: 'Live without music' },
  { a: 'Always be 10 minutes late', b: 'Always be 20 minutes early' },
  { a: 'Have unlimited money', b: 'Have unlimited time' },
  { a: 'Speak every language', b: 'Play every instrument' },
  { a: 'Only eat sweet food', b: 'Only eat spicy food' },
  { a: 'Travel to the past', b: 'Travel to the future' },
  { a: 'Be the smartest person alive', b: 'Be the funniest person alive' },
  { a: 'Never sleep again', b: 'Never eat again' },
  { a: 'Have a personal chef', b: 'Have a personal driver' },
  { a: 'Live in space', b: 'Live underwater' },
  { a: 'Know when you will die', b: 'Know how you will die' },
  { a: 'Have super strength', b: 'Have super speed' },
  { a: 'Teleport anywhere', b: 'Read minds' },
  { a: 'Only talk in rhymes', b: 'Only sing instead of talk' },
  { a: 'Fight 100 duck-sized horses', b: 'Fight 1 horse-sized duck' },
  { a: 'Always be hot', b: 'Always be cold' },
  { a: 'Never work again', b: 'Work but love your job' },
  { a: 'Best pizza in the world once', b: 'Average pizza for life' },
  { a: 'Have a rewind button for life', b: 'Have a pause button for life' },
  { a: 'Only ever whisper', b: 'Only ever shout' },
  { a: 'Be famous for something embarrassing', b: 'Be unknown but rich' },
  { a: 'Forget your phone everywhere', b: 'Forget your wallet everywhere' },
  { a: 'Have 1000 true friends', b: 'Have 1 best friend for life' }
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
  totalRounds: 7,
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

    // Randomly flip sides
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

    engine.emitToPlayers('game:wyr:start', {
      round: r,
      totalRounds: 7,
      optionA,
      optionB
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
    if (pick !== 'A' && pick !== 'B') return { ok: false, error: 'BAD_CHOICE' };

    st.choices[userId] = pick;

    engine.io.to(`user:${userId}`).emit('game:wyr:locked', {
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

    engine.emitToPlayers('game:wyr:result', {
      round: r,
      optionA: st.optionA,
      optionB: st.optionB,
      aChoice: a || null,
      bChoice: b || null,
      agreement
    });

    engine.setTimer(1700, () => engine.roundComplete());
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
