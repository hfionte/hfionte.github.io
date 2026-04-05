'use strict';

// ============================================================
// Premium square map
// ============================================================

const PREMIUM = (() => {
  const map = {};
  const set = (positions, type) =>
    positions.forEach(([r, c]) => { map[`${r},${c}`] = type; });

  // Triple Word
  set([[0,0],[0,7],[0,14],[7,0],[7,14],[14,0],[14,7],[14,14]], 'TW');

  // Double Word (diagonals toward center)
  set([
    [1,1],[2,2],[3,3],[4,4],[10,10],[11,11],[12,12],[13,13],
    [1,13],[2,12],[3,11],[4,10],[10,4],[11,3],[12,2],[13,1],
  ], 'DW');

  // Center star (also scores as DW)
  set([[7,7]], '★');

  // Triple Letter
  set([
    [1,5],[1,9],
    [5,1],[5,5],[5,9],[5,13],
    [9,1],[9,5],[9,9],[9,13],
    [13,5],[13,9],
  ], 'TL');

  // Double Letter
  set([
    [0,3],[0,11],
    [2,6],[2,8],
    [3,0],[3,7],[3,14],
    [6,2],[6,6],[6,8],[6,12],
    [7,3],[7,11],
    [8,2],[8,6],[8,8],[8,12],
    [11,0],[11,7],[11,14],
    [12,6],[12,8],
    [14,3],[14,11],
  ], 'DL');

  return map;
})();

// Display labels shown inside empty premium cells
const PREMIUM_LABEL = { TW: 'TW', DW: 'DW', TL: 'TL', DL: 'DL', '★': '★' };

// ============================================================
// Tile data
// ============================================================

const TILE_POINTS = {
  A:1,  B:3,  C:3,  D:2,  E:1,  F:4,  G:2,  H:4,
  I:1,  J:8,  K:5,  L:1,  M:3,  N:1,  O:1,  P:3,
  Q:10, R:1,  S:1,  T:1,  U:1,  V:4,  W:4,  X:8,
  Y:4,  Z:10, BLANK:0,
};

const TILE_BAG_DIST = {
  A:9,  B:2,  C:2,  D:4,  E:12, F:2,  G:3,  H:2,
  I:9,  J:1,  K:1,  L:4,  M:2,  N:6,  O:8,  P:2,
  Q:1,  R:6,  S:4,  T:6,  U:4,  V:2,  W:2,  X:1,
  Y:2,  Z:1,  BLANK:2,
};

// ============================================================
// Game state
// ============================================================

let state = null;

function createInitialState() {
  const bag = { ...TILE_BAG_DIST };
  const gameId = Math.random().toString(36).slice(2, 8);
  const p1Hand = drawTiles(bag, 7);
  const p2Hand = drawTiles(bag, 7);

  return {
    version: 1,
    gameId,
    turn: 'P1',
    board: Array.from({ length: 15 }, () => Array(15).fill('.')),
    bag,
    hands: { P1: p1Hand, P2: p2Hand },
    score: 0,
    lastMove: null,     // { cells: [[r,c],...], words: [...], points: n }
    consecutivePasses: 0,
    collabUsed: { P1: false, P2: false },
    gameOver: false,
  };
}

// Draw `count` random tiles from bag (mutates bag in place).
// Selection is weighted by remaining tile count so that e.g. E (12 tiles)
// is drawn proportionally more often than B (2 tiles).
function drawTiles(bag, count) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    const total = Object.values(bag).reduce((sum, n) => sum + n, 0);
    if (total === 0) break;
    let pick = Math.floor(Math.random() * total);
    for (const [letter, cnt] of Object.entries(bag)) {
      pick -= cnt;
      if (pick < 0) {
        bag[letter]--;
        if (bag[letter] === 0) delete bag[letter];
        drawn.push(letter);
        break;
      }
    }
  }
  return drawn;
}

