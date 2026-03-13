const boardEl = document.getElementById('board');
const turnLabel = document.getElementById('turnLabel');
const stateLabel = document.getElementById('stateLabel');
const selectedLabel = document.getElementById('selectedLabel');
const moveLogEl = document.getElementById('moveLog');
const moveCountEl = document.getElementById('moveCount');
const whiteCapturedEl = document.getElementById('whiteCaptured');
const blackCapturedEl = document.getElementById('blackCaptured');
const whiteTimerEl = document.getElementById('whiteTimer');
const blackTimerEl = document.getElementById('blackTimer');
const legalMovesToggle = document.getElementById('legalMovesToggle');

const chess = new Chess();
let selectedSquare = null;
let hintedSquare = null;
let boardFlipped = false;
let lastMoveSquares = [];
const initialSeconds = 600;
let whiteSeconds = initialSeconds;
let blackSeconds = initialSeconds;
let activeColor = 'w';
let tickInterval = null;

const files = ['a','b','c','d','e','f','g','h'];
const pieces = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚'
};

function orderedSquares() {
  const ranks = boardFlipped ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1];
  const fileOrder = boardFlipped ? [...files].reverse() : files;
  const squares = [];
  for (const rank of ranks) {
    for (const file of fileOrder) squares.push(`${file}${rank}`);
  }
  return squares;
}

function renderBoard() {
  boardEl.innerHTML = '';
  const legalTargets = selectedSquare && legalMovesToggle.checked
    ? new Set(chess.moves({ square: selectedSquare, verbose: true }).map(m => m.to))
    : new Set();

  orderedSquares().forEach(square => {
    const file = square[0];
    const rank = Number(square[1]);
    const isLight = (files.indexOf(file) + rank) % 2 === 1;
    const piece = chess.get(square);
    const sq = document.createElement('button');
    sq.className = `square ${isLight ? 'light' : 'dark'}`;
    sq.dataset.square = square;
    if (square === selectedSquare) sq.classList.add('selected');
    if (lastMoveSquares.includes(square)) sq.classList.add('last-move');
    if (legalTargets.has(square)) sq.classList.add('legal');
    sq.innerHTML = `${piece ? pieces[piece.color + piece.type] : ''}`;

    if ((!boardFlipped && rank === 1) || (boardFlipped && rank === 8)) {
      const rankEl = document.createElement('span');
      rankEl.className = 'coord rank';
      rankEl.textContent = rank;
      sq.appendChild(rankEl);
    }
    if ((!boardFlipped && file === 'h') || (boardFlipped && file === 'a')) {
      const fileEl = document.createElement('span');
      fileEl.className = 'coord file';
      fileEl.textContent = file;
      sq.appendChild(fileEl);
    }

    sq.addEventListener('click', () => handleSquareClick(square));
    boardEl.appendChild(sq);
  });

  updateStatus();
}

function handleSquareClick(square) {
  const piece = chess.get(square);
  if (!selectedSquare) {
    if (piece && piece.color === chess.turn()) {
      selectedSquare = square;
      selectedLabel.textContent = square;
      renderBoard();
    }
    return;
  }

  if (selectedSquare === square) {
    selectedSquare = null;
    selectedLabel.textContent = 'None';
    renderBoard();
    return;
  }

  const move = chess.move({ from: selectedSquare, to: square, promotion: 'q' });
  if (move) {
    lastMoveSquares = [move.from, move.to];
    selectedSquare = null;
    selectedLabel.textContent = 'None';
    activeColor = chess.turn();
    updateCaptured();
    renderMoveLog();
    updateStatus();
    renderBoard();
    return;
  }

  if (piece && piece.color === chess.turn()) {
    selectedSquare = square;
    selectedLabel.textContent = square;
    renderBoard();
  } else {
    toast('Illegal move');
  }
}

function updateStatus() {
  turnLabel.textContent = chess.turn() === 'w' ? 'White' : 'Black';

  if (chess.isCheckmate()) {
    stateLabel.textContent = `Checkmate · ${chess.turn() === 'w' ? 'Black' : 'White'} wins`;
    stopClock();
  } else if (chess.isDraw()) {
    stateLabel.textContent = 'Draw';
    stopClock();
  } else if (chess.isCheck()) {
    stateLabel.textContent = `${chess.turn() === 'w' ? 'White' : 'Black'} in check`;
  } else {
    stateLabel.textContent = 'In progress';
  }
}

