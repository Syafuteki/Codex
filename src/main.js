const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const overlayEl = document.getElementById("gameOverlay");
const overlayTitleEl = document.getElementById("overlayTitle");

const COLS = 10;
const ROWS = 20;
const BLOCK = canvas.width / COLS;

const PIECES = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
};

const COLORS = {
  I: "#40e0ff",
  O: "#ffd94f",
  T: "#bf7cff",
  S: "#54e38e",
  Z: "#ff6474",
  J: "#6592ff",
  L: "#ffa85a",
};

const LINES_PER_LEVEL = 10;
const SCORE_TABLE = [0, 100, 300, 500, 800];

const state = {
  board: createBoard(),
  piece: null,
  score: 0,
  lines: 0,
  level: 1,
  gameOver: false,
  paused: false,
  lastTime: 0,
  dropElapsedMs: 0,
};

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function randomPiece() {
  const keys = Object.keys(PIECES);
  const type = keys[Math.floor(Math.random() * keys.length)];
  const shape = cloneMatrix(PIECES[type]);
  const x = Math.floor((COLS - shape[0].length) / 2);
  return { type, shape, x, y: 0 };
}

function resetGame() {
  state.board = createBoard();
  state.piece = randomPiece();
  state.score = 0;
  state.lines = 0;
  state.level = 1;
  state.gameOver = false;
  state.paused = false;
  state.lastTime = 0;
  state.dropElapsedMs = 0;
  syncHud();
  hideOverlay();

  if (hasCollision(state.piece)) {
    triggerGameOver();
  }
}

function getDropIntervalMs() {
  return Math.max(95, 900 - (state.level - 1) * 75);
}

function rotateMatrixClockwise(matrix) {
  return matrix[0].map((_, col) => matrix.map((row) => row[col]).reverse());
}

function hasCollision(piece) {
  for (let y = 0; y < piece.shape.length; y += 1) {
    for (let x = 0; x < piece.shape[y].length; x += 1) {
      if (!piece.shape[y][x]) {
        continue;
      }

      const boardX = piece.x + x;
      const boardY = piece.y + y;

      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
        return true;
      }

      if (boardY >= 0 && state.board[boardY][boardX]) {
        return true;
      }
    }
  }

  return false;
}

function movePiece(dx, dy) {
  const candidate = { ...state.piece, x: state.piece.x + dx, y: state.piece.y + dy };
  if (!hasCollision(candidate)) {
    state.piece = candidate;
    return true;
  }
  return false;
}

function rotatePiece(dir = 1) {
  let rotated = cloneMatrix(state.piece.shape);
  if (dir < 0) {
    rotated = rotateMatrixClockwise(rotateMatrixClockwise(rotateMatrixClockwise(rotated)));
  } else {
    rotated = rotateMatrixClockwise(rotated);
  }

  const candidate = { ...state.piece, shape: rotated };
  const wallKicks = [0, -1, 1, -2, 2];
  for (const kick of wallKicks) {
    const shifted = { ...candidate, x: candidate.x + kick };
    if (!hasCollision(shifted)) {
      state.piece = shifted;
      return;
    }
  }
}

function lockPiece() {
  for (let y = 0; y < state.piece.shape.length; y += 1) {
    for (let x = 0; x < state.piece.shape[y].length; x += 1) {
      if (!state.piece.shape[y][x]) {
        continue;
      }
      const boardY = state.piece.y + y;
      const boardX = state.piece.x + x;
      if (boardY >= 0) {
        state.board[boardY][boardX] = state.piece.type;
      }
    }
  }

  const cleared = clearLines();
  if (cleared > 0) {
    state.score += SCORE_TABLE[cleared] * state.level;
    state.lines += cleared;
    state.level = Math.floor(state.lines / LINES_PER_LEVEL) + 1;
    syncHud();
  }

  state.piece = randomPiece();
  if (hasCollision(state.piece)) {
    triggerGameOver();
  }
}

