const EMOJI_POOL = ['🍎','🍌','🍇','🍓','🍒','🍑','🥝','🍍','🥥','🍋','🍉','🥭'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = {
  totalRounds: 3,
  roundState: {},

  onStart(engine) {
    this.roundState = {};
    this.startRound(engine);
  },

  startRound(engine) {
    const r = engine.round;
    const pairs = Math.min(3 + r, 6);
    const emojis = shuffle(EMOJI_POOL).slice(0, pairs);
    const cards = shuffle([...emojis, ...emojis]);

    this.roundState[r] = {
      cards,
      flipped: {}, // userId -> first index
      matched: {}, // userId -> Set of matched indices
      scores: { [engine.playerAId]: 0, [engine.playerBId]: 0 }
    };

    engine.emitToPlayers('game:memory:start', {
      round: r,
      totalRounds: 3,
      cards: cards.map((_, i) => i), // only indices first
      cardCount: cards.length
    });
  },

  handleAction(engine, { userId, action, payload }) {
    if (action === 'flip') return this.handleFlip(engine, userId, payload);
    if (action === 'reveal') {
      // client requests card content (server tells both)
      return { ok: true };
    }
    return { ok: false, error: 'BAD_ACTION' };
  },

  handleFlip(engine, userId, payload) {
    const r = engine.round;
    const st = this.roundState[r];
    if (!st) return { ok: false, error: 'NO_ROUND' };

    const idx = Number(payload?.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= st.cards.length) {
      return { ok: false, error: 'BAD_INDEX' };
    }

    if (!st.matched[userId]) st.matched[userId] = new Set();
    if (st.matched[userId].has(idx)) return { ok: false, error: 'ALREADY_MATCHED' };

    // If first flip of this user's turn
    if (st.flipped[userId] === undefined) {
      st.flipped[userId] = idx;

      engine.emitToPlayers('game:memory:flip', {
        round: r,
        userId,
        index: idx,
        emoji: st.cards[idx],
        first: true
      });
      return { ok: true, first: true };
    }

    // Second flip → check match
    const first = st.flipped[userId];
    delete st.flipped[userId];

    const match = st.cards[first] === st.cards[idx];

    engine.emitToPlayers('game:memory:flip', {
      round: r,
      userId,
      index: idx,
      emoji: st.cards[idx],
      first: false,
      match,
      partnerIndex: first
    });

    if (match) {
      st.matched[userId].add(first);
      st.matched[userId].add(idx);
      engine.awardPoints(userId, 10);

      const totalMatched = st.matched[engine.playerAId].size + st.matched[engine.playerBId].size;
      if (totalMatched >= st.cards.length) {
        engine.setTimer(1200, () => engine.roundComplete());
      }
    }

    return { ok: true, match };
  },

  onFinish(engine) {
    return {
      details: { scores: engine.scores }
    };
  }
};
