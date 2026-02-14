const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const hpEl = document.getElementById("hp");
const gameOverEl = document.getElementById("gameOver");

const GAME_CONFIG = {
  playerRadius: 14,
  playerSpeed: 320,
  startHp: 3,
  initialSpawnInterval: 950,
  minSpawnInterval: 260,
  spawnAcceleration: 30,
  baseBulletSpeed: 170,
  bulletSpeedGrowth: 5,
  playerInvulnerableMs: 600,
};

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
};

let gameState;
let lastFrameTime = 0;
let lastSpawnAt = 0;
let nextSpawnEvery = GAME_CONFIG.initialSpawnInterval;

function resetGame() {
  gameState = {
    player: {
      x: canvas.width / 2,
      y: canvas.height / 2,
      r: GAME_CONFIG.playerRadius,
      speed: GAME_CONFIG.playerSpeed,
      invulnerableUntil: 0,
    },
    bullets: [],
    hp: GAME_CONFIG.startHp,
    score: 0,
    elapsed: 0,
    gameOver: false,
  };

  scoreEl.textContent = "0";
  hpEl.textContent = String(gameState.hp);
  gameOverEl.classList.add("hidden");
  nextSpawnEvery = GAME_CONFIG.initialSpawnInterval;
  lastSpawnAt = performance.now();
  lastFrameTime = performance.now();
}

function keyStateFromEvent(event, isDown) {
  switch (event.key.toLowerCase()) {
    case "arrowup":
    case "w":
      input.up = isDown;
      break;
    case "arrowdown":
    case "s":
      input.down = isDown;
      break;
    case "arrowleft":
    case "a":
      input.left = isDown;
      break;
    case "arrowright":
    case "d":
      input.right = isDown;
      break;
    case "r":
      if (isDown && gameState?.gameOver) {
        resetGame();
      }
      break;
    default:
      break;
  }
}

window.addEventListener("keydown", (event) => keyStateFromEvent(event, true));
window.addEventListener("keyup", (event) => keyStateFromEvent(event, false));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updatePlayer(deltaSec) {
  const dx = Number(input.right) - Number(input.left);
  const dy = Number(input.down) - Number(input.up);
  if (dx === 0 && dy === 0) {
    return;
  }

  const mag = Math.hypot(dx, dy) || 1;
  const step = gameState.player.speed * deltaSec;
  gameState.player.x += (dx / mag) * step;
  gameState.player.y += (dy / mag) * step;

  const r = gameState.player.r;
  gameState.player.x = clamp(gameState.player.x, r, canvas.width - r);
  gameState.player.y = clamp(gameState.player.y, r, canvas.height - r);
}

function randomEdgeSpawn() {
  const edge = Math.floor(Math.random() * 4);
  switch (edge) {
    case 0:
      return { x: Math.random() * canvas.width, y: -20 };
    case 1:
      return { x: canvas.width + 20, y: Math.random() * canvas.height };
    case 2:
      return { x: Math.random() * canvas.width, y: canvas.height + 20 };
    default:
      return { x: -20, y: Math.random() * canvas.height };
  }
}

function spawnBullet() {
  const spawn = randomEdgeSpawn();
  const toPlayerX = gameState.player.x - spawn.x;
  const toPlayerY = gameState.player.y - spawn.y;
  const heading = Math.hypot(toPlayerX, toPlayerY) || 1;
  const speed = GAME_CONFIG.baseBulletSpeed + gameState.elapsed * GAME_CONFIG.bulletSpeedGrowth;

  gameState.bullets.push({
    x: spawn.x,
    y: spawn.y,
    vx: (toPlayerX / heading) * speed,
    vy: (toPlayerY / heading) * speed,
    r: 7,
  });
}

function updateBullets(deltaSec) {
  for (const bullet of gameState.bullets) {
    bullet.x += bullet.vx * deltaSec;
    bullet.y += bullet.vy * deltaSec;
  }

  gameState.bullets = gameState.bullets.filter(
    (b) => b.x > -60 && b.x < canvas.width + 60 && b.y > -60 && b.y < canvas.height + 60,
  );
}

function applyCollisions(now) {
  if (now < gameState.player.invulnerableUntil) {
    return;
  }

  const p = gameState.player;
  for (const bullet of gameState.bullets) {
    const dx = p.x - bullet.x;
    const dy = p.y - bullet.y;
    if (dx * dx + dy * dy < (p.r + bullet.r) ** 2) {
      gameState.hp -= 1;
      hpEl.textContent = String(gameState.hp);
      gameState.player.invulnerableUntil = now + GAME_CONFIG.playerInvulnerableMs;
      if (gameState.hp <= 0) {
        gameState.gameOver = true;
        gameOverEl.classList.remove("hidden");
      }
      break;
    }
  }
}

function maybeSpawnBullet(now) {
  if (now - lastSpawnAt < nextSpawnEvery) {
    return;
  }
  spawnBullet();
  lastSpawnAt = now;
  nextSpawnEvery = Math.max(
    GAME_CONFIG.minSpawnInterval,
    GAME_CONFIG.initialSpawnInterval - gameState.elapsed * GAME_CONFIG.spawnAcceleration,
  );
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const pulse = performance.now() < gameState.player.invulnerableUntil;
  ctx.fillStyle = pulse ? "#ffd166" : "#5ac8ff";
  ctx.beginPath();
  ctx.arc(gameState.player.x, gameState.player.y, gameState.player.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff5f87";
  for (const bullet of gameState.bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function gameLoop(now) {
  if (!lastFrameTime) {
    lastFrameTime = now;
  }

  const deltaSec = Math.min(0.033, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  if (!gameState.gameOver) {
    gameState.elapsed += deltaSec;
    gameState.score += deltaSec * 10;
    scoreEl.textContent = String(Math.floor(gameState.score));

    updatePlayer(deltaSec);
    maybeSpawnBullet(now);
    updateBullets(deltaSec);
    applyCollisions(now);
  }

  draw();
  requestAnimationFrame(gameLoop);
}

resetGame();
requestAnimationFrame(gameLoop);