// Count total tiles remaining in bag
function bagSize(bag) {
  return Object.values(bag).reduce((sum, n) => sum + n, 0);
}

// ============================================================
// UI state (not part of serialized game state)
// ============================================================

// Tiles placed on the board this turn, not yet committed.
// Each entry: { row, col, letter, isBlank, rackIndex }
let pendingPlacements = [];

// Index into the current player's hand that is currently selected.
let selectedRackIndex = null;

// Tiles marked for exchange (rackIndex[]).
let exchangeMarked = [];

// Set to true on first render after loading a state from URL, to trigger flash animation.
let flashLastMove = false;

// Live validation state — recomputed after every placement change.
// { valid: bool, allWordsKnown: bool, words: string[], points: number }
let liveValidity = { valid: false, allWordsKnown: false, words: [], points: 0 };

function updateLiveValidity() {
  if (pendingPlacements.length === 0) {
    liveValidity = { valid: false, allWordsKnown: false, words: [], points: 0 };
    return;
  }
  const { valid } = validatePlacements();
  if (!valid) {
    liveValidity = { valid: false, allWordsKnown: false, words: [], points: 0 };
    return;
  }
  const allWords = collectWords();
  const allWordsKnown = typeof WORDS === 'undefined'
    || allWords.every(w => WORDS.has(w.word.toLowerCase()));
  liveValidity = {
    valid: allWordsKnown,
    allWordsKnown,
    words: allWords.map(w => w.word),
    points: allWordsKnown ? calculateScore() : 0,
  };
}

// ============================================================
// Rendering
// ============================================================

function render() {
  updateLiveValidity();
  renderBoard();
  renderRacks();
  renderButtons();
  renderPointPreview();
  flashLastMove = false;
}

function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';

  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      const premium = PREMIUM[`${r},${c}`];
      if (premium) cell.dataset.premium = premium;

      const pending = pendingPlacements.find(p => p.row === r && p.col === c);
      const boardLetter = state.board[r][c];

      if (pending) {
        // Tile placed this turn — highlight, click to recall
        const validityClass = pendingPlacements.length > 0
          ? (liveValidity.valid ? 'play-valid' : 'play-invalid')
          : '';
        const tileEl = makeBoardTileEl(pending.letter, pending.isBlank, true, false, validityClass);
        tileEl.style.pointerEvents = 'auto';
        tileEl.style.cursor = 'pointer';
        tileEl.addEventListener('click', (e) => { e.stopPropagation(); recallTile(pending); });
        cell.appendChild(tileEl);

      } else if (boardLetter !== '.') {
        // Committed tile from a previous turn
        const isLastMove = state.lastMove?.cells?.some(([lr, lc]) => lr === r && lc === c);
        const isBlank = boardLetter === boardLetter.toLowerCase() && boardLetter !== '.';
        const letter = boardLetter.toUpperCase();
        const flashClass = (isLastMove && flashLastMove) ? 'last-move-flash' : '';
        cell.appendChild(makeBoardTileEl(letter, isBlank, false, isLastMove, flashClass));

      } else {
        // Empty cell — show premium label, add drop target highlight when tile selected
        if (premium) {
          const label = document.createElement('span');
          label.className = 'cell-label';
          label.textContent = PREMIUM_LABEL[premium];
          cell.appendChild(label);
        }
        if (selectedRackIndex !== null) {
          cell.classList.add('drop-target');
        }
        cell.addEventListener('click', () => placeSelectedTile(r, c));
      }

      boardEl.appendChild(cell);
    }
  }
}

function makeBoardTileEl(letter, isBlank, justPlaced, isLastMove, extraClass = '') {
  const el = document.createElement('div');
  el.className = 'cell-tile'
    + (justPlaced  ? ' just-placed' : '')
    + (isLastMove  ? ' last-move'   : '')
    + (extraClass  ? ' ' + extraClass : '');

  const letterSpan = document.createElement('span');
  letterSpan.textContent = letter;
  el.appendChild(letterSpan);

  if (!isBlank) {
    const pts = document.createElement('span');
    pts.className = 'tile-points';
    pts.textContent = TILE_POINTS[letter] ?? '';
    el.appendChild(pts);
  }

  return el;
}

