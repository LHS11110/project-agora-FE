import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasNudgeVector } from '../src/canvas/useCanvasKeyboardNudge.js';
import { CANVAS_SPACE } from '../src/canvas/canvasSpace.js';

test('arrow keys produce exact world pixel steps independent of camera scale', () => {
  for (const [key, x, y] of [['ArrowLeft', -1, 0], ['ArrowRight', 1, 0], ['ArrowUp', 0, -1], ['ArrowDown', 0, 1]]) {
    assert.deepEqual(canvasNudgeVector({ key }), { dx: x / CANVAS_SPACE.width, dy: y / CANVAS_SPACE.height });
    assert.deepEqual(canvasNudgeVector({ key, shiftKey: true }), { dx: x * 10 / CANVAS_SPACE.width, dy: y * 10 / CANVAS_SPACE.height });
  }
});
test('typing, consumed events, IME and platform keyboard shortcuts keep native behavior', () => {
  for (const flag of ['defaultPrevented', 'isComposing', 'ctrlKey', 'metaKey', 'altKey']) assert.equal(canvasNudgeVector({ key: 'ArrowRight', [flag]: true }), null);
  assert.equal(canvasNudgeVector({ key: 'x' }), null);
  assert.equal(canvasNudgeVector({ key: 'ArrowRight', target: { isContentEditable: true } }), null);
  assert.equal(canvasNudgeVector({ key: 'ArrowRight', target: { closest: () => ({}) } }), null);
});
