import assert from 'node:assert/strict';

import {
  createGameState,
  DEFAULT_CONFIG,
  GAME_STATUS,
  getTickMsForScore,
  placeFood,
  queueDirection,
  restart,
  tick,
} from '../src/snake/gameLogic.js';

const tests = [
  {
    name: 'snake advances to the right by default',
    fn() {
      let state = createGameState({ rows: 10, cols: 10 });
      const [headBefore] = state.snake;
      state = tick(state, () => 0);
      const [headAfter] = state.snake;
      assert.equal(headAfter.row, headBefore.row);
      assert.equal(headAfter.col, headBefore.col + 1);
    },
  },
  {
    name: 'eating food increases score and length immediately',
    fn() {
      let state = createGameState({ rows: 8, cols: 8 });
      const head = state.snake[0];
      state = {
        ...state,
        food: { row: head.row, col: head.col + 1 },
      };
      state = tick(state, () => 0);
      assert.equal(state.score, 1);
      assert.equal(state.snake.length, DEFAULT_CONFIG.initialLength + 1);
    },
  },
  {
    name: 'wall collision ends the run',
    fn() {
      let state = createGameState({ rows: 5, cols: 5 });
      while (state.status === GAME_STATUS.RUNNING) {
        state = tick(state, () => 0);
      }
      assert.equal(state.status, GAME_STATUS.OVER);
    },
  },
  {
    name: 'self collision ends the run',
    fn() {
      const customState = {
        ...createGameState({ rows: 8, cols: 8 }),
        snake: [
          { row: 3, col: 3 },
          { row: 3, col: 2 },
          { row: 2, col: 2 },
          { row: 2, col: 3 },
          { row: 2, col: 4 },
        ],
        direction: 'up',
        nextDirection: 'up',
        food: { row: 0, col: 0 },
        pendingGrowth: 0,
      };
      const result = tick(customState, () => 0);
      assert.equal(result.status, GAME_STATUS.OVER);
    },
  },
  {
    name: 'cannot reverse direction directly',
    fn() {
      let state = createGameState({ rows: 8, cols: 8 });
      state = queueDirection(state, 'left');
      assert.equal(state.nextDirection, 'right');
      state = queueDirection(state, 'up');
      assert.equal(state.nextDirection, 'up');
    },
  },
  {
    name: 'food placement avoids the snake body',
    fn() {
      const snake = [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ];
      const food = placeFood(2, 4, snake, () => 0.5);
      const overlaps = snake.some(
        (segment) => segment.row === food.row && segment.col === food.col,
      );
      assert.equal(overlaps, false);
    },
  },
  {
    name: 'restart returns a new running state',
    fn() {
      let state = createGameState({ rows: 6, cols: 6 });
      while (state.status === GAME_STATUS.RUNNING) {
        state = tick(state, () => 0);
      }
      state = restart(state, () => 0);
      assert.equal(state.status, GAME_STATUS.RUNNING);
      assert.equal(state.score, 0);
      assert.equal(state.snake.length, DEFAULT_CONFIG.initialLength);
    },
  },
  {
    name: 'higher score increases speed',
    fn() {
      const baseSpeed = getTickMsForScore(0);
      const fasterSpeed = getTickMsForScore(5);
      assert.equal(baseSpeed, DEFAULT_CONFIG.tickMs);
      assert.equal(fasterSpeed, DEFAULT_CONFIG.tickMs - 5 * DEFAULT_CONFIG.speedStepMs);
      assert.ok(fasterSpeed < baseSpeed);
    },
  },
  {
    name: 'speed is capped at the minimum interval',
    fn() {
      const cappedSpeed = getTickMsForScore(999);
      assert.equal(cappedSpeed, DEFAULT_CONFIG.minTickMs);
    },
  },
];

let failures = 0;

for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