function renderMoveLog() {
  const history = chess.history();
  moveLogEl.innerHTML = '';
  for (let i = 0; i < history.length; i += 2) {
    const li = document.createElement('li');
    li.textContent = `${Math.floor(i / 2) + 1}. ${history[i]}${history[i + 1] ? ` ${history[i + 1]}` : ''}`;
    moveLogEl.appendChild(li);
  }
  moveCountEl.textContent = `${history.length} move${history.length === 1 ? '' : 's'}`;
}

function updateCaptured() {
  const start = {
    w: ['p','p','p','p','p','p','p','p','r','r','n','n','b','b','q','k'],
    b: ['p','p','p','p','p','p','p','p','r','r','n','n','b','b','q','k']
  };
  const current = { w: [], b: [] };
  for (const square of chess.SQUARES) {
    const piece = chess.get(square);
    if (piece) current[piece.color].push(piece.type);
  }

  const capturedByWhite = diffPieces(start.b, current.b).map(t => pieces['b' + t]).join(' ') || 'none';
  const capturedByBlack = diffPieces(start.w, current.w).map(t => pieces['w' + t]).join(' ') || 'none';
  blackCapturedEl.textContent = `Captured by White: ${capturedByWhite}`;
  whiteCapturedEl.textContent = `Captured by Black: ${capturedByBlack}`;
}

function diffPieces(start, current) {
  const currentCopy = [...current];
  const missing = [];
  for (const piece of start) {
    const idx = currentCopy.indexOf(piece);
    if (idx === -1) missing.push(piece);
    else currentCopy.splice(idx, 1);
  }
  return missing;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function renderClocks() {
  whiteTimerEl.textContent = formatTime(whiteSeconds);
  blackTimerEl.textContent = formatTime(blackSeconds);
}

function startClock() {
  stopClock();
  tickInterval = setInterval(() => {
    if (chess.isGameOver()) return;
    if (activeColor === 'w') {
      whiteSeconds = Math.max(0, whiteSeconds - 1);
      if (whiteSeconds === 0) {
        stateLabel.textContent = 'White flagged · Black wins';
        stopClock();
      }
    } else {
      blackSeconds = Math.max(0, blackSeconds - 1);
      if (blackSeconds === 0) {
        stateLabel.textContent = 'Black flagged · White wins';
        stopClock();
      }
    }
    renderClocks();
  }, 1000);
}

function stopClock() {
  clearInterval(tickInterval);
}

function resetClocks() {
  whiteSeconds = initialSeconds;
  blackSeconds = initialSeconds;
  activeColor = chess.turn();
  renderClocks();
  startClock();
}

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

document.getElementById('newGameBtn').addEventListener('click', () => {
  chess.reset();
  selectedSquare = null;
  hintedSquare = null;
  lastMoveSquares = [];
  renderMoveLog();
  updateCaptured();
  resetClocks();
  renderBoard();
});

document.getElementById('flipBtn').addEventListener('click', () => {
  boardFlipped = !boardFlipped;
  renderBoard();
});

document.getElementById('undoBtn').addEventListener('click', () => {
  const move = chess.undo();
  if (!move) return toast('Nothing to undo');
  lastMoveSquares = [];
  selectedSquare = null;
  activeColor = chess.turn();
  renderMoveLog();
  updateCaptured();
  renderBoard();
});

document.getElementById('hintBtn').addEventListener('click', () => {
  if (!selectedSquare) return toast('Select a piece first');
  const moves = chess.moves({ square: selectedSquare, verbose: true });
  toast(moves.length ? `${selectedSquare}: ${moves.map(m => m.to).join(', ')}` : 'No legal moves');
});

document.getElementById('copyFenBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(chess.fen());
    toast('FEN copied');
  } catch {
    toast('Copy failed');
  }
});

document.getElementById('resetClockBtn').addEventListener('click', () => {
  resetClocks();
  toast('Clocks reset');
});

legalMovesToggle.addEventListener('change', renderBoard);

renderMoveLog();
updateCaptured();
renderClocks();
renderBoard();
startClock();
