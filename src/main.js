import {
  createGameState,
  DEFAULT_CONFIG,
  GAME_STATUS,
  getTickMsForScore,
  queueDirection,
  restart,
  tick,
} from './snake/gameLogic.js';
import { LEADERBOARD_CONFIG, hasLeaderboardConfig } from './leaderboard/config.js';
import { isValidPlayerName, normalizePlayerName } from './leaderboard/helpers.js';
import { fetchLeaderboard, submitScore } from './leaderboard/service.js';

const ROWS = DEFAULT_CONFIG.rows;
const COLS = DEFAULT_CONFIG.cols;
const PLAYER_NAME_KEY = 'snake-player-name';

const boardEl = document.querySelector('[data-board]');
const scoreEl = document.querySelector('[data-score]');
const statusEl = document.querySelector('[data-status]');
const playerNameEl = document.querySelector('[data-player-name]');
const leaderboardStatusEl = document.querySelector('[data-leaderboard-status]');
const leaderboardListEl = document.querySelector('[data-leaderboard-list]');
const overlayEl = document.querySelector('[data-overlay]');
const overlayMessageEl = document.querySelector('[data-overlay-message]');
const overlayRestartButton = document.querySelector('[data-overlay-restart]');
const pauseButton = document.querySelector('[data-action="toggle-pause"]');
const restartButton = document.querySelector('[data-action="restart"]');
const changeNameButton = document.querySelector('[data-action="change-name"]');
const refreshLeaderboardButton = document.querySelector('[data-action="refresh-leaderboard"]');
const touchControls = document.querySelector('[data-touch-controls]');
const nameModalEl = document.querySelector('[data-name-modal]');
const nameFormEl = document.querySelector('[data-name-form]');
const nameInputEl = document.querySelector('#player-name-input');
const nameErrorEl = document.querySelector('[data-name-error]');

let gameState = createGameState({ rows: ROWS, cols: COLS });
let isPaused = false;
let loopHandle = null;
let leaderboardHandle = null;
let activeTickMs = getTickMsForScore(gameState.score);
let playerName = loadPlayerName();
let scoreSubmittedForRun = false;
let resumeAfterNameModal = false;
let leaderboardEntries = [];
let leaderboardStatus = hasLeaderboardConfig()
  ? '正在加载排行榜...'
  : '排行榜未启用，请先在 src/leaderboard/config.js 中填写 Supabase 配置。';

if (
  !boardEl ||
  !scoreEl ||
  !statusEl ||
  !playerNameEl ||
  !leaderboardStatusEl ||
  !leaderboardListEl ||
  !nameModalEl ||
  !nameFormEl ||
  !nameInputEl ||
  !nameErrorEl
) {
  throw new Error('游戏页面缺少必要的界面元素。');
}

const boardCells = buildBoard(boardEl, ROWS, COLS);

attachEvents();
render();
initializeApp();

function attachEvents() {
  window.addEventListener('keydown', handleKeyDown);
  pauseButton?.addEventListener('click', togglePause);
  restartButton?.addEventListener('click', handleRestart);
  overlayRestartButton?.addEventListener('click', handleRestart);
  changeNameButton?.addEventListener('click', handleChangeName);
  refreshLeaderboardButton?.addEventListener('click', handleRefreshLeaderboard);
  touchControls?.addEventListener('click', handleTouchInput);
  nameFormEl?.addEventListener('submit', handleNameSubmit);
}

async function initializeApp() {
  if (!playerName) {
    openNameModal(true);
    return;
  }

  applyPlayerName(playerName);
  await refreshLeaderboardView();
  startLeaderboardPolling();
  resumeGame();
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
  if (!nameModalEl.hidden) {
    return;
  }

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
  if (gameState.status !== GAME_STATUS.RUNNING || !playerName) {
    return;
  }
  gameState = queueDirection(gameState, direction);
}

function togglePause() {
  if (gameState.status === GAME_STATUS.OVER || !playerName) {
    return;
  }

  if (isPaused) {
    resumeGame();
  } else {
    pauseGame();
  }
}

function resumeGame() {
  if (!playerName || gameState.status !== GAME_STATUS.RUNNING) {
    updateUiState();
    return;
  }

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
    showOverlay(`游戏结束，最终得分：${gameState.score}`);
    void saveScoreAndRefresh();
  }
}

function handleRestart() {
  hideOverlay();
  gameState = restart(gameState, Math.random);
  scoreSubmittedForRun = false;
  render();

  if (!playerName) {
    openNameModal(true);
    return;
  }

  resumeGame();
}

function handleChangeName() {
  openNameModal(gameState.status === GAME_STATUS.RUNNING && !isPaused);
}

async function handleRefreshLeaderboard() {
  await refreshLeaderboardView();
}

