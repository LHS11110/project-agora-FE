import test from 'node:test';
import assert from 'node:assert/strict';
import { objectCornerStyle, objectCornerRadius } from '../src/canvas/objectCorners.js';

test('default card rounding matches explicitly selected rounding in preview rendering', () => {
  for (const kind of ['chart', 'pdf', 'table', 'text', 'code', 'link']) {
    const initial = { kind };
    assert.equal(objectCornerStyle(initial), 'rounded');
    assert.equal(objectCornerRadius(initial, 300, 200), objectCornerRadius({ ...initial, cornerStyle: 'rounded' }, 300, 200));
    assert.equal(objectCornerRadius({ ...initial, cornerStyle: 'sharp' }, 300, 200), 0);
  }
});

test('images stay sharp by default and small rounded objects clamp the radius', () => {
  assert.equal(objectCornerStyle({ kind: 'image' }), 'sharp');
  assert.equal(objectCornerRadius({ kind: 'image' }), 0);
  assert.equal(objectCornerRadius({ kind: 'image', cornerStyle: 'rounded' }, 20, 10), 5);
});
