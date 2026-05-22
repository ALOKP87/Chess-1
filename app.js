/* ============================================
   Royal Chess 3D - Main Application
   Game controller, UI, sound, vibration, AI, timer
   ============================================ */

// --- State ---
let engine = new ChessEngine();
let gameMode = 'pvp';
let flipped = false;
let selectedSquare = null;
let validMoves = [];
let lastMove = null;
let soundEnabled = true;
let statusTimeout = null;
let aiThinking = false;

// Timer state
let timerEnabled = true;
let whiteTime = 600; // 10 minutes in seconds
let blackTime = 600;
let timerInterval = null;

// --- Audio ---
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

const Sounds = {
  play(type) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      switch(type) {
        case 'move': this.tone(ctx,440,0.08,'sine',0.3); break;
        case 'capture': this.noise(ctx,0.1,0.4); this.tone(ctx,220,0.12,'square',0.2); break;
        case 'castle': this.tone(ctx,330,0.1,'sine',0.3); setTimeout(()=>this.tone(ctx,440,0.1,'sine',0.3),100); break;
        case 'check': this.tone(ctx,660,0.12,'sawtooth',0.25); setTimeout(()=>this.tone(ctx,880,0.12,'sawtooth',0.25),120); break;
        case 'checkmate': [660,880,1100,1320].forEach((f,i)=>setTimeout(()=>this.tone(ctx,f,0.2,'sine',0.3),i*150)); break;
        case 'select': this.tone(ctx,520,0.05,'sine',0.15); break;
        case 'error': this.tone(ctx,200,0.12,'square',0.2); break;
        case 'draw': [440,415,392].forEach((f,i)=>setTimeout(()=>this.tone(ctx,f,0.25,'sine',0.2),i*200)); break;
        case 'promote': [523,659,784].forEach((f,i)=>setTimeout(()=>this.tone(ctx,f,0.12,'sine',0.3),i*100)); break;
        case 'timeout': [400,300,200].forEach((f,i)=>setTimeout(()=>this.tone(ctx,f,0.3,'sawtooth',0.25),i*200)); break;
      }
    } catch(e) {}
  },
  tone(ctx,freq,dur,type,vol) {
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type; o.frequency.value=freq;
    g.gain.setValueAtTime(vol,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(ctx.currentTime); o.stop(ctx.currentTime+dur+0.01);
  },
  noise(ctx,dur,vol) {
    const sz=ctx.sampleRate*dur, buf=ctx.createBuffer(1,sz,ctx.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<sz;i++) d[i]=(Math.random()*2-1)*vol;
    const s=ctx.createBufferSource(), g=ctx.createGain();
    s.buffer=buf; g.gain.setValueAtTime(vol,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
    s.connect(g); g.connect(ctx.destination);
    s.start(ctx.currentTime); s.stop(ctx.currentTime+dur+0.01);
  }
};

function vibrate(pat) { if(navigator.vibrate) navigator.vibrate(pat); }

// --- Timer ---
function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

function updateTimerDisplay() {
  const wt = document.getElementById('whiteTimer');
  const bt = document.getElementById('blackTimer');
  wt.textContent = formatTime(whiteTime);
  bt.textContent = formatTime(blackTime);
  wt.classList.toggle('low', whiteTime <= 30);
  bt.classList.toggle('low', blackTime <= 30);
}

function startTimer() {
  stopTimer();
  if (!timerEnabled) return;
  timerInterval = setInterval(() => {
    if (engine.gameOver) { stopTimer(); return; }
    if (engine.turn === 'w') {
      whiteTime--;
      if (whiteTime <= 0) {
        whiteTime = 0;
        engine.gameOver = true;
        engine.gameResult = { type: 'timeout', winner: 'b' };
        stopTimer();
        Sounds.play('timeout');
        vibrate([200,100,200]);
        renderBoard();
        setTimeout(showGameOver, 500);
      }
    } else {
      blackTime--;
      if (blackTime <= 0) {
        blackTime = 0;
        engine.gameOver = true;
        engine.gameResult = { type: 'timeout', winner: 'w' };
        stopTimer();
        Sounds.play('timeout');
        vibrate([200,100,200]);
        renderBoard();
        setTimeout(showGameOver, 500);
      }
    }
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// --- Board Rendering ---
function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const dr = flipped ? 7-r : r;
      const dc = flipped ? 7-c : c;
      const sq = document.createElement('div');
      sq.className = 'square ' + ((dr+dc)%2===0 ? 'light' : 'dark');
      sq.dataset.row = dr;
      sq.dataset.col = dc;

      // Selected
      if (selectedSquare && selectedSquare.row===dr && selectedSquare.col===dc)
        sq.classList.add('selected');

      // Last move
      if (lastMove) {
        if (lastMove.fromRow===dr && lastMove.fromCol===dc) sq.classList.add('last-from');
        if (lastMove.toRow===dr && lastMove.toCol===dc) sq.classList.add('last-to');
      }

      // Check
      const piece = engine.getPiece(dr, dc);
      if (piece && piece.type==='k' && piece.color===engine.turn && engine.inCheck)
        sq.classList.add('check');

      // Valid move hints
      if (validMoves.some(m => m.toRow===dr && m.toCol===dc)) {
        const tgt = engine.getPiece(dr, dc);
        const isEP = engine.enPassant && engine.enPassant.row===dr && engine.enPassant.col===dc;
        sq.classList.add((tgt || isEP) ? 'hint-capture' : 'hint');
      }

      // Piece
      if (piece) {
        const pe = document.createElement('div');
        pe.className = 'piece';
        pe.innerHTML = ChessPieces.getSVG(piece.type, piece.color);
        sq.appendChild(pe);
      }

      // Click - use data attributes for closure-free binding
      sq.setAttribute('data-r', dr);
      sq.setAttribute('data-c', dc);
      sq.addEventListener('click', onSquareTap, { passive: true });

      boardEl.appendChild(sq);
    }
  }

  updateCapturedPieces();
  updatePlayerBars();
  updateTimerDisplay();
}

function onSquareTap(e) {
  const sq = e.currentTarget;
  const row = parseInt(sq.dataset.r);
  const col = parseInt(sq.dataset.c);
  handleSquareClick(row, col);
}

// --- Click / Move Logic ---
function handleSquareClick(row, col) {
  if (engine.gameOver || aiThinking) return;

  const piece = engine.getPiece(row, col);

  // If a piece is selected, check if this is a valid move target
  if (selectedSquare) {
    const movesHere = validMoves.filter(m => m.toRow === row && m.toCol === col);
    if (movesHere.length > 0) {
      // Check if this is a promotion move (multiple moves to same square with different promotions)
      if (movesHere[0].promotion) {
        showPromotionDialog(selectedSquare.row, selectedSquare.col, movesHere);
        return;
      }
      executeMove(selectedSquare.row, selectedSquare.col, movesHere[0]);
      return;
    }
  }

  // Select a piece of the current turn
  if (piece && piece.color === engine.turn) {
    if (gameMode === 'ai' && engine.turn === 'b') return;
    selectedSquare = { row, col };
    validMoves = engine.getLegalMoves(row, col);
    Sounds.play('select');
    vibrate(10);
    renderBoard();
  } else {
    // Deselect
    selectedSquare = null;
    validMoves = [];
    renderBoard();
  }
}

function executeMove(fromRow, fromCol, move) {
  const cap = engine.getPiece(move.toRow, move.toCol);
  const isCapture = !!cap || move.enPassant;
  const isCastle = !!move.castle;

  const rec = engine.makeMove(fromRow, fromCol, move);

  // Start timer on first move
  if (engine.moveHistory.length === 1) startTimer();

  // Sound & vibration
  if (engine.gameOver && engine.gameResult?.type === 'checkmate') {
    Sounds.play('checkmate'); vibrate([100,50,100,50,200]);
  } else if (engine.gameOver) {
    Sounds.play('draw'); vibrate(200);
  } else if (engine.inCheck) {
    Sounds.play('check'); vibrate([50,30,50]);
  } else if (isCastle) {
    Sounds.play('castle'); vibrate(30);
  } else if (isCapture) {
    Sounds.play('capture'); vibrate([20,20,40]);
  } else {
    Sounds.play('move'); vibrate(15);
  }

  selectedSquare = null;
  validMoves = [];
  lastMove = { fromRow, fromCol, toRow: move.toRow, toCol: move.toCol };

  renderBoard();

  if (engine.gameOver) {
    stopTimer();
    setTimeout(showGameOver, 500);
    return;
  }

  if (engine.inCheck) showStatus('Check!');

  // AI turn
  if (gameMode === 'ai' && engine.turn === 'b') {
    aiThinking = true;
    showStatus('Computer thinking...');
    setTimeout(() => {
      makeAIMove();
      aiThinking = false;
    }, 350);
  }
}

// --- Promotion Dialog ---
function showPromotionDialog(fromRow, fromCol, moves) {
  const dialog = document.getElementById('promotionDialog');
  const piecesDiv = document.getElementById('promoPieces');
  piecesDiv.innerHTML = '';

  const color = engine.turn;
  for (const type of ['q','r','b','n']) {
    const btn = document.createElement('div');
    btn.className = 'promo-piece';
    btn.innerHTML = ChessPieces.getSVG(type, color);
    btn.addEventListener('click', () => {
      const move = moves.find(m => m.promotion === type);
      dialog.classList.add('hidden');
      if (move) {
        Sounds.play('promote');
        executeMove(fromRow, fromCol, move);
      }
    });
    piecesDiv.appendChild(btn);
  }
  dialog.classList.remove('hidden');
}

// --- AI ---
function makeAIMove() {
  const all = engine.getAllLegalMoves('b');
  if (!all.length) return;

  let best = -Infinity, bestMoves = [];

  for (const m of all) {
    let score = 0;
    const piece = engine.board[m.fromRow][m.fromCol];
    const target = engine.board[m.toRow][m.toCol];

    // Capture value
    if (target) {
      score += pv(target.type) * 10;
      if (engine.isSquareAttacked(m.toRow, m.toCol, 'w')) score -= pv(piece.type) * 5;
    }
    if (m.enPassant) score += 10;
    if (m.castle) score += 30;
    if (m.promotion) score += pv(m.promotion) * 10;

    // Center control
    if ([3,4].includes(m.toRow) && [3,4].includes(m.toCol)) score += 3;
    if ([2,5].includes(m.toRow) && [2,5].includes(m.toCol)) score += 1;

    // Check detection (simulate)
    const saved = engine.board[m.toRow][m.toCol];
    engine.board[m.toRow][m.toCol] = piece;
    engine.board[m.fromRow][m.fromCol] = null;
    if (engine.isInCheck('w')) score += 15;
    engine.board[m.fromRow][m.fromCol] = piece;
    engine.board[m.toRow][m.toCol] = saved;

    // Development
    if (m.fromRow === 0 && m.toRow > 0) score += 2;
    // Pawn push
    if (piece.type === 'p') score += m.toRow;

    score += Math.random() * 2;

    if (score > best) { best = score; bestMoves = [m]; }
    else if (score === best) bestMoves.push(m);
  }

  const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  executeMove(chosen.fromRow, chosen.fromCol, chosen);
}

function pv(t) { return {p:1,n:3,b:3,r:5,q:9,k:0}[t]||0; }

// --- UI Updates ---
function updateCapturedPieces() {
  document.getElementById('whiteCaptured').innerHTML =
    engine.capturedPieces.w.sort((a,b)=>pv(b.type)-pv(a.type)).map(p=>ChessPieces.getSVG(p.type,p.color)).join('');
  document.getElementById('blackCaptured').innerHTML =
    engine.capturedPieces.b.sort((a,b)=>pv(b.type)-pv(a.type)).map(p=>ChessPieces.getSVG(p.type,p.color)).join('');
}

function updatePlayerBars() {
  document.getElementById('whiteBar').classList.toggle('active', engine.turn==='w');
  document.getElementById('blackBar').classList.toggle('active', engine.turn==='b');
  if (gameMode==='ai') {
    document.getElementById('whiteName').textContent = 'You';
    document.getElementById('blackName').textContent = 'Computer';
  } else {
    document.getElementById('whiteName').textContent = 'White';
    document.getElementById('blackName').textContent = 'Black';
  }
}

function showStatus(msg) {
  const el = document.getElementById('gameStatus');
  el.textContent = msg;
  el.classList.remove('hidden');
  if (statusTimeout) clearTimeout(statusTimeout);
  statusTimeout = setTimeout(() => el.classList.add('hidden'), 2000);
}

function showGameOver() {
  const dialog = document.getElementById('gameOverDialog');
  const title = document.getElementById('gameOverTitle');
  const msg = document.getElementById('gameOverMsg');
  const r = engine.gameResult;

  if (r.type === 'checkmate') {
    title.textContent = 'Checkmate!';
    msg.textContent = gameMode==='ai' ? (r.winner==='w'?'You win!':'Computer wins!') : (r.winner==='w'?'White wins!':'Black wins!');
  } else if (r.type === 'timeout') {
    title.textContent = 'Time Out!';
    msg.textContent = gameMode==='ai' ? (r.winner==='w'?'You win!':'Computer wins!') : (r.winner==='w'?'White wins!':'Black wins!');
  } else if (r.type === 'stalemate') {
    title.textContent = 'Stalemate!';
    msg.textContent = 'The game is a draw.';
  } else {
    title.textContent = 'Draw!';
    msg.textContent = 'Draw by ' + r.reason + '.';
  }
  dialog.classList.remove('hidden');
}

// --- Controls ---
function undoMove() {
  if (!engine.moveHistory.length || aiThinking) return;
  if (gameMode==='ai' && engine.moveHistory.length>=2 && engine.turn==='w') {
    engine.undoLastMove(); engine.undoLastMove();
  } else {
    engine.undoLastMove();
  }
  lastMove = engine.moveHistory.length > 0
    ? { fromRow: engine.moveHistory.at(-1).fromRow, fromCol: engine.moveHistory.at(-1).fromCol,
        toRow: engine.moveHistory.at(-1).toRow, toCol: engine.moveHistory.at(-1).toCol }
    : null;
  selectedSquare = null; validMoves = [];
  updateTimerDisplay();
  renderBoard();
  Sounds.play('move');
}

function flipBoard() {
  flipped = !flipped;
  renderBoard();
  vibrate(20);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById('btnSound').classList.toggle('muted', !soundEnabled);
  if (soundEnabled) Sounds.play('select');
}

function newGame() {
  engine.reset();
  selectedSquare = null; validMoves = []; lastMove = null;
  aiThinking = false; flipped = false;
  whiteTime = 600; blackTime = 600;
  stopTimer();
  document.getElementById('gameOverDialog').classList.add('hidden');
  document.getElementById('promotionDialog').classList.add('hidden');
  closeMenu();
  renderBoard();
  Sounds.play('select');
  vibrate(30);
}

function startGame(mode) {
  gameMode = mode;
  document.getElementById('splash').classList.remove('active');
  document.getElementById('game').classList.add('active');
  newGame();
}

function showMenu() { document.getElementById('menuOverlay').classList.remove('hidden'); }
function closeMenu() { document.getElementById('menuOverlay').classList.add('hidden'); }
function closeDialog(id) { document.getElementById(id).classList.add('hidden'); }

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  // Wire up button events
  document.getElementById('btnUndo').addEventListener('click', undoMove);
  document.getElementById('btnFlip').addEventListener('click', flipBoard);
  document.getElementById('btnMenu').addEventListener('click', showMenu);
  document.getElementById('btnSound').addEventListener('click', toggleSound);
  document.getElementById('btnNewGameOver').addEventListener('click', newGame);
  document.getElementById('btnReview').addEventListener('click', () => closeDialog('gameOverDialog'));
  document.getElementById('btnNewMenu').addEventListener('click', newGame);
  document.getElementById('btnResume').addEventListener('click', closeMenu);

  // Init audio on first touch
  document.addEventListener('touchstart', () => getAudioCtx(), { once: true });
  document.addEventListener('click', () => getAudioCtx(), { once: true });

  // Capacitor-specific initialization
  initCapacitor();
});

// --- Capacitor Integration ---
async function initCapacitor() {
  try {
    if (window.Capacitor) {
      // Status bar
      try {
        const { StatusBar } = window.Capacitor.Plugins;
        if (StatusBar) {
          await StatusBar.setStyle({ style: 'DARK' });
          await StatusBar.setBackgroundColor({ color: '#0f0f1a' });
        }
      } catch(e) {}

      // Splash screen
      try {
        const { SplashScreen } = window.Capacitor.Plugins;
        if (SplashScreen) {
          await SplashScreen.hide();
        }
      } catch(e) {}

      // Keyboard
      try {
        const { Keyboard } = window.Capacitor.Plugins;
        if (Keyboard) {
          Keyboard.setAccessoryBarVisible({ visible: false });
        }
      } catch(e) {}

      // Override vibration to use Capacitor Haptics if available
      try {
        const { Haptics } = window.Capacitor.Plugins;
        if (Haptics) {
          window._capHaptics = Haptics;
        }
      } catch(e) {}

      console.log('Capacitor plugins initialized');
    }
  } catch(e) {
    // Running in browser, not Capacitor - that's fine
  }
}
