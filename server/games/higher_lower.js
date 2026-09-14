module.exports = {
  totalRounds: 8,
  roundState: {},

  onStart(engine) {
    this.roundState = {};
    this.startRound(engine);
  },

  startRound(engine) {
    const r = engine.round;

    // Card 1 and Card 2 — values 1-100
    const card1 = 1 + Math.floor(Math.random() * 100);
    let card2;
    do {
      card2 = 1 + Math.floor(Math.random() * 100);
    } while (card2 === card1);

    this.roundState[r] = {
      card1,
      card2,
      picks: {}, // userId -> 'higher' | 'lower'
      resolved: false,
      roundStart: Date.now()
    };

    // Send same card1 to both, but hide card2 until both pick or timeout
    engine.emitToPlayers('game:hl:start', {
      round: r,
      totalRounds: 8,
      card1
    });

    // 8s to pick
    engine.setTimer(8000, () => {
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
    if (st.picks[userId]) return { ok: false, error: 'ALREADY_PICKED' };

    const pick = String(payload?.pick || '').toLowerCase();
    if (pick !== 'higher' && pick !== 'lower') {
      return { ok: false, error: 'BAD_PICK' };
    }

    st.picks[userId] = pick;

    // If both picked, resolve
    if (st.picks[engine.playerAId] && st.picks[engine.playerBId]) {
      this.resolveRound(engine, r);
    }

    return { ok: true };
  },

  resolveRound(engine, r) {
    const st = this.roundState[r];
    if (st.resolved) return;
    st.resolved = true;

    const actual = st.card2 > st.card1 ? 'higher' : 'lower';

    let winnerId = null;
    const results = {};

    for (const uid of [engine.playerAId, engine.playerBId]) {
      const pick = st.picks[uid];
      const correct = pick === actual;
      results[uid] = { pick: pick || null, correct };

      if (correct) {
        engine.awardPoints(uid, 1);
      }
    }

    // Winner = whoever got it correct (if only one)
    const a = results[engine.playerAId].correct;
    const b = results[engine.playerBId].correct;
    if (a && !b) winnerId = engine.playerAId;
    else if (b && !a) winnerId = engine.playerBId;
    // else tie (both correct or both wrong)

    engine.emitToPlayers('game:hl:result', {
      round: r,
      card1: st.card1,
      card2: st.card2,
      actual,
      winnerId,
      results
    });

    engine.setTimer(1600, () => engine.roundComplete());
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
