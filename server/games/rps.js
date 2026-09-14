const CHOICES = ['rock', 'paper', 'scissors'];

function decide(a, b) {
  if (a === b) return 'tie';
  if (
    (a === 'rock' && b === 'scissors') ||
    (a === 'paper' && b === 'rock') ||
    (a === 'scissors' && b === 'paper')
  ) return 'a';
  return 'b';
}

module.exports = {
  totalRounds: 5,
  roundState: {},

  onStart(engine) {
    this.roundState = {};
    this.startRound(engine);
  },

  startRound(engine) {
    const r = engine.round;
    this.roundState[r] = {
      picks: {},
      resolved: false,
      roundStart: Date.now()
    };

    engine.emitToPlayers('game:rps:start', {
      round: r,
      totalRounds: 5,
      choices: CHOICES
    });

    // 15s to pick
    engine.setTimer(15000, () => {
      if (!this.roundState[r].resolved) {
        this.roundState[r].resolved = true;
        // Auto-pick random for anyone who didn't
        for (const uid of [engine.playerAId, engine.playerBId]) {
          if (!this.roundState[r].picks[uid]) {
            this.roundState[r].picks[uid] = CHOICES[Math.floor(Math.random() * 3)];
          }
        }
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

    const choice = String(payload?.choice || '').toLowerCase();
    if (!CHOICES.includes(choice)) return { ok: false, error: 'BAD_CHOICE' };

    st.picks[userId] = choice;

    // Tell the OTHER player only that this player has picked (no choice revealed yet)
    const otherId = userId === engine.playerAId ? engine.playerBId : engine.playerAId;
    engine.io.to(`user:${otherId}`).emit('game:rps:opponent-picked', {
      round: r
    });

    // If both picked, resolve
    if (st.picks[engine.playerAId] && st.picks[engine.playerBId]) {
      st.resolved = true;
      // Small delay so UI can show "both ready"
      engine.setTimer(600, () => this.resolveRound(engine, r));
    }

    return { ok: true };
  },

  resolveRound(engine, r) {
    const st = this.roundState[r];
    const a = st.picks[engine.playerAId];
    const b = st.picks[engine.playerBId];
    const result = decide(a, b);

    let winnerId = null;
    if (result === 'a') {
      winnerId = engine.playerAId;
      engine.awardPoints(winnerId, 1);
    } else if (result === 'b') {
      winnerId = engine.playerBId;
      engine.awardPoints(winnerId, 1);
    }

    engine.emitToPlayers('game:rps:result', {
      round: r,
      playerA: a,
      playerB: b,
      winnerId,
      tie: result === 'tie'
    });

    engine.setTimer(1500, () => engine.roundComplete());
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