function renderRacks() {
  const isBlindMode = localStorage.getItem('collabble_blind') === '1';
  const partnerTurn = state.turn === 'P1' ? 'P2' : 'P1';

  renderRack('your-rack',     state.hands[state.turn],    false,       true);
  renderRack('partner-rack',  state.hands[partnerTurn],   isBlindMode, false);
}

function renderRack(elId, hand, blind, interactive) {
  const el = document.getElementById(elId);
  el.innerHTML = '';

  hand.forEach((letter, i) => {
    const isPlaced = interactive && pendingPlacements.some(p => p.rackIndex === i);
    const tile = document.createElement('div');

    if (isPlaced) {
      tile.className = 'tile tile-placeholder';
      el.appendChild(tile);
      return;
    }

    const isBlankTile = letter === 'BLANK';
    tile.className = 'tile'
      + (blind       ? ' blind'   : '')
      + (isBlankTile ? ' is-blank' : '');

    if (interactive && selectedRackIndex === i) tile.classList.add('selected');

    if (!blind) {
      const letterSpan = document.createElement('span');
      letterSpan.textContent = isBlankTile ? '' : letter;
      tile.appendChild(letterSpan);

      const pts = document.createElement('span');
      pts.className = 'tile-points';
      pts.textContent = isBlankTile ? '0' : (TILE_POINTS[letter] ?? '');
      tile.appendChild(pts);
    }

    if (interactive) {
      tile.addEventListener('click', () => selectRackTile(i));
    }

    el.appendChild(tile);
  });
}

function renderButtons() {
  const hasPlaced = pendingPlacements.length > 0;
  document.getElementById('btn-end-turn').disabled  = !hasPlaced || state.gameOver;
  document.getElementById('btn-exchange').disabled  = state.gameOver;
  document.getElementById('btn-pass').disabled      = state.gameOver;

  const collabUsed = state.collabUsed?.[state.turn] ?? false;
  const btnCollab  = document.getElementById('btn-collab');
  btnCollab.disabled = collabUsed || state.gameOver || hasPlaced;
  btnCollab.classList.toggle('used', collabUsed);

  const turnDisplay = document.getElementById('turn-display');
  turnDisplay.textContent = state.gameOver
    ? 'Game over!'
    : (state.turn === 'P1' ? "Player 1's turn" : "Player 2's turn");

  document.getElementById('score-display').textContent = `Score: ${state.score}`;
}

function renderPointPreview() {
  const el = document.getElementById('point-preview');
  if (pendingPlacements.length === 0) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  if (liveValidity.valid) {
    const wordList = liveValidity.words.join(', ');
    el.textContent = `${wordList} — ${liveValidity.points} pts`;
    el.classList.remove('invalid');
  } else {
    el.textContent = 'Not a valid play';
    el.classList.add('invalid');
  }
}

// ============================================================
// Tile placement interactions
// ============================================================

function selectRackTile(index) {
  if (state.gameOver) return;
  selectedRackIndex = selectedRackIndex === index ? null : index;
  render();
}

function placeSelectedTile(row, col) {
  if (selectedRackIndex === null) return;
  if (state.gameOver) return;
  if (state.board[row][col] !== '.') return;
  if (pendingPlacements.some(p => p.row === row && p.col === col)) return;

  const hand = state.hands[state.turn];
  const letter = hand[selectedRackIndex];

  if (letter === 'BLANK') {
    showBlankModal(row, col, selectedRackIndex);
    return;
  }

  pendingPlacements.push({ row, col, letter, isBlank: false, rackIndex: selectedRackIndex });
  selectedRackIndex = null;
  render();
}

