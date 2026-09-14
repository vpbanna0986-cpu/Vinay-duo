const ROWS = 6;
const COLS = 7;
const WIN_LEN = 4;

function makeBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

// Find lowest empty row in a column
function dropRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) return r;
  }
  return -1;
}

function checkWin(board, row, col, mark) {
  const dirs = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diag down-right
    [1, -1]   // diag down-left
  ];
  for (const [dr, dc] of dirs) {
    let count = 1;
    // forward
    for (let i = 1; i < WIN_LEN; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
      if (board[r][c] !== mark) break;
      count++;
    }
    // backward
    for (let i = 1; i < WIN_LEN; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
      if (board[r][c] !== mark) break;
      count++;
    }
    if (count >= WIN_LEN) return true;
  }
  return false;
}

function isFull(board) {
  return board[0].every(cell => cell !== null);
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
    const starter = r % 2 === 1 ? engine.playerAId : engine.playerBId;

    this.roundState[r] = {
      board: makeBoard(),
      turn: starter,
      marks: {
        [engine.playerAId]: 'R',
        [engine.playerBId]: 'Y'
      },
      resolved: false
    };

    engine.emitToPlayers('game:c4:start', {
      round: r,
      totalRounds: 3,
      rows: ROWS,
      cols: COLS,
      board: this.roundState[r].board,
      turn: starter,
      playerAId: engine.playerAId,
      playerBId: engine.playerBId
    });

    // 60s per round
    engine.setTimer(60000, () => {
      if (!this.roundState[r].resolved) {
        this.roundState[r].resolved = true;
        engine.emitToPlayers('game:c4:timeout', { round: r });
        engine.setTimer(1500, () => engine.roundComplete());
      }
    });
  },

  handleAction(engine, { userId, action, payload }) {
    if (action !== 'drop') return { ok: false, error: 'BAD_ACTION' };
    const r = engine.round;
    const st = this.roundState[r];
    if (!st || st.resolved) return { ok: false, error: 'ROUND_OVER' };
    if (userId !== st.turn) return { ok: false, error: 'NOT_YOUR_TURN' };

    const col = Number(payload?.col);
    if (!Number.isInteger(col) || col < 0 || col >= COLS) {
      return { ok: false, error: 'BAD_COL' };
    }

    const row = dropRow(st.board, col);
    if (row < 0) return { ok: false, error: 'COLUMN_FULL' };

    st.board[row][col] = st.marks[userId];

    const won = checkWin(st.board, row, col, st.marks[userId]);
    const otherId = userId === engine.playerAId ? engine.playerBId : engine.playerAId;

    engine.emitToPlayers('game:c4:drop', {
      round: r,
      row,
      col,
      mark: st.marks[userId],
      by: userId,
      board: st.board,
      turn: otherId
    });

    if (won) {
      st.resolved = true;
      engine.awardPoints(userId, 1);
      engine.emitToPlayers('game:c4:win', {
        round: r, winnerId: userId, board: st.board
      });
      engine.setTimer(1500, () => engine.roundComplete());
    } else if (isFull(st.board)) {
      st.resolved = true;
      engine.emitToPlayers('game:c4:tie', {
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
