// Both players get the same random challenge.
// First to complete gets 2 points, other gets 1 point (as long as they finish within time).

const CHALLENGES = [
  'Name 5 fruits in 15 seconds',
  'Name 5 animals starting with "S"',
  'Name 5 countries in 20 seconds',
  'Name 5 colors that are not basic',
  'Name 5 things found in a kitchen',
  'Name 5 Indian cities',
  'Name 5 movies you both likely watched',
  'Name 5 things that are round',
  'Name 5 things that are red',
  'Name 5 musical instruments',
  'Name 5 vegetables',
  'Name 5 things found in a bathroom',
  'Name 5 sports',
  'Name 5 school subjects',
  'Name 5 body parts',
  'Name 5 things in a bedroom',
  'Name 5 drinks',
  'Name 5 birds',
  'Name 5 festive items',
  'Name 5 words that rhyme with "day"',
  'Name 5 things in your pocket or bag',
  'Name 5 brands of cars',
  'Name 5 superheroes',
  'Name 5 apps on your phone',
  'Name 5 cartoon characters',
  'Name 5 breakfast foods',
  'Name 5 flowers',
  'Name 5 planets or stars',
  'Name 5 things made of wood',
  'Name 5 things you use daily'
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
  usedChallenges: [],

  onStart(engine) {
    this.roundState = {};
    this.usedChallenges = [];
    this.startRound(engine);
  },

  pickChallenge() {
    const available = CHALLENGES.filter(c => !this.usedChallenges.includes(c));
    if (available.length === 0) {
      this.usedChallenges = [];
      return this.pickChallenge();
    }
    const picked = available[Math.floor(Math.random() * available.length)];
    this.usedChallenges.push(picked);
    return picked;
  },

  startRound(engine) {
    const r = engine.round;
    const challenge = this.pickChallenge();

    this.roundState[r] = {
      challenge,
      done: {},
      resolved: false,
      roundStart: Date.now(),
      firstDone: null
    };

    engine.emitToPlayers('game:rchallenge:start', {
      round: r,
      totalRounds: 5,
      challenge,
      timeMs: 20000
    });

    engine.setTimer(20000, () => {
      if (!this.roundState[r].resolved) {
        this.roundState[r].resolved = true;
        engine.emitToPlayers('game:rchallenge:timeout', {
          round: r,
          done: this.roundState[r].done
        });
        engine.setTimer(1500, () => engine.roundComplete());
      }
    });
  },

  handleAction(engine, { userId, action }) {
    if (action !== 'done') return { ok: false, error: 'BAD_ACTION' };
    const r = engine.round;
    const st = this.roundState[r];
    if (!st || st.resolved) return { ok: false, error: 'ROUND_OVER' };
    if (st.done[userId]) return { ok: false, error: 'ALREADY_DONE' };

    st.done[userId] = Date.now();
    const first = !st.firstDone;
    if (first) st.firstDone = userId;

    engine.emitToPlayers('game:rchallenge:marked-done', {
      round: r, userId, first
    });

    // If both done → resolve
    if (st.done[engine.playerAId] && st.done[engine.playerBId]) {
      this.resolveRound(engine, r);
    }

    return { ok: true };
  },

  resolveRound(engine, r) {
    const st = this.roundState[r];
    if (st.resolved) return;
    st.resolved = true;

    const a = st.done[engine.playerAId];
    const b = st.done[engine.playerBId];

    if (a && b) {
      // faster one gets 2, other 1
      if (a < b) {
        engine.awardPoints(engine.playerAId, 2);
        engine.awardPoints(engine.playerBId, 1);
      } else {
        engine.awardPoints(engine.playerBId, 2);
        engine.awardPoints(engine.playerAId, 1);
      }
    } else if (a) {
      engine.awardPoints(engine.playerAId, 2);
    } else if (b) {
      engine.awardPoints(engine.playerBId, 2);
    }

    engine.emitToPlayers('game:rchallenge:result', {
      round: r,
      done: {
        [engine.playerAId]: !!a,
        [engine.playerBId]: !!b
      }
    });

    engine.setTimer(1600, () => engine.roundComplete());
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
