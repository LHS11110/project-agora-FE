import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDepthLayers, itemDepth } from '../src/canvas/itemDepth.js';
import { exportManifest, planManifest } from '../src/canvas/asCode/manifest.js';

test('depth layers interleave vector and content objects and retain a default drawing layer', () => {
  const entries = [['front', { kind: 'shape', depth: 4 }], ['text', { kind: 'text', depth: -2 }], ['stroke', { kind: 'stroke', depth: -2 }]];
  const layers = buildDepthLayers(entries);
  assert.deepEqual(layers.map(layer => layer.depth), [-2, 0, 4]);
  assert.deepEqual(layers[0].objects.map(([id]) => id), ['text', 'stroke']);
  assert.deepEqual(Object.keys(layers[0].vectors), ['stroke']);
  assert.equal(itemDepth({}), 0);
  assert.equal(itemDepth({ depth: Infinity }), 0);
});

test('canvas code round trips negative depth and rejects fractional depth', () => {
  const items = { shape: { kind: 'shape', x: .2, y: .3, depth: -4 } };
  const manifest = exportManifest(items);
  assert.equal(planManifest(manifest, {}, 'default').creates[0].item.depth, -4);
  manifest.items.shape.depth = .5;
  assert.throws(() => planManifest(manifest, {}, 'default'), /depth/);
});