function recallTile(placement) {
  pendingPlacements = pendingPlacements.filter(p => p !== placement);
  if (selectedRackIndex === null) selectedRackIndex = placement.rackIndex;
  render();
}

function recallAllTiles() {
  pendingPlacements = [];
  selectedRackIndex = null;
  render();
}

// ============================================================
// Blank tile modal
// ============================================================

function showBlankModal(row, col, rackIndex) {
  const modal = document.getElementById('modal-blank');
  const grid  = document.getElementById('letter-grid');
  grid.innerHTML = '';

  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
    const btn = document.createElement('button');
    btn.className = 'letter-choice';
    btn.textContent = letter;
    btn.addEventListener('click', () => {
      // Store blank-assigned letters as lowercase on the board
      pendingPlacements.push({ row, col, letter, isBlank: true, rackIndex });
      selectedRackIndex = null;
      modal.classList.add('hidden');
      render();
    });
    grid.appendChild(btn);
  });

  modal.classList.remove('hidden');
}

document.getElementById('modal-blank').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.add('hidden');
    selectedRackIndex = null;
    renderRacks();
  }
});

// ============================================================
// Turn actions
// ============================================================

// Commit pending placements to the board, refill hand from bag.
function commitPlacements() {
  const hand = state.hands[state.turn];
  const usedIndices = new Set(pendingPlacements.map(p => p.rackIndex));

  // Write tiles to board (blanks stored as lowercase)
  pendingPlacements.forEach(({ row, col, letter, isBlank }) => {
    state.board[row][col] = isBlank ? letter.toLowerCase() : letter;
  });

  // Remove used tiles from hand (highest indices first to preserve order)
  [...usedIndices].sort((a, b) => b - a).forEach(i => hand.splice(i, 1));

  // Draw replacements
  const drawn = drawTiles(state.bag, usedIndices.size);
  hand.push(...drawn);

  return usedIndices.size;
}

// Validate that all pending placements form a legal Scrabble play.
// Returns { valid: bool, reason: string | null }
function validatePlacements() {
  if (pendingPlacements.length === 0) return { valid: false, reason: 'No tiles placed.' };

  const rows = pendingPlacements.map(p => p.row);
  const cols = pendingPlacements.map(p => p.col);
  const minR = Math.min(...rows), maxR = Math.max(...rows);
  const minC = Math.min(...cols), maxC = Math.max(...cols);

  const isHorizontal = minR === maxR;
  const isVertical   = minC === maxC;

  // All tiles must be in the same row or same column
  if (!isHorizontal && !isVertical) {
    return { valid: false, reason: 'Tiles must all be in the same row or column.' };
  }

  // No gaps allowed in the run (existing board tiles may fill gaps)
  if (isHorizontal) {
    for (let c = minC; c <= maxC; c++) {
      const filled = state.board[minR][c] !== '.'
        || pendingPlacements.some(p => p.row === minR && p.col === c);
      if (!filled) return { valid: false, reason: 'There are gaps in your word.' };
    }
  } else {
    for (let r = minR; r <= maxR; r++) {
      const filled = state.board[r][minC] !== '.'
        || pendingPlacements.some(p => p.row === r && p.col === minC);
      if (!filled) return { valid: false, reason: 'There are gaps in your word.' };
    }
  }

  // First word must cover the center star
  const isFirstPlay = state.board.every(row => row.every(c => c === '.'));
  if (isFirstPlay) {
    const coversCentre = pendingPlacements.some(p => p.row === 7 && p.col === 7);
    if (!coversCentre) return { valid: false, reason: 'First word must cover the centre star.' };
  } else {
    // Subsequent plays must connect to existing tiles
    const connects = pendingPlacements.some(({ row, col }) =>
      [[row-1,col],[row+1,col],[row,col-1],[row,col+1]].some(([r,c]) =>
        r >= 0 && r < 15 && c >= 0 && c < 15 && state.board[r][c] !== '.'
      )
    );
    if (!connects) return { valid: false, reason: 'Word must connect to tiles already on the board.' };
  }

  return { valid: true, reason: null };
}

