import test from 'node:test';
import assert from 'node:assert/strict';
import {
  objectCornerStyle,
  objectCornerRadius,
  selectionCornerState,
  supportsAnyCorners,
} from '../src/canvas/objectCorners.js';
import { shapeOutlinePaths } from '../src/canvas/shapeGeometry.js';

test('frames stay sharp by default, clamp small radii, and match rectangle corner cuts at 24px', () => {
  assert.equal(objectCornerStyle({ kind: 'frame' }), 'sharp');
  assert.equal(objectCornerRadius({ kind: 'frame', cornerStyle: 'rounded' }, 400, 300), 24);
  assert.equal(objectCornerRadius({ kind: 'image', cornerStyle: 'rounded' }, 20, 10), 5);

  const [rectPath] = shapeOutlinePaths('rectangle', 800, 500, { cornerStyle: 'rounded' });
  const firstPoint = rectPath[0];
  assert.ok(Math.abs(firstPoint.y - 24) < 1e-6, `expected 24px cut, got ${firstPoint.y}`);
});

test('selectionCornerState aggregates sharp, rounded, and mixed corner states across images and shapes', () => {
  const items = {
    img: { kind: 'image' },
    border: { kind: 'shape', shapeType: 'rectangle', cornerStyle: 'rounded' },
    circle: { kind: 'shape', shapeType: 'circle' },
    note: { kind: 'note' },
  };
  assert.equal(supportsAnyCorners(items.img), true);
  assert.equal(supportsAnyCorners(items.border), true);
  assert.equal(supportsAnyCorners(items.circle), false);

  assert.deepEqual(selectionCornerState(['img'], items), { targetIds: ['img'], value: 'sharp' });
  assert.deepEqual(selectionCornerState(['border'], items), { targetIds: ['border'], value: 'rounded' });
  assert.deepEqual(selectionCornerState(['img', 'border'], items), { targetIds: ['img', 'border'], value: 'mixed' });
  assert.deepEqual(selectionCornerState(['circle', 'note'], items), { targetIds: [], value: null });
});
