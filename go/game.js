(function () {
  const setupEl = document.getElementById('setup');
  const gameEl = document.getElementById('game');
  const boardSizeSelect = document.getElementById('board-size');
  const startBtn = document.getElementById('start-btn');
  const boardContainer = document.getElementById('board-container');
  const newGameBtn = document.getElementById('new-game-btn');

  let state = null;

  startBtn.addEventListener('click', startGame);
  newGameBtn.addEventListener('click', () => {
    gameEl.classList.add('hidden');
    setupEl.classList.remove('hidden');
    newGameBtn.classList.add('hidden');
  });

  function startGame() {
    const size = parseInt(boardSizeSelect.value, 10);
    setupEl.classList.add('hidden');
    gameEl.classList.remove('hidden');
    initState(size);
    renderGame();
  }

  function initState(size) {
    const board = [];
    for (let r = 0; r < size; r++) {
      board[r] = [];
      for (let c = 0; c < size; c++) {
        board[r][c] = null;
      }
    }
    state = {
      board,
      size,
      currentPlayer: 'black',
      captures: { black: 0, white: 0 },
      passCount: 0,
      lastPositionByPlayer: { black: null, white: null },
      gameOver: false,
    };
  }

  function getAdjacent(size, row, col) {
    const adj = [];
    if (row > 0) adj.push([row - 1, col]);
    if (row < size - 1) adj.push([row + 1, col]);
    if (col > 0) adj.push([row, col - 1]);
    if (col < size - 1) adj.push([row, col + 1]);
    return adj;
  }

  function getGroup(board, size, row, col) {
    const color = board[row][col];
    if (!color) return [];
    const visited = new Set();
    const group = [];
    const stack = [[row, col]];

    while (stack.length) {
      const [r, c] = stack.pop();
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      if (board[r][c] !== color) continue;
      visited.add(key);
      group.push([r, c]);
      for (const [ar, ac] of getAdjacent(size, r, c)) {
        stack.push([ar, ac]);
      }
    }
    return group;
  }

  function getLiberties(board, size, row, col) {
    const group = getGroup(board, size, row, col);
    const liberties = new Set();
    for (const [r, c] of group) {
      for (const [ar, ac] of getAdjacent(size, r, c)) {
        if (board[ar][ac] === null) {
          liberties.add(`${ar},${ac}`);
        }
      }
    }
    return liberties;
  }

  function copyBoard(board, size) {
    const copy = [];
    for (let r = 0; r < size; r++) {
      copy[r] = [...board[r]];
    }
    return copy;
  }

  function serializeBoard(board, size) {
    let s = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        s += board[r][c] === null ? '.' : board[r][c][0];
      }
    }
    return s;
  }

  function simulateMove(board, size, row, col, player) {
    const b = copyBoard(board, size);
    let captured = 0;

    b[row][col] = player;
    const opponent = player === 'black' ? 'white' : 'black';

    for (const [ar, ac] of getAdjacent(size, row, col)) {
      if (b[ar][ac] === opponent) {
        const libs = getLiberties(b, size, ar, ac);
        if (libs.size === 0) {
          const group = getGroup(b, size, ar, ac);
          captured += group.length;
          for (const [gr, gc] of group) {
            b[gr][gc] = null;
          }
        }
      }
    }

    return { board: b, captured };
  }

  function isValidMove(row, col) {
    if (state.gameOver) return false;
    if (state.board[row][col] !== null) return false;

    const { board: afterBoard, captured } = simulateMove(
      state.board,
      state.size,
      row,
      col,
      state.currentPlayer
    );

    const myLiberties = getLiberties(afterBoard, state.size, row, col);
    if (myLiberties.size === 0 && captured === 0) return false;

    const lastByCurrent = state.lastPositionByPlayer[state.currentPlayer];
    if (lastByCurrent !== null) {
      if (serializeBoard(afterBoard, state.size) === lastByCurrent) {
        return false;
      }
    }

    return true;
  }

  function makeMove(row, col) {
    if (!isValidMove(row, col)) return;

    const { board: newBoard, captured } = simulateMove(
      state.board,
      state.size,
      row,
      col,
      state.currentPlayer
    );

    state.board = newBoard;
    state.captures[state.currentPlayer] += captured;
    state.lastPositionByPlayer[state.currentPlayer] = serializeBoard(
      newBoard,
      state.size
    );
    state.currentPlayer = state.currentPlayer === 'black' ? 'white' : 'black';
    state.passCount = 0;

    renderGame();
  }

  function pass() {
    if (state.gameOver) return;

    state.passCount++;
    state.currentPlayer = state.currentPlayer === 'black' ? 'white' : 'black';

    if (state.passCount >= 2) {
      state.gameOver = true;
    }

    renderGame();
  }

  function renderGame() {
    boardContainer.innerHTML = '';
    boardContainer.style.setProperty('--board-size', state.size);

    const statusEl = document.createElement('div');
    statusEl.className = 'game-status';
    if (state.gameOver) {
      statusEl.textContent = 'Game over';
    } else {
      statusEl.textContent =
        state.currentPlayer === 'black' ? 'Black to play' : 'White to play';
    }
    boardContainer.appendChild(statusEl);

    const passBtn = document.createElement('button');
    passBtn.className = 'pass-btn';
    passBtn.textContent = 'Pass';
    passBtn.type = 'button';
    passBtn.disabled = state.gameOver;
    passBtn.addEventListener('click', pass);
    boardContainer.appendChild(passBtn);

    const board = document.createElement('div');
    board.className = 'board';

    for (let row = 0; row < state.size; row++) {
      for (let col = 0; col < state.size; col++) {
        const cell = document.createElement('div');
        cell.className = 'intersection';
        if (col === state.size - 1) cell.classList.add('last-col');
        if (row === state.size - 1) cell.classList.add('last-row');
        cell.dataset.row = row;
        cell.dataset.col = col;

        const stone = state.board[row][col];
        if (stone) {
          const stoneEl = document.createElement('div');
          stoneEl.className = `stone stone-${stone}`;
          cell.appendChild(stoneEl);
          cell.classList.add('occupied');
        } else if (!state.gameOver && isValidMove(row, col)) {
          cell.classList.add('playable');
          cell.addEventListener('click', () => makeMove(row, col));
        }

        board.appendChild(cell);
      }
    }

    boardContainer.appendChild(board);

    if (state.gameOver) {
      const scoresEl = document.createElement('div');
      scoresEl.className = 'scores';
      scoresEl.textContent = `Black captures: ${state.captures.black} | White captures: ${state.captures.white}`;
      boardContainer.appendChild(scoresEl);
      newGameBtn.classList.remove('hidden');
    } else {
      newGameBtn.classList.add('hidden');
    }
  }
})();