// Collect all words formed by the current pending placements.
// Returns [{ word: string, cells: [[r,c],...] }]
function collectWords() {
  // Build a temporary board with pending tiles overlaid
  const temp = state.board.map(row => [...row]);
  pendingPlacements.forEach(({ row, col, letter, isBlank }) => {
    temp[row][col] = isBlank ? letter.toLowerCase() : letter;
  });

  const pendingSet = new Set(pendingPlacements.map(p => `${p.row},${p.col}`));
  const words = [];
  const seen  = new Set();

  function scanLine(cells) {
    // Split line into contiguous runs of length >= 2 that include a pending cell
    let run = [];
    for (const [r, c] of cells) {
      if (temp[r][c] !== '.') {
        run.push([r, c]);
      } else {
        if (run.length >= 2 && run.some(([pr, pc]) => pendingSet.has(`${pr},${pc}`))) {
          const key = run.map(([pr,pc]) => `${pr},${pc}`).join('|');
          if (!seen.has(key)) { seen.add(key); words.push({ word: run.map(([pr,pc]) => temp[pr][pc].toUpperCase()).join(''), cells: run }); }
        }
        run = [];
      }
    }
    if (run.length >= 2 && run.some(([pr, pc]) => pendingSet.has(`${pr},${pc}`))) {
      const key = run.map(([pr,pc]) => `${pr},${pc}`).join('|');
      if (!seen.has(key)) { seen.add(key); words.push({ word: run.map(([pr,pc]) => temp[pr][pc].toUpperCase()).join(''), cells: run }); }
    }
  }

  // Scan the row(s) and column(s) touched by pending tiles
  const touchedRows = new Set(pendingPlacements.map(p => p.row));
  const touchedCols = new Set(pendingPlacements.map(p => p.col));

  touchedRows.forEach(r => scanLine(Array.from({length:15},(_,c)=>[r,c])));
  touchedCols.forEach(c => scanLine(Array.from({length:15},(_,r)=>[r,c])));

  return words;
}

// Calculate score for the current pending placements (before committing).
// Returns total points for this turn.
function calculateScore() {
  const temp = state.board.map(row => [...row]);
  pendingPlacements.forEach(({ row, col, letter, isBlank }) => {
    temp[row][col] = isBlank ? letter.toLowerCase() : letter;
  });

  const pendingSet = new Set(pendingPlacements.map(p => `${p.row},${p.col}`));
  const allWords = collectWords();
  let total = 0;

  allWords.forEach(({ cells }) => {
    let wordScore = 0;
    let wordMultiplier = 1;

    cells.forEach(([r, c]) => {
      const ltr = temp[r][c].toUpperCase();
      const pts = TILE_POINTS[ltr] ?? 0;
      const isNew = pendingSet.has(`${r},${c}`);
      const premium = PREMIUM[`${r},${c}`];

      let letterScore = pts;
      if (isNew) {
        if (premium === 'DL') letterScore = pts * 2;
        if (premium === 'TL') letterScore = pts * 3;
        if (premium === 'DW' || premium === '★') wordMultiplier *= 2;
        if (premium === 'TW') wordMultiplier *= 3;
      }
      wordScore += letterScore;
    });

    total += wordScore * wordMultiplier;
  });

  // Bingo bonus: all 7 tiles used
  if (pendingPlacements.length === 7) total += 50;

  return total;
}

// ============================================================
// Button handlers
// ============================================================

