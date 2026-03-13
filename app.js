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
const soundToggle = document.getElementById('soundToggle');

const ChessCtor = window.Chess || window.exports?.Chess;
if (!ChessCtor) throw new Error('Chess engine failed to load');
const chess = new ChessCtor();

let selectedSquare = null;
let boardFlipped = false;
let lastMoveSquares = [];
const initialSeconds = 600;
let whiteSeconds = initialSeconds;
let blackSeconds = initialSeconds;
let activeColor = 'w';
let tickInterval = null;
let audioCtx = null;

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

function labelColor(color) {
  return color === 'w' ? '白方' : '黑方';
}

function playMoveSound(capture = false) {
  if (!soundToggle.checked) return;
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = capture ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(capture ? 520 : 660, now);
    osc.frequency.exponentialRampToValueAtTime(capture ? 380 : 520, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  } catch {}
}

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
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
    sq.type = 'button';
    sq.className = `square ${isLight ? 'light' : 'dark'}`;
    sq.dataset.square = square;
    if (piece) sq.dataset.pieceColor = piece.color;
    sq.setAttribute('aria-label', `${square}${piece ? ` ${piece.color === 'w' ? '白' : '黑'}${piece.type}` : ''}`);
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
    selectedLabel.textContent = '无';
    renderBoard();
    return;
  }

  const move = chess.move({ from: selectedSquare, to: square, promotion: 'q' });
  if (move) {
    lastMoveSquares = [move.from, move.to];
    selectedSquare = null;
    selectedLabel.textContent = '无';
    activeColor = chess.turn();
    playMoveSound(Boolean(move.captured));
    updateCaptured();
    renderMoveLog();
    renderBoard();
    return;
  }

  if (piece && piece.color === chess.turn()) {
    selectedSquare = square;
    selectedLabel.textContent = square;
    renderBoard();
  } else {
    toast('非法走子');
  }
}

function updateStatus() {
  turnLabel.textContent = labelColor(chess.turn());

  if (chess.isCheckmate()) {
    stateLabel.textContent = `将死 · ${labelColor(chess.turn() === 'w' ? 'b' : 'w')}获胜`;
    stopClock();
  } else if (chess.isDraw()) {
    stateLabel.textContent = '和棋';
    stopClock();
  } else if (chess.isCheck()) {
    stateLabel.textContent = `${labelColor(chess.turn())}被将军`;
  } else {
    stateLabel.textContent = '进行中';
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
  moveCountEl.textContent = `${history.length} 步`;
}

function updateCaptured() {
  const start = {
    w: ['p','p','p','p','p','p','p','p','r','r','n','n','b','b','q','k'],
    b: ['p','p','p','p','p','p','p','p','r','r','n','n','b','b','q','k']
  };
  const current = { w: [], b: [] };
  for (const square of orderedSquares()) {
    const piece = chess.get(square);
    if (piece) current[piece.color].push(piece.type);
  }

  const capturedByWhite = diffPieces(start.b, current.b).map(t => pieces['b' + t]).join(' ') || '无';
  const capturedByBlack = diffPieces(start.w, current.w).map(t => pieces['w' + t]).join(' ') || '无';
  blackCapturedEl.textContent = `被白方吃掉：${capturedByWhite}`;
  whiteCapturedEl.textContent = `被黑方吃掉：${capturedByBlack}`;
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
        stateLabel.textContent = '白方超时 · 黑方获胜';
        stopClock();
      }
    } else {
      blackSeconds = Math.max(0, blackSeconds - 1);
      if (blackSeconds === 0) {
        stateLabel.textContent = '黑方超时 · 白方获胜';
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

document.getElementById('newGameBtn').addEventListener('click', () => {
  chess.reset();
  selectedSquare = null;
  lastMoveSquares = [];
  selectedLabel.textContent = '无';
  renderMoveLog();
  updateCaptured();
  resetClocks();
  renderBoard();
  toast('新对局已开始');
});

document.getElementById('flipBtn').addEventListener('click', () => {
  boardFlipped = !boardFlipped;
  renderBoard();
});

document.getElementById('undoBtn').addEventListener('click', () => {
  const move = chess.undo();
  if (!move) return toast('当前无法悔棋');
  lastMoveSquares = [];
  selectedSquare = null;
  selectedLabel.textContent = '无';
  activeColor = chess.turn();
  renderMoveLog();
  updateCaptured();
  renderBoard();
  toast('已悔棋');
});

document.getElementById('hintBtn').addEventListener('click', () => {
  if (!selectedSquare) return toast('先选中一个棋子');
  const moves = chess.moves({ square: selectedSquare, verbose: true });
  toast(moves.length ? `${selectedSquare} 可走：${moves.map(m => m.to).join('、')}` : '没有合法走法');
});

document.getElementById('copyFenBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(chess.fen());
    toast('FEN 已复制');
  } catch {
    toast('复制失败');
  }
});

document.getElementById('resetClockBtn').addEventListener('click', () => {
  resetClocks();
  toast('计时器已重置');
});

legalMovesToggle.addEventListener('change', renderBoard);
soundToggle.addEventListener('change', () => toast(soundToggle.checked ? '已开启落子声音' : '已关闭落子声音'));

renderMoveLog();
updateCaptured();
renderClocks();
renderBoard();
startClock();
