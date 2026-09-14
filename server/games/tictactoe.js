const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function checkWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
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

    // Round 1: A starts, Round 2: B starts, Round 3: A starts again
    const starter = r % 2 === 1 ? engine.playerAId : engine.playerBId;

    this.roundState[r] = {
      board: Array(9).fill(null),
      turn: starter,
      marks: {
        [engine.playerAId]: 'X',
        [engine.playerBId]: 'O'
      },
      resolved: false,
      moveCount: 0
    };

    engine.emitToPlayers('game:ttt:start', {
      round: r,
      totalRounds: 3,
      board: this.roundState[r].board,
      turn: starter,
      playerAId: engine.playerAId,
      playerBId: engine.playerBId
    });

    // 30s per round
    engine.setTimer(30000, () => {
      if (!this.roundState[r].resolved) {
        this.roundState[r].resolved = true;
        engine.emitToPlayers('game:ttt:timeout', { round: r });
        engine.setTimer(1500, () => engine.roundComplete());
      }
    });
  },

  handleAction(engine, { userId, action, payload }) {
    if (action !== 'move') return { ok: false, error: 'BAD_ACTION' };
    const r = engine.round;
    const st = this.roundState[r];
    if (!st || st.resolved) return { ok: false, error: 'ROUND_OVER' };
    if (userId !== st.turn) return { ok: false, error: 'NOT_YOUR_TURN' };

    const idx = Number(payload?.index);
    if (!Number.isInteger(idx) || idx < 0 || idx > 8) {
      return { ok: false, error: 'BAD_INDEX' };
    }
    if (st.board[idx]) return { ok: false, error: 'CELL_TAKEN' };

    st.board[idx] = st.marks[userId];
    st.moveCount++;

    const winnerMark = checkWinner(st.board);
    const otherId = userId === engine.playerAId ? engine.playerBId : engine.playerAId;

    engine.emitToPlayers('game:ttt:move', {
      round: r,
      index: idx,
      mark: st.marks[userId],
      by: userId,
      board: st.board,
      turn: otherId
    });

    if (winnerMark) {
      st.resolved = true;
      engine.awardPoints(userId, 1);
      engine.emitToPlayers('game:ttt:win', {
        round: r, winnerId: userId, board: st.board
      });
      engine.setTimer(1500, () => engine.roundComplete());
    } else if (st.moveCount >= 9) {
      st.resolved = true;
      engine.emitToPlayers('game:ttt:tie', {
        round: r, board: st.board
      });
      engine.setTimer(1500, () => engine.roundComplete());
    } else {
      st.turn = otherId;
    }

    return { ok: true };
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