document.getElementById('btn-end-turn').addEventListener('click', () => {
  // --- Validate placement geometry ---
  const { valid, reason } = validatePlacements();
  if (!valid) { alert(reason); return; }

  // --- Word validation (requires wordlist.js to be loaded) ---
  const allWords = collectWords();
  if (typeof WORDS !== 'undefined') {
    const invalid = allWords.filter(w => !WORDS.has(w.word.toLowerCase()));
    if (invalid.length > 0) {
      alert(`Not a valid word: ${invalid.map(w => w.word).join(', ')}`);
      return;
    }
  }

  // --- Score ---
  const points = calculateScore();
  const movedCells = pendingPlacements.map(p => [p.row, p.col]);

  state.lastMove = {
    cells: movedCells,
    words: allWords.map(w => w.word),
    points,
  };
  state.score += points;
  state.consecutivePasses = 0;

  // --- Commit tiles and advance turn ---
  commitPlacements();
  pendingPlacements = [];
  selectedRackIndex = null;
  state.turn = state.turn === 'P1' ? 'P2' : 'P1';

  // Check end-of-game (bag empty and active player has no tiles)
  if (bagSize(state.bag) === 0 && state.hands[state.turn].length === 0) {
    state.gameOver = true;
  }

  render();
  showShareModal({ lastMove: state.lastMove });
});

document.getElementById('btn-pass').addEventListener('click', () => {
  recallAllTiles();
  state.consecutivePasses++;
  if (state.consecutivePasses >= 2) state.gameOver = true;
  state.lastMove = null;
  state.turn = state.turn === 'P1' ? 'P2' : 'P1';
  render();
  if (!state.gameOver) showShareModal();
});

// ============================================================
// Exchange tiles
// ============================================================

document.getElementById('btn-exchange').addEventListener('click', () => {
  if (state.gameOver) return;
  if (bagSize(state.bag) < 7) {
    alert('There are fewer than 7 tiles left in the bag — exchanging is not allowed.');
    return;
  }
  recallAllTiles();

  // Populate the exchange rack
  const hand = state.hands[state.turn];
  const exchangeRackEl = document.getElementById('exchange-rack');
  exchangeRackEl.innerHTML = '';
  exchangeMarked = [];

  hand.forEach((letter, i) => {
    const tile = document.createElement('div');
    const isBlankTile = letter === 'BLANK';
    tile.className = 'tile' + (isBlankTile ? ' is-blank' : '');

    const letterSpan = document.createElement('span');
    letterSpan.textContent = isBlankTile ? '' : letter;
    tile.appendChild(letterSpan);

    const pts = document.createElement('span');
    pts.className = 'tile-points';
    pts.textContent = isBlankTile ? '0' : (TILE_POINTS[letter] ?? '');
    tile.appendChild(pts);

    tile.addEventListener('click', () => {
      const idx = exchangeMarked.indexOf(i);
      if (idx === -1) {
        exchangeMarked.push(i);
        tile.classList.add('marked-for-exchange');
      } else {
        exchangeMarked.splice(idx, 1);
        tile.classList.remove('marked-for-exchange');
      }
      document.getElementById('btn-confirm-exchange').disabled = exchangeMarked.length === 0;
    });

    exchangeRackEl.appendChild(tile);
  });

  document.getElementById('btn-confirm-exchange').disabled = true;
  document.getElementById('modal-exchange').classList.remove('hidden');
});

document.getElementById('btn-confirm-exchange').addEventListener('click', () => {
  if (exchangeMarked.length === 0) return;

  const hand = state.hands[state.turn];
  // Return marked tiles to bag
  exchangeMarked.forEach(i => {
    const letter = hand[i];
    state.bag[letter] = (state.bag[letter] ?? 0) + 1;
  });

  // Remove them from hand (highest first to preserve indices)
  [...exchangeMarked].sort((a, b) => b - a).forEach(i => hand.splice(i, 1));

  // Draw replacements
  const drawn = drawTiles(state.bag, exchangeMarked.length);
  hand.push(...drawn);

  state.consecutivePasses++;
  if (state.consecutivePasses >= 2) state.gameOver = true;
  state.lastMove = null;
  state.turn = state.turn === 'P1' ? 'P2' : 'P1';
  exchangeMarked = [];

  document.getElementById('modal-exchange').classList.add('hidden');
  render();
  if (!state.gameOver) showShareModal();
});

