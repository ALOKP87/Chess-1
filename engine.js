/* ============================================
   Royal Chess 3D - Chess Engine
   Complete rules: all moves, castling, en passant,
   promotion, check, checkmate, stalemate, draws
   ============================================ */

class ChessEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = this.createInitialBoard();
    this.turn = 'w';
    this.castling = { wK: true, wQ: true, bK: true, bQ: true };
    this.enPassant = null;
    this.halfMoveClock = 0;
    this.fullMoveNumber = 1;
    this.moveHistory = [];
    this.positionHistory = [];
    this.capturedPieces = { w: [], b: [] };
    this.gameOver = false;
    this.gameResult = null;
    this.inCheck = false;
    this.savePosition();
  }

  createInitialBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    const back = ['r','n','b','q','k','b','n','r'];
    for (let c = 0; c < 8; c++) {
      board[0][c] = { type: back[c], color: 'b' };
      board[1][c] = { type: 'p', color: 'b' };
      board[6][c] = { type: 'p', color: 'w' };
      board[7][c] = { type: back[c], color: 'w' };
    }
    return board;
  }

  getPiece(r, c) {
    if (r < 0 || r > 7 || c < 0 || c > 7) return null;
    return this.board[r][c];
  }

  // --- Move Generation ---

  getPawnMoves(row, col, color) {
    const moves = [];
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    const promoRow = color === 'w' ? 0 : 7;

    // Forward one
    const fr = row + dir;
    if (fr >= 0 && fr <= 7 && !this.board[fr][col]) {
      if (fr === promoRow) {
        ['q','r','b','n'].forEach(t => moves.push({ toRow: fr, toCol: col, promotion: t }));
      } else {
        moves.push({ toRow: fr, toCol: col });
        // Forward two from start
        const fr2 = row + 2 * dir;
        if (row === startRow && !this.board[fr2][col]) {
          moves.push({ toRow: fr2, toCol: col });
        }
      }
    }

    // Captures
    for (const dc of [-1, 1]) {
      const tc = col + dc;
      if (tc < 0 || tc > 7) continue;
      const target = this.board[fr]?.[tc];
      if (target && target.color !== color) {
        if (fr === promoRow) {
          ['q','r','b','n'].forEach(t => moves.push({ toRow: fr, toCol: tc, promotion: t }));
        } else {
          moves.push({ toRow: fr, toCol: tc });
        }
      }
      // En passant
      if (this.enPassant && this.enPassant.row === fr && this.enPassant.col === tc) {
        moves.push({ toRow: fr, toCol: tc, enPassant: true });
      }
    }
    return moves;
  }

  getKnightMoves(row, col, color) {
    const moves = [];
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const tr = row+dr, tc = col+dc;
      if (tr < 0 || tr > 7 || tc < 0 || tc > 7) continue;
      const t = this.board[tr][tc];
      if (!t || t.color !== color) moves.push({ toRow: tr, toCol: tc });
    }
    return moves;
  }

  getSlidingMoves(row, col, color, dirs) {
    const moves = [];
    for (const [dr, dc] of dirs) {
      let tr = row + dr, tc = col + dc;
      while (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7) {
        const t = this.board[tr][tc];
        if (!t) {
          moves.push({ toRow: tr, toCol: tc });
        } else {
          if (t.color !== color) moves.push({ toRow: tr, toCol: tc });
          break;
        }
        tr += dr; tc += dc;
      }
    }
    return moves;
  }

  getKingMoves(row, col, color) {
    const moves = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const tr = row+dr, tc = col+dc;
        if (tr < 0 || tr > 7 || tc < 0 || tc > 7) continue;
        const t = this.board[tr][tc];
        if (!t || t.color !== color) moves.push({ toRow: tr, toCol: tc });
      }
    }

    // Castling
    const r = color === 'w' ? 7 : 0;
    const opp = color === 'w' ? 'b' : 'w';
    if (row === r && col === 4) {
      // Kingside
      const kFlag = color === 'w' ? 'wK' : 'bK';
      if (this.castling[kFlag] &&
          !this.board[r][5] && !this.board[r][6] &&
          this.board[r][7] && this.board[r][7].type === 'r' && this.board[r][7].color === color &&
          !this.isSquareAttacked(r, 4, opp) && !this.isSquareAttacked(r, 5, opp) && !this.isSquareAttacked(r, 6, opp)) {
        moves.push({ toRow: r, toCol: 6, castle: 'K' });
      }
      // Queenside
      const qFlag = color === 'w' ? 'wQ' : 'bQ';
      if (this.castling[qFlag] &&
          !this.board[r][3] && !this.board[r][2] && !this.board[r][1] &&
          this.board[r][0] && this.board[r][0].type === 'r' && this.board[r][0].color === color &&
          !this.isSquareAttacked(r, 4, opp) && !this.isSquareAttacked(r, 3, opp) && !this.isSquareAttacked(r, 2, opp)) {
        moves.push({ toRow: r, toCol: 2, castle: 'Q' });
      }
    }
    return moves;
  }

  getRawMoves(row, col) {
    const p = this.board[row][col];
    if (!p) return [];
    switch (p.type) {
      case 'p': return this.getPawnMoves(row, col, p.color);
      case 'n': return this.getKnightMoves(row, col, p.color);
      case 'b': return this.getSlidingMoves(row, col, p.color, [[-1,-1],[-1,1],[1,-1],[1,1]]);
      case 'r': return this.getSlidingMoves(row, col, p.color, [[-1,0],[1,0],[0,-1],[0,1]]);
      case 'q': return this.getSlidingMoves(row, col, p.color, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
      case 'k': return this.getKingMoves(row, col, p.color);
      default: return [];
    }
  }

  isSquareAttacked(row, col, byColor) {
    // Pawns
    const pd = byColor === 'w' ? 1 : -1;
    for (const dc of [-1, 1]) {
      const pr = row + pd, pc = col + dc;
      if (pr >= 0 && pr <= 7 && pc >= 0 && pc <= 7) {
        const p = this.board[pr][pc];
        if (p && p.type === 'p' && p.color === byColor) return true;
      }
    }
    // Knights
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const nr = row+dr, nc = col+dc;
      if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
        const p = this.board[nr][nc];
        if (p && p.type === 'n' && p.color === byColor) return true;
      }
    }
    // Diagonals (bishop/queen)
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      let r = row+dr, c = col+dc;
      while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
        const p = this.board[r][c];
        if (p) { if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true; break; }
        r += dr; c += dc;
      }
    }
    // Straights (rook/queen)
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      let r = row+dr, c = col+dc;
      while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
        const p = this.board[r][c];
        if (p) { if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true; break; }
        r += dr; c += dc;
      }
    }
    // King
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const kr = row+dr, kc = col+dc;
        if (kr >= 0 && kr <= 7 && kc >= 0 && kc <= 7) {
          const p = this.board[kr][kc];
          if (p && p.type === 'k' && p.color === byColor) return true;
        }
      }
    }
    return false;
  }

  findKing(color) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.board[r][c] && this.board[r][c].type === 'k' && this.board[r][c].color === color)
          return { row: r, col: c };
    return null;
  }

  isInCheck(color) {
    const k = this.findKing(color);
    return k ? this.isSquareAttacked(k.row, k.col, color === 'w' ? 'b' : 'w') : false;
  }

  getLegalMoves(row, col) {
    const p = this.board[row][col];
    if (!p || p.color !== this.turn) return [];
    return this.getRawMoves(row, col).filter(m => this.isMoveLegal(row, col, m));
  }

  isMoveLegal(fr, fc, move) {
    const piece = this.board[fr][fc];
    const cap = this.board[move.toRow][move.toCol];
    const oldEP = this.enPassant;
    let epCap = null;

    // Make move
    this.board[move.toRow][move.toCol] = piece;
    this.board[fr][fc] = null;

    if (move.enPassant) {
      const epR = piece.color === 'w' ? move.toRow + 1 : move.toRow - 1;
      epCap = this.board[epR][move.toCol];
      this.board[epR][move.toCol] = null;
    }

    let rookFrom, rookTo, rook;
    if (move.castle) {
      rookFrom = move.castle === 'K' ? { r: move.toRow, c: 7 } : { r: move.toRow, c: 0 };
      rookTo = move.castle === 'K' ? { r: move.toRow, c: 5 } : { r: move.toRow, c: 3 };
      rook = this.board[rookFrom.r][rookFrom.c];
      this.board[rookTo.r][rookTo.c] = rook;
      this.board[rookFrom.r][rookFrom.c] = null;
    }

    const check = this.isInCheck(piece.color);

    // Undo
    this.board[fr][fc] = piece;
    this.board[move.toRow][move.toCol] = cap;
    if (move.enPassant) {
      const epR = piece.color === 'w' ? move.toRow + 1 : move.toRow - 1;
      this.board[epR][move.toCol] = epCap;
    }
    if (move.castle) {
      this.board[rookFrom.r][rookFrom.c] = rook;
      this.board[rookTo.r][rookTo.c] = null;
    }
    this.enPassant = oldEP;

    return !check;
  }

  getAllLegalMoves(color) {
    const all = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.board[r][c] && this.board[r][c].color === color)
          for (const m of this.getLegalMoves(r, c))
            all.push({ fromRow: r, fromCol: c, ...m });
    return all;
  }

  makeMove(fr, fc, move) {
    const piece = this.board[fr][fc];
    const cap = this.board[move.toRow][move.toCol];
    const rec = {
      fromRow: fr, fromCol: fc,
      toRow: move.toRow, toCol: move.toCol,
      piece: { ...piece },
      captured: cap ? { ...cap } : null,
      promotion: move.promotion || null,
      enPassant: !!move.enPassant,
      castle: move.castle || null,
      prevCastling: { ...this.castling },
      prevEnPassant: this.enPassant,
      prevHalfMoveClock: this.halfMoveClock
    };

    // En passant capture
    if (move.enPassant) {
      const epR = piece.color === 'w' ? move.toRow + 1 : move.toRow - 1;
      rec.epCaptured = { ...this.board[epR][move.toCol] };
      rec.epRow = epR;
      this.capturedPieces[piece.color].push(this.board[epR][move.toCol]);
      this.board[epR][move.toCol] = null;
    }

    if (cap) this.capturedPieces[piece.color].push(cap);

    // Move piece
    this.board[move.toRow][move.toCol] = piece;
    this.board[fr][fc] = null;

    // Promotion
    if (move.promotion) {
      this.board[move.toRow][move.toCol] = { type: move.promotion, color: piece.color };
    }

    // Castling - move rook
    if (move.castle) {
      if (move.castle === 'K') {
        this.board[move.toRow][5] = this.board[move.toRow][7];
        this.board[move.toRow][7] = null;
      } else {
        this.board[move.toRow][3] = this.board[move.toRow][0];
        this.board[move.toRow][0] = null;
      }
    }

    // Update castling rights
    if (piece.type === 'k') {
      if (piece.color === 'w') { this.castling.wK = false; this.castling.wQ = false; }
      else { this.castling.bK = false; this.castling.bQ = false; }
    }
    if (piece.type === 'r') {
      if (fr === 7 && fc === 0) this.castling.wQ = false;
      if (fr === 7 && fc === 7) this.castling.wK = false;
      if (fr === 0 && fc === 0) this.castling.bQ = false;
      if (fr === 0 && fc === 7) this.castling.bK = false;
    }
    if (cap && cap.type === 'r') {
      if (move.toRow === 7 && move.toCol === 0) this.castling.wQ = false;
      if (move.toRow === 7 && move.toCol === 7) this.castling.wK = false;
      if (move.toRow === 0 && move.toCol === 0) this.castling.bQ = false;
      if (move.toRow === 0 && move.toCol === 7) this.castling.bK = false;
    }

    // En passant target
    if (piece.type === 'p' && Math.abs(move.toRow - fr) === 2) {
      this.enPassant = { row: (fr + move.toRow) / 2, col: fc };
    } else {
      this.enPassant = null;
    }

    // Half move clock
    this.halfMoveClock = (piece.type === 'p' || cap || move.enPassant) ? 0 : this.halfMoveClock + 1;

    // Full move number
    if (this.turn === 'b') this.fullMoveNumber++;

    // Switch turn
    this.turn = this.turn === 'w' ? 'b' : 'w';

    this.moveHistory.push(rec);
    this.savePosition();

    // Check game state
    this.inCheck = this.isInCheck(this.turn);
    const legal = this.getAllLegalMoves(this.turn);

    if (legal.length === 0) {
      this.gameOver = true;
      this.gameResult = this.inCheck
        ? { type: 'checkmate', winner: this.turn === 'w' ? 'b' : 'w' }
        : { type: 'stalemate' };
    } else if (this.isInsufficientMaterial()) {
      this.gameOver = true;
      this.gameResult = { type: 'draw', reason: 'insufficient material' };
    } else if (this.halfMoveClock >= 100) {
      this.gameOver = true;
      this.gameResult = { type: 'draw', reason: '50-move rule' };
    } else if (this.isThreefoldRepetition()) {
      this.gameOver = true;
      this.gameResult = { type: 'draw', reason: 'threefold repetition' };
    }

    return rec;
  }

  undoLastMove() {
    if (!this.moveHistory.length) return null;
    const m = this.moveHistory.pop();

    // Restore piece to origin
    this.board[m.fromRow][m.fromCol] = m.piece;
    // Restore destination (null for en passant since captured piece is elsewhere)
    this.board[m.toRow][m.toCol] = m.enPassant ? null : m.captured;

    // Undo en passant capture
    if (m.enPassant && m.epRow !== undefined) {
      this.board[m.epRow][m.toCol] = m.epCaptured;
    }

    // Undo castling - move rook back
    if (m.castle) {
      if (m.castle === 'K') {
        this.board[m.toRow][7] = this.board[m.toRow][5];
        this.board[m.toRow][5] = null;
      } else {
        this.board[m.toRow][0] = this.board[m.toRow][3];
        this.board[m.toRow][3] = null;
      }
    }

    // Remove from captured list
    if (m.captured) {
      const arr = this.capturedPieces[m.piece.color];
      const idx = arr.findIndex(p => p.type === m.captured.type && p.color === m.captured.color);
      if (idx >= 0) arr.splice(idx, 1);
    }
    if (m.enPassant && m.epCaptured) {
      const arr = this.capturedPieces[m.piece.color];
      const idx = arr.findIndex(p => p.type === m.epCaptured.type && p.color === m.epCaptured.color);
      if (idx >= 0) arr.splice(idx, 1);
    }

    // Restore state
    this.castling = m.prevCastling;
    this.enPassant = m.prevEnPassant;
    this.halfMoveClock = m.prevHalfMoveClock;
    if (this.turn === 'w') this.fullMoveNumber--;
    this.turn = this.turn === 'w' ? 'b' : 'w';
    this.gameOver = false;
    this.gameResult = null;
    this.inCheck = this.isInCheck(this.turn);
    this.positionHistory.pop();

    return m;
  }

  // --- Draw Detection ---
  boardToKey() {
    let k = '';
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        k += p ? p.color + p.type : '..';
      }
    k += this.turn;
    k += (this.castling.wK?'K':'')+(this.castling.wQ?'Q':'')+(this.castling.bK?'k':'')+(this.castling.bQ?'q':'');
    k += this.enPassant ? this.enPassant.row+','+this.enPassant.col : '-';
    return k;
  }

  savePosition() { this.positionHistory.push(this.boardToKey()); }

  isThreefoldRepetition() {
    const cur = this.boardToKey();
    let n = 0;
    for (const k of this.positionHistory) { if (k === cur && ++n >= 3) return true; }
    return false;
  }

  isInsufficientMaterial() {
    const pcs = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.board[r][c]) pcs.push({ ...this.board[r][c], r, c });
    if (pcs.length === 2) return true;
    if (pcs.length === 3) return pcs.some(p => p.type === 'b' || p.type === 'n');
    if (pcs.length === 4) {
      const bishops = pcs.filter(p => p.type === 'b');
      if (bishops.length === 2 && bishops[0].color !== bishops[1].color) {
        return (bishops[0].r + bishops[0].c) % 2 === (bishops[1].r + bishops[1].c) % 2;
      }
    }
    return false;
  }

  getMoveNotation(rec) {
    if (rec.castle === 'K') return 'O-O';
    if (rec.castle === 'Q') return 'O-O-O';
    const files = 'abcdefgh', ranks = '87654321';
    let n = '';
    if (rec.piece.type !== 'p') {
      n += { k:'K', q:'Q', r:'R', b:'B', n:'N' }[rec.piece.type];
    }
    if (rec.captured || rec.enPassant) {
      if (rec.piece.type === 'p') n += files[rec.fromCol];
      n += 'x';
    }
    n += files[rec.toCol] + ranks[rec.toRow];
    if (rec.promotion) n += '=' + rec.promotion.toUpperCase();
    if (this.gameOver && this.gameResult?.type === 'checkmate') n += '#';
    else if (this.inCheck) n += '+';
    return n;
  }
}