function clearLines() {
  const nextBoard = state.board.filter((row) => row.some((cell) => cell === null));
  const linesCleared = ROWS - nextBoard.length;

  while (nextBoard.length < ROWS) {
    nextBoard.unshift(Array(COLS).fill(null));
  }

  state.board = nextBoard;
  return linesCleared;
}

function hardDrop() {
  while (movePiece(0, 1)) {
    state.score += 2;
  }
  lockPiece();
  syncHud();
}

function step() {
  if (!movePiece(0, 1)) {
    lockPiece();
  }
}

function drawCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
  ctx.strokeStyle = "#0a1022";
  ctx.lineWidth = 1;
  ctx.strokeRect(x * BLOCK + 0.5, y * BLOCK + 0.5, BLOCK - 1, BLOCK - 1);
}

function drawBoard() {
  ctx.fillStyle = "#030712";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = state.board[y][x];
      if (cell) {
        drawCell(x, y, COLORS[cell]);
      }
    }
  }
}

function drawGhostPiece() {
  let ghost = { ...state.piece, shape: cloneMatrix(state.piece.shape) };
  while (!hasCollision({ ...ghost, y: ghost.y + 1 })) {
    ghost.y += 1;
  }

  for (let y = 0; y < ghost.shape.length; y += 1) {
    for (let x = 0; x < ghost.shape[y].length; x += 1) {
      if (!ghost.shape[y][x]) {
        continue;
      }
      const gx = ghost.x + x;
      const gy = ghost.y + y;
      if (gy >= 0) {
        ctx.fillStyle = "rgb(200 220 255 / 18%)";
        ctx.fillRect(gx * BLOCK, gy * BLOCK, BLOCK, BLOCK);
      }
    }
  }
}

function drawCurrentPiece() {
  for (let y = 0; y < state.piece.shape.length; y += 1) {
    for (let x = 0; x < state.piece.shape[y].length; x += 1) {
      if (!state.piece.shape[y][x]) {
        continue;
      }

      const px = state.piece.x + x;
      const py = state.piece.y + y;
      if (py >= 0) {
        drawCell(px, py, COLORS[state.piece.type]);
      }
    }
  }
}

function render() {
  drawBoard();
  drawGhostPiece();
  drawCurrentPiece();
}

function syncHud() {
  scoreEl.textContent = String(state.score);
  linesEl.textContent = String(state.lines);
  levelEl.textContent = String(state.level);
}

function showOverlay(title) {
  overlayTitleEl.textContent = title;
  overlayEl.classList.remove("hidden");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function triggerGameOver() {
  state.gameOver = true;
  showOverlay("GAME OVER");
}

function gameLoop(time) {
  if (!state.lastTime) {
    state.lastTime = time;
  }

  const dt = time - state.lastTime;
  state.lastTime = time;

  if (!state.gameOver && !state.paused) {
    state.dropElapsedMs += dt;
    if (state.dropElapsedMs >= getDropIntervalMs()) {
      step();
      state.dropElapsedMs = 0;
      syncHud();
    }
  }

  render();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (key === "r") {
    resetGame();
    return;
  }

  if (key === "p" && !state.gameOver) {
    state.paused = !state.paused;
    if (state.paused) {
      showOverlay("PAUSED");
    } else {
      hideOverlay();
    }
    return;
  }

  if (state.gameOver || state.paused) {
    return;
  }

  if (["arrowleft", "arrowright", "arrowdown", "arrowup", " ", "z", "x"].includes(key)) {
    event.preventDefault();
  }

  switch (key) {
    case "arrowleft":
      movePiece(-1, 0);
      break;
    case "arrowright":
      movePiece(1, 0);
      break;
    case "arrowdown":
      if (movePiece(0, 1)) {
        state.score += 1;
        syncHud();
      } else {
        lockPiece();
      }
      break;
    case "arrowup":
    case "x":
      rotatePiece(1);
      break;
    case "z":
      rotatePiece(-1);
      break;
    case " ":
      hardDrop();
      break;
    default:
      break;
  }
});

resetGame();
requestAnimationFrame(gameLoop);