document.getElementById('btn-cancel-exchange').addEventListener('click', () => {
  exchangeMarked = [];
  document.getElementById('modal-exchange').classList.add('hidden');
});

document.getElementById('modal-exchange').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    exchangeMarked = [];
    e.currentTarget.classList.add('hidden');
  }
});

// ============================================================
// Share URL modal
// ============================================================

function showShareModal({ title, hint, lastMove } = {}) {
  const encoded = encodeState(state);
  const url = location.origin + location.pathname + '#' + encoded;
  history.replaceState(null, '', '#' + encoded);

  document.getElementById('share-modal-title').textContent =
    title ?? 'Send to your partner';

  let hintText = hint ?? 'Copy this link and send it to your partner to continue the game.';
  if (lastMove && lastMove.words.length > 0) {
    hintText = `You played ${lastMove.words.join(', ')} for ${lastMove.points} points! ` + hintText;
  }
  document.getElementById('share-modal-hint').textContent = hintText;

  document.getElementById('share-url-display').textContent = url;
  document.getElementById('btn-copy-share').textContent = 'Copy Link';
  document.getElementById('modal-share').classList.remove('hidden');
}

document.getElementById('btn-copy-url').addEventListener('click', () => {
  showShareModal();
});

document.getElementById('btn-copy-share').addEventListener('click', () => {
  const url = document.getElementById('share-url-display').textContent;
  navigator.clipboard.writeText(url).then(() => {
    document.getElementById('btn-copy-share').textContent = 'Copied ✓';
  });
});

document.getElementById('btn-close-share').addEventListener('click', () => {
  document.getElementById('modal-share').classList.add('hidden');
});

document.getElementById('modal-share').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
});

// ============================================================
// Collab trade
// ============================================================

let collabYourIndex   = null;
let collabPartnerIndex = null;

document.getElementById('btn-collab').addEventListener('click', () => {
  if (state.collabUsed[state.turn] || state.gameOver) return;

  collabYourIndex    = null;
  collabPartnerIndex = null;

  const partner = state.turn === 'P1' ? 'P2' : 'P1';
  const yourHand    = state.hands[state.turn];
  const partnerHand = state.hands[partner];

  function buildCollabRack(elId, hand, onSelect) {
    const el = document.getElementById(elId);
    el.innerHTML = '';
    hand.forEach((letter, i) => {
      const tile = document.createElement('div');
      const isBlankTile = letter === 'BLANK';
      tile.className = 'tile' + (isBlankTile ? ' is-blank' : '');
      tile.dataset.index = i;

      const letterSpan = document.createElement('span');
      letterSpan.textContent = isBlankTile ? '' : letter;
      tile.appendChild(letterSpan);

      const pts = document.createElement('span');
      pts.className = 'tile-points';
      pts.textContent = isBlankTile ? '0' : (TILE_POINTS[letter] ?? '');
      tile.appendChild(pts);

      tile.addEventListener('click', () => onSelect(i, el));
      el.appendChild(tile);
    });
  }

  function highlightSelected(containerEl, selectedIndex) {
    containerEl.querySelectorAll('.tile').forEach(t => {
      t.classList.toggle('selected', parseInt(t.dataset.index) === selectedIndex);
    });
    updateCollabConfirm();
  }

  function updateCollabConfirm() {
    document.getElementById('btn-confirm-collab').disabled =
      collabYourIndex === null || collabPartnerIndex === null;
  }

  buildCollabRack('collab-your-rack', yourHand, (i, el) => {
    collabYourIndex = i;
    highlightSelected(el, i);
  });

  buildCollabRack('collab-partner-rack', partnerHand, (i, el) => {
    collabPartnerIndex = i;
    highlightSelected(el, i);
  });

  document.getElementById('btn-confirm-collab').disabled = true;
  document.getElementById('modal-collab').classList.remove('hidden');
});

