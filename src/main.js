const boardCanvas = document.getElementById("gameCanvas");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("nextCanvas");
const nextCtx = nextCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlayTitle");
const overlayMessageEl = document.getElementById("overlayMessage");

const COLS = 10;
const ROWS = 20;
const CELL = boardCanvas.width / COLS;
const NEXT_CELL = 24;

const SHAPES = {
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
  I: "#5ac8ff",
  O: "#ffd166",
  T: "#b38cff",
  S: "#6bff95",
  Z: "#ff6e90",
  J: "#7aa2ff",
  L: "#ffb86b",
};

const TYPES = Object.keys(SHAPES);
const LINE_SCORE = [0, 100, 300, 500, 800];

const game = {
  board: createBoard(),
  current: null,
  next: randomType(),
  score: 0,
  lines: 0,
  level: 1,
  dropCounter: 0,
  dropInterval: 1000,
  lastTime: 0,
  paused: false,
  gameOver: false,
};

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomType() {
  return TYPES[Math.floor(Math.random() * TYPES.length)];
}

function rotateMatrix(matrix, direction) {
  const rotated = matrix[0].map((_, col) => matrix.map((row) => row[col]));
  if (direction > 0) {
    rotated.forEach((row) => row.reverse());
    return rotated;
  }
  rotated.reverse();
  return rotated;
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function spawnPiece() {
  const type = game.next;
  game.next = randomType();

  const matrix = cloneMatrix(SHAPES[type]);
  const piece = {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: 0,
  };

  if (collides(piece, piece.x, piece.y, piece.matrix)) {
    game.gameOver = true;
    showOverlay("ゲームオーバー", "Rキーでリスタート");
    return;
  }

  game.current = piece;
  drawNextPiece();
}

function collides(piece, targetX, targetY, targetMatrix) {
  for (let row = 0; row < targetMatrix.length; row += 1) {
    for (let col = 0; col < targetMatrix[row].length; col += 1) {
      if (!targetMatrix[row][col]) {
        continue;
      }
      const boardX = targetX + col;
      const boardY = targetY + row;
      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
        return true;
      }
      if (boardY >= 0 && game.board[boardY][boardX]) {
        return true;
      }
    }
  }
  return false;
}

function mergePiece() {
  const { matrix, x, y, type } = game.current;
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (!matrix[row][col]) {
        continue;
      }
      const boardY = y + row;
      if (boardY >= 0) {
        game.board[boardY][x + col] = type;
      }
    }
  }
}

function clearLines() {
  let cleared = 0;
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (game.board[row].every(Boolean)) {
      game.board.splice(row, 1);
      game.board.unshift(Array(COLS).fill(null));
      cleared += 1;
      row += 1;
    }
  }

  if (cleared > 0) {
    game.lines += cleared;
    game.score += LINE_SCORE[cleared] * game.level;
    game.level = Math.floor(game.lines / 10) + 1;
    game.dropInterval = Math.max(120, 1000 - (game.level - 1) * 90);
    updateHud();
  }
}

function hardDrop() {
  if (!game.current || game.paused || game.gameOver) {
    return;
  }

  let dropDistance = 0;
  while (!collides(game.current, game.current.x, game.current.y + 1, game.current.matrix)) {
    game.current.y += 1;
    dropDistance += 1;
  }

  game.score += dropDistance * 2;
  lockPiece();
}

function softDrop() {
  if (!game.current || game.paused || game.gameOver) {
    return;
  }

  if (!collides(game.current, game.current.x, game.current.y + 1, game.current.matrix)) {
    game.current.y += 1;
    game.score += 1;
    updateHud();
    return;
  }

  lockPiece();
}

function lockPiece() {
  mergePiece();
  clearLines();
  updateHud();
  spawnPiece();
}

function move(dx) {
  if (!game.current || game.paused || game.gameOver) {
    return;
  }

  const targetX = game.current.x + dx;
  if (!collides(game.current, targetX, game.current.y, game.current.matrix)) {
    game.current.x = targetX;
  }
}

function rotate(direction) {
  if (!game.current || game.paused || game.gameOver) {
    return;
  }

  const rotated = rotateMatrix(game.current.matrix, direction);
  const kicks = [0, -1, 1, -2, 2];
  for (const offset of kicks) {
    const targetX = game.current.x + offset;
    if (!collides(game.current, targetX, game.current.y, rotated)) {
      game.current.x = targetX;
      game.current.matrix = rotated;
      return;
    }
  }
}

