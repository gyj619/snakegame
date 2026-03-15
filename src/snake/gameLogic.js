export const DIRECTIONS = {
  up: { rowDelta: -1, colDelta: 0 },
  down: { rowDelta: 1, colDelta: 0 },
  left: { rowDelta: 0, colDelta: -1 },
  right: { rowDelta: 0, colDelta: 1 },
};

const OPPOSITES = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export const GAME_STATUS = {
  RUNNING: 'running',
  OVER: 'game-over',
};

export const DEFAULT_CONFIG = {
  rows: 20,
  cols: 20,
  initialLength: 4,
  tickMs: 140,
  minTickMs: 70,
  speedStepMs: 8,
};

export const DIRECTION_KEYS = Object.freeze(Object.keys(DIRECTIONS));

export function getTickMsForScore(score, config = DEFAULT_CONFIG) {
  const safeScore = Math.max(0, Math.floor(score));
  const baseTickMs = config.tickMs ?? DEFAULT_CONFIG.tickMs;
  const minTickMs = config.minTickMs ?? DEFAULT_CONFIG.minTickMs;
  const speedStepMs = config.speedStepMs ?? DEFAULT_CONFIG.speedStepMs;
  return Math.max(minTickMs, baseTickMs - safeScore * speedStepMs);
}

export function createGameState(options = {}, randomFn = Math.random) {
  const rows = clampGridSize(options.rows ?? DEFAULT_CONFIG.rows);
  const cols = clampGridSize(options.cols ?? DEFAULT_CONFIG.cols);
  const initialLength = Math.max(2, options.initialLength ?? DEFAULT_CONFIG.initialLength);
  const startRow = Math.floor(rows / 2);
  const startCol = Math.floor(cols / 2) - Math.floor(initialLength / 2);

  const snake = Array.from({ length: initialLength }, (_, index) => ({
    row: startRow,
    col: startCol - index,
  }));

  return {
    rows,
    cols,
    snake,
    direction: 'right',
    nextDirection: 'right',
    pendingGrowth: 0,
    food: placeFood(rows, cols, snake, randomFn),
    score: 0,
    status: GAME_STATUS.RUNNING,
  };
}

export function tick(state, randomFn = Math.random) {
  if (state.status !== GAME_STATUS.RUNNING) {
    return state;
  }

  const direction = state.nextDirection ?? state.direction;
  const vector = DIRECTIONS[direction];
  const head = state.snake[0];
  const newHead = {
    row: head.row + vector.rowDelta,
    col: head.col + vector.colDelta,
  };

  if (isOutside(newHead, state.rows, state.cols)) {
    return { ...state, status: GAME_STATUS.OVER };
  }

  const ateFood = Boolean(state.food && samePosition(newHead, state.food));
  let pendingGrowth = state.pendingGrowth + (ateFood ? 1 : 0);
  const shouldGrow = pendingGrowth > 0;
  const remainingBody = copySegments(
    shouldGrow ? state.snake : state.snake.slice(0, -1),
  );

  if (hitSelf(newHead, remainingBody)) {
    return { ...state, status: GAME_STATUS.OVER };
  }

  const newSnake = [newHead, ...remainingBody];
  if (shouldGrow && pendingGrowth > 0) {
    pendingGrowth -= 1;
  }
  const newFood = ateFood ? placeFood(state.rows, state.cols, newSnake, randomFn) : state.food;

  return {
    ...state,
    direction,
    nextDirection: direction,
    snake: newSnake,
    food: newFood,
    pendingGrowth,
    score: ateFood ? state.score + 1 : state.score,
  };
}

export function queueDirection(state, directionKey) {
  if (!DIRECTIONS[directionKey]) {
    return state;
  }
  if (directionKey === state.nextDirection) {
    return state;
  }
  const blockedDirection = OPPOSITES[state.direction];
  if (directionKey === blockedDirection) {
    return state;
  }

  return {
    ...state,
    nextDirection: directionKey,
  };
}

export function restart(state, randomFn = Math.random) {
  return createGameState(
    {
      rows: state.rows,
      cols: state.cols,
    },
    randomFn,
  );
}

export function placeFood(rows, cols, snake, randomFn = Math.random) {
  const available = [];
  const occupied = new Set(snake.map(segmentKey));
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const key = `${row}:${col}`;
      if (!occupied.has(key)) {
        available.push({ row, col });
      }
    }
  }

  if (available.length === 0) {
    return null;
  }

  const index = Math.floor(Math.abs(randomFn()) * available.length) % available.length;
  return available[index];
}

export function isOutside(position, rows, cols) {
  return (
    position.row < 0 ||
    position.col < 0 ||
    position.row >= rows ||
    position.col >= cols
  );
}

export function hitSelf(head, body) {
  return body.some((segment) => samePosition(segment, head));
}

export function samePosition(a, b) {
  return a.row === b.row && a.col === b.col;
}

function copySegments(segments) {
  return segments.map((segment) => ({ ...segment }));
}

function segmentKey(segment) {
  return `${segment.row}:${segment.col}`;
}

function clampGridSize(value) {
  return Math.max(4, Math.min(64, Math.floor(value)));
}