document.getElementById('btn-confirm-collab').addEventListener('click', () => {
  if (collabYourIndex === null || collabPartnerIndex === null) return;

  const partner   = state.turn === 'P1' ? 'P2' : 'P1';
  const yourHand  = state.hands[state.turn];
  const partHand  = state.hands[partner];

  // Swap the tiles
  const yourTile  = yourHand[collabYourIndex];
  const partTile  = partHand[collabPartnerIndex];
  yourHand[collabYourIndex]    = partTile;
  partHand[collabPartnerIndex] = yourTile;

  if (!state.collabUsed) state.collabUsed = { P1: false, P2: false };
  state.collabUsed[state.turn] = true;

  collabYourIndex    = null;
  collabPartnerIndex = null;

  document.getElementById('modal-collab').classList.add('hidden');
  render();
});

document.getElementById('btn-cancel-collab').addEventListener('click', () => {
  collabYourIndex = collabPartnerIndex = null;
  document.getElementById('modal-collab').classList.add('hidden');
});

document.getElementById('modal-collab').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    collabYourIndex = collabPartnerIndex = null;
    e.currentTarget.classList.add('hidden');
  }
});

// ============================================================
// Shuffle rack
// ============================================================

document.getElementById('btn-shuffle').addEventListener('click', () => {
  if (pendingPlacements.length > 0) return; // don't shuffle mid-placement
  const hand = state.hands[state.turn];
  for (let i = hand.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [hand[i], hand[j]] = [hand[j], hand[i]];
  }
  selectedRackIndex = null;
  renderRacks();
});

// ============================================================
// Blind mode
// ============================================================

document.getElementById('blind-toggle').addEventListener('click', () => {
  const isBlind = localStorage.getItem('collabble_blind') === '1';
  localStorage.setItem('collabble_blind', isBlind ? '0' : '1');
  document.getElementById('blind-toggle').textContent = isBlind ? '👁' : '🙈';
  renderRacks();
});

// ============================================================
// New Game
// ============================================================

document.getElementById('btn-new-game').addEventListener('click', () => {
  if (!confirm('Start a new game? The current game will be lost.')) return;
  pendingPlacements = [];
  selectedRackIndex = null;
  exchangeMarked = [];
  state = createInitialState();
  render();
  showShareModal({
    title: 'New game ready — share with your partner',
    hint: "Send this link to your partner. Whoever's turn it is goes first.",
  });
});

// ============================================================
// Init
// ============================================================

function init() {
  if (location.hash.length > 1) {
    try {
      state = decodeState(location.hash.slice(1));
      if (state.lastMove && state.lastMove.words.length > 0) {
        flashLastMove = true;
        showLastMoveBanner(state.lastMove);
      }
    } catch (e) {
      console.warn('Failed to decode state from URL, starting fresh.', e);
      state = createInitialState();
      showShareModal({
        title: 'Game ready — share with your partner',
        hint: "Send this link to your partner. Whoever's turn it is goes first.",
      });
    }
  } else {
    state = createInitialState();
    showShareModal({
      title: 'Game ready — share with your partner',
      hint: "Send this link to your partner. Whoever's turn it is goes first.",
    });
  }

  render();
}

function showLastMoveBanner(lastMove) {
  const banner = document.getElementById('last-move-banner');
  const partnerLabel = state.turn === 'P1' ? 'Player 2' : 'Player 1';
  banner.innerHTML = `${partnerLabel} played <strong>${lastMove.words.join(', ')}</strong> for <strong>${lastMove.points} points</strong>!`;
  banner.classList.remove('hidden');
  setTimeout(() => banner.classList.add('hidden'), 5000);
}

init();
