import {
  createGameState,
  DEFAULT_CONFIG,
  GAME_STATUS,
  getTickMsForScore,
  queueDirection,
  restart,
  tick,
} from './snake/gameLogic.js';

const ROWS = DEFAULT_CONFIG.rows;
const COLS = DEFAULT_CONFIG.cols;
const boardEl = document.querySelector('[data-board]');
const scoreEl = document.querySelector('[data-score]');
const statusEl = document.querySelector('[data-status]');
const overlayEl = document.querySelector('[data-overlay]');
const overlayMessageEl = document.querySelector('[data-overlay-message]');
const overlayRestartButton = document.querySelector('[data-overlay-restart]');
const pauseButton = document.querySelector('[data-action="toggle-pause"]');
const restartButton = document.querySelector('[data-action="restart"]');
const touchControls = document.querySelector('[data-touch-controls]');

let gameState = createGameState({ rows: ROWS, cols: COLS });
let isPaused = false;
let loopHandle = null;
let activeTickMs = getTickMsForScore(gameState.score);

if (!boardEl || !scoreEl || !statusEl) {
  throw new Error('Snake UI elements are missing from the page.');
}

const boardCells = buildBoard(boardEl, ROWS, COLS);

attachEvents();
render();
resumeGame();

function attachEvents() {
  window.addEventListener('keydown', handleKeyDown);
  pauseButton?.addEventListener('click', togglePause);
  restartButton?.addEventListener('click', handleRestart);
  overlayRestartButton?.addEventListener('click', handleRestart);
  touchControls?.addEventListener('click', handleTouchInput);
}

function handleTouchInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const direction = target.dataset.direction;
  if (direction) {
    applyDirection(direction);
  }
}

function handleKeyDown(event) {
  const direction = keyToDirection(event);
  if (direction) {
    event.preventDefault();
    applyDirection(direction);
    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();
    togglePause();
    return;
  }

  if (event.code === 'Enter') {
    event.preventDefault();
    handleRestart();
  }
}

function applyDirection(direction) {
  if (gameState.status !== GAME_STATUS.RUNNING) {
    return;
  }
  gameState = queueDirection(gameState, direction);
}

function togglePause() {
  if (gameState.status === GAME_STATUS.OVER) {
    return;
  }

  if (isPaused) {
    resumeGame();
  } else {
    pauseGame();
  }
}

function resumeGame() {
  stopLoop();
  activeTickMs = getTickMsForScore(gameState.score);
  loopHandle = setInterval(runTick, activeTickMs);
  isPaused = false;
  updateUiState();
}

function pauseGame() {
  stopLoop();
  isPaused = true;
  updateUiState();
}

function runTick() {
  gameState = tick(gameState, Math.random);
  syncLoopSpeed();
  render();
  if (gameState.status === GAME_STATUS.OVER) {
    pauseGame();
    showOverlay(`Game over! Final score: ${gameState.score}`);
  }
}

function handleRestart() {
  gameState = restart(gameState, Math.random);
  hideOverlay();
  render();
  resumeGame();
}

function render() {
  updateBoard(gameState, boardCells, COLS);
  updateUiState();
}

function updateUiState() {
  scoreEl.textContent = String(gameState.score);
  if (gameState.status === GAME_STATUS.OVER) {
    statusEl.textContent = 'Game over';
    pauseButton?.setAttribute('disabled', 'true');
  } else {
    pauseButton?.removeAttribute('disabled');
    statusEl.textContent = isPaused ? 'Paused' : 'Running';
    pauseButton?.classList.toggle('is-paused', isPaused);
    if (pauseButton) {
      pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
    }
  }
}

function syncLoopSpeed() {
  if (isPaused || gameState.status !== GAME_STATUS.RUNNING) {
    return;
  }

  const nextTickMs = getTickMsForScore(gameState.score);
  if (nextTickMs === activeTickMs) {
    return;
  }

  activeTickMs = nextTickMs;
  stopLoop();
  loopHandle = setInterval(runTick, activeTickMs);
}

function buildBoard(container, rows, cols) {
  container.style.setProperty('--rows', String(rows));
  container.style.setProperty('--cols', String(cols));
  const cells = [];
  container.innerHTML = '';
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      container.appendChild(cell);
      cells.push(cell);
    }
  }
  return cells;
}

function updateBoard(state, cells, cols) {
  for (const cell of cells) {
    cell.className = 'cell';
  }

  state.snake.forEach((segment, index) => {
    const cell = getCell(cells, segment, cols);
    if (!cell) return;
    cell.classList.add('cell--snake');
    if (index === 0) {
      cell.classList.add('cell--head');
    }
  });

  if (state.food) {
    const foodCell = getCell(cells, state.food, cols);
    foodCell?.classList.add('cell--food');
  }
}

function showOverlay(message) {
  if (!overlayEl || !overlayMessageEl) return;
  overlayMessageEl.textContent = message;
  overlayEl.hidden = false;
}

function hideOverlay() {
  if (!overlayEl || !overlayMessageEl) return;
  overlayEl.hidden = true;
  overlayMessageEl.textContent = '';
}

function keyToDirection(event) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      return 'up';
    case 'ArrowDown':
    case 'KeyS':
      return 'down';
    case 'ArrowLeft':
    case 'KeyA':
      return 'left';
    case 'ArrowRight':
    case 'KeyD':
      return 'right';
    default:
      return null;
  }
}

function getCell(cells, position, cols) {
  const index = position.row * cols + position.col;
  return cells[index];
}

function stopLoop() {
  if (loopHandle) {
    clearInterval(loopHandle);
    loopHandle = null;
  }
}