function drawCell(context, x, y, color, cellSize) {
  context.fillStyle = color;
  context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
  context.strokeStyle = "rgba(0, 0, 0, 0.35)";
  context.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
}

function drawBoard() {
  boardCtx.fillStyle = "#090c12";
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const type = game.board[row][col];
      if (type) {
        drawCell(boardCtx, col, row, COLORS[type], CELL);
      }
    }
  }

  if (game.current) {
    const { matrix, x, y, type } = game.current;
    for (let row = 0; row < matrix.length; row += 1) {
      for (let col = 0; col < matrix[row].length; col += 1) {
        if (!matrix[row][col]) {
          continue;
        }
        drawCell(boardCtx, x + col, y + row, COLORS[type], CELL);
      }
    }
  }

  boardCtx.strokeStyle = "rgba(120, 140, 180, 0.22)";
  for (let y = 1; y < ROWS; y += 1) {
    boardCtx.beginPath();
    boardCtx.moveTo(0, y * CELL);
    boardCtx.lineTo(boardCanvas.width, y * CELL);
    boardCtx.stroke();
  }
  for (let x = 1; x < COLS; x += 1) {
    boardCtx.beginPath();
    boardCtx.moveTo(x * CELL, 0);
    boardCtx.lineTo(x * CELL, boardCanvas.height);
    boardCtx.stroke();
  }
}

function drawNextPiece() {
  nextCtx.fillStyle = "#090c12";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  const matrix = SHAPES[game.next];
  const color = COLORS[game.next];
  const width = matrix[0].length;
  const height = matrix.length;
  const offsetX = Math.floor((nextCanvas.width / NEXT_CELL - width) / 2);
  const offsetY = Math.floor((nextCanvas.height / NEXT_CELL - height) / 2);

  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (matrix[row][col]) {
        drawCell(nextCtx, offsetX + col, offsetY + row, color, NEXT_CELL);
      }
    }
  }
}

function updateHud() {
  scoreEl.textContent = String(game.score);
  linesEl.textContent = String(game.lines);
  levelEl.textContent = String(game.level);
}

function showOverlay(title, message) {
  overlayTitleEl.textContent = title;
  overlayMessageEl.textContent = message;
  overlayEl.classList.remove("hidden");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function togglePause() {
  if (game.gameOver) {
    return;
  }
  game.paused = !game.paused;
  if (game.paused) {
    showOverlay("一時停止", "Pキーで再開");
  } else {
    hideOverlay();
  }
}

function resetGame() {
  game.board = createBoard();
  game.current = null;
  game.next = randomType();
  game.score = 0;
  game.lines = 0;
  game.level = 1;
  game.dropCounter = 0;
  game.dropInterval = 1000;
  game.lastTime = 0;
  game.paused = false;
  game.gameOver = false;

  updateHud();
  hideOverlay();
  spawnPiece();
  drawBoard();
}

function update(time = 0) {
  if (!game.lastTime) {
    game.lastTime = time;
  }

  const delta = time - game.lastTime;
  game.lastTime = time;

  if (!game.paused && !game.gameOver && game.current) {
    game.dropCounter += delta;
    if (game.dropCounter >= game.dropInterval) {
      softDrop();
      game.dropCounter = 0;
    }
  }

  drawBoard();
  requestAnimationFrame(update);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (["arrowleft", "arrowright", "arrowdown", "arrowup", " ", "z", "x"].includes(key) || event.code === "Space") {
    event.preventDefault();
  }

  if (key === "r") {
    resetGame();
    return;
  }

  if (key === "p") {
    togglePause();
    return;
  }

  if (game.paused || game.gameOver) {
    return;
  }

  switch (key) {
    case "arrowleft":
      move(-1);
      break;
    case "arrowright":
      move(1);
      break;
    case "arrowdown":
      softDrop();
      game.dropCounter = 0;
      break;
    case "arrowup":
    case "x":
      rotate(1);
      break;
    case "z":
      rotate(-1);
      break;
    default:
      if (event.code === "Space") {
        hardDrop();
        game.dropCounter = 0;
      }
      break;
  }
});

resetGame();
requestAnimationFrame(update);