async function handleNameSubmit(event) {
  event.preventDefault();
  const formData = new FormData(nameFormEl);
  const submittedName = normalizePlayerName(formData.get('playerName'));

  if (!isValidPlayerName(submittedName)) {
    showNameError('名字至少需要 2 个字符。');
    return;
  }

  playerName = submittedName;
  localStorage.setItem(PLAYER_NAME_KEY, playerName);
  applyPlayerName(playerName);
  hideNameModal();
  await refreshLeaderboardView();
  startLeaderboardPolling();

  if (resumeAfterNameModal && gameState.status === GAME_STATUS.RUNNING) {
    resumeGame();
  } else {
    updateUiState();
  }
}

function render() {
  updateBoard(gameState, boardCells, COLS);
  updateLeaderboard();
  updateUiState();
}

function updateUiState() {
  scoreEl.textContent = String(gameState.score);
  playerNameEl.textContent = playerName || '游客';
  leaderboardStatusEl.textContent = leaderboardStatus;
  refreshLeaderboardButton?.toggleAttribute('disabled', !hasLeaderboardConfig());

  if (!playerName) {
    statusEl.textContent = '请输入名字后开始游戏';
    pauseButton?.setAttribute('disabled', 'true');
    return;
  }

  if (gameState.status === GAME_STATUS.OVER) {
    statusEl.textContent = '游戏结束';
    pauseButton?.setAttribute('disabled', 'true');
  } else {
    pauseButton?.removeAttribute('disabled');
    statusEl.textContent = isPaused ? '已暂停' : '进行中';
    if (pauseButton) {
      pauseButton.textContent = isPaused ? '继续' : '暂停';
    }
  }
}

function updateLeaderboard() {
  leaderboardListEl.innerHTML = '';

  if (leaderboardEntries.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'leaderboard__empty';
    emptyItem.textContent = hasLeaderboardConfig()
      ? '还没有成绩记录。'
      : '请先配置 Supabase 以启用共享排行榜。';
    leaderboardListEl.appendChild(emptyItem);
    return;
  }

  leaderboardEntries.forEach((entry, index) => {
    const item = document.createElement('li');
    item.className = 'leaderboard__item';
    item.innerHTML = `
      <span class="leaderboard__name">${index + 1}. ${escapeHtml(entry.playerName)}</span>
      <span class="leaderboard__score">${entry.score}</span>
    `;
    leaderboardListEl.appendChild(item);
  });
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

async function saveScoreAndRefresh() {
  if (!playerName || scoreSubmittedForRun) {
    return;
  }

  scoreSubmittedForRun = true;

  try {
    const result = await submitScore(playerName, gameState.score);
    if (!result.enabled) {
      leaderboardStatus =
        '排行榜未启用，请先在 src/leaderboard/config.js 中填写 Supabase 配置。';
      render();
      return;
    }

    leaderboardStatus = result.updated
      ? '排行榜已更新。'
      : '成绩已记录，但未超过你的个人最高分。';
    await refreshLeaderboardView();
  } catch (error) {
    leaderboardStatus = error.message;
    render();
  }
}

async function refreshLeaderboardView() {
  if (!hasLeaderboardConfig()) {
    leaderboardEntries = [];
    leaderboardStatus =
      '排行榜未启用，请先在 src/leaderboard/config.js 中填写 Supabase 配置。';
    render();
    return;
  }

  leaderboardStatus = '正在刷新排行榜...';
  render();

  try {
    const result = await fetchLeaderboard();
    leaderboardEntries = result.entries;
    leaderboardStatus = `共享排行榜每 ${Math.floor(
      LEADERBOARD_CONFIG.refreshMs / 1000,
    )} 秒自动刷新一次。`;
  } catch (error) {
    leaderboardStatus = error.message;
  }

  render();
}

function startLeaderboardPolling() {
  stopLeaderboardPolling();
  if (!hasLeaderboardConfig()) {
    return;
  }

  leaderboardHandle = setInterval(() => {
    void refreshLeaderboardView();
  }, LEADERBOARD_CONFIG.refreshMs);
}

function stopLeaderboardPolling() {
  if (leaderboardHandle) {
    clearInterval(leaderboardHandle);
    leaderboardHandle = null;
  }
}

function openNameModal(shouldResumeAfterClose) {
  resumeAfterNameModal = shouldResumeAfterClose;
  pauseGame();
  nameModalEl.hidden = false;
  nameInputEl.value = playerName ?? '';
  showNameError('');
  nameInputEl.focus();
}

function hideNameModal() {
  nameModalEl.hidden = true;
  showNameError('');
}

function showNameError(message) {
  nameErrorEl.textContent = message;
  nameErrorEl.hidden = !message;
}

function applyPlayerName(nextPlayerName) {
  playerName = normalizePlayerName(nextPlayerName);
  playerNameEl.textContent = playerName || '游客';
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
    if (!cell) {
      return;
    }
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
  if (!overlayEl || !overlayMessageEl) {
    return;
  }
  overlayMessageEl.textContent = message;
  overlayEl.hidden = false;
}

function hideOverlay() {
  if (!overlayEl || !overlayMessageEl) {
    return;
  }
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

function loadPlayerName() {
  return normalizePlayerName(localStorage.getItem(PLAYER_NAME_KEY));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
