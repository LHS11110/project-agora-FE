import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDepthRenderGroups } from '../src/canvas/depthRenderGroups.js';
import { changeItems, changedItemIds, itemSnapshot } from '../src/canvas/itemSnapshots.js';

const shape = (id, depth) => ({ kind: 'shape', shapeType: 'rectangle', depth, id });
const layer = (depth, vectors = {}, extra = {}) => ({ depth, domObjects: [], vectors: itemSnapshot(vectors), inkItems: itemSnapshot({}), ...extra });
const noDom = () => false;

test('vector-only depths share one renderer and keep depth order', () => {
  const layers = [-2, -1, 0, 1, 2, 3].map((d) => layer(d, { [`s${d}`]: shape(`s${d}`, d) }));
  const groups = buildDepthRenderGroups(layers, noDom, new Map());
  assert.deepEqual(groups.map((g) => g.key), ['d0', 'top']);
  assert.deepEqual(groups.map((g) => g.depths), [[-2, -1, 0], [1, 2, 3]]);
  assert.deepEqual(Object.keys(groups[0].vectors), ['s-2', 's-1', 's0']);
  assert.deepEqual(Object.keys(groups[1].vectors), ['s1', 's2', 's3']);
  assert.equal(groups[0].hasDepthZero, true);
});

test('persistent DOM and ink split groups; selection-only DOM does not', () => {
  const note = ['n2', { kind: 'note', depth: 2 }];
  const picked = ['s4', shape('s4', 4)];
  const layers = [
    layer(0),
    layer(1, { a: shape('a', 1) }),
    layer(2, { b: shape('b', 2) }, { domObjects: [note] }),
    layer(3, {}, { inkItems: itemSnapshot({ ink: { kind: 'stroke', depth: 3 } }) }),
    layer(4, { s4: shape('s4', 4) }, { domObjects: [picked] }),
    layer(5, { c: shape('c', 5) }),
  ];
  const groups = buildDepthRenderGroups(layers, (id) => id === 'n2', new Map());
  assert.deepEqual(groups.map((g) => [g.key, g.depths]), [['d0', [0]], ['d2', [1, 2]], ['d3', [3]], ['top', [4, 5]]]);
  assert.deepEqual(groups[3].domObjects, [picked]);
  assert.equal(Object.keys(groups[2].inkItems).length, 1);
});

test('array-index ids never merge across depths', () => {
  const layers = [layer(0), layer(1, { b: shape('b', 1) }), layer(2, { 7: shape('7', 2) }), layer(3, { a: shape('a', 3) })];
  const groups = buildDepthRenderGroups(layers, noDom, new Map());
  assert.deepEqual(groups.map((g) => g.depths), [[0], [1], [2], [3]]);
});

test('edits patch the merged snapshot so the renderer sees only changed ids', () => {
  const cache = new Map();
  const l1 = layer(1, { a: shape('a', 1) }), l2 = layer(2, { b: shape('b', 2) });
  const first = buildDepthRenderGroups([layer(0), l1, l2], noDom, cache)[1].vectors;
  assert.equal(buildDepthRenderGroups([layer(0), l1, l2], noDom, cache)[1].vectors, first, 'unchanged inputs reuse the snapshot');

  const l1b = { ...l1, vectors: changeItems(l1.vectors, { a: { ...shape('a', 1), fill: '#f00' } }) };
  const edited = buildDepthRenderGroups([layer(0), l1b, l2], noDom, cache)[1].vectors;
  assert.deepEqual(changedItemIds(first, edited), ['a']);
  assert.equal(edited.a.fill, '#f00');

  const l2b = { ...l2, vectors: changeItems(l2.vectors, { c: shape('c', 2) }) };
  const appended = buildDepthRenderGroups([layer(0), l1b, l2b], noDom, cache)[1].vectors;
  assert.deepEqual(Object.keys(appended), ['a', 'b', 'c']);
  assert.deepEqual(changedItemIds(edited, appended), ['c']);

  // Adding below the top depth must rebuild so the new object stays underneath.
  const l1c = { ...l1b, vectors: changeItems(l1b.vectors, { d: shape('d', 1) }) };
  const inserted = buildDepthRenderGroups([layer(0), l1c, l2b], noDom, cache)[1].vectors;
  assert.deepEqual(Object.keys(inserted), ['a', 'd', 'b', 'c']);
});

test('moving an object between merged depths restores depth order', () => {
  const cache = new Map();
  const l1 = layer(1, { a: shape('a', 1), m: shape('m', 1) }), l2 = layer(2, { b: shape('b', 2) });
  buildDepthRenderGroups([layer(0), l1, l2], noDom, cache);
  const l1b = { ...l1, vectors: changeItems(l1.vectors, null, ['m']) };
  const l2b = { ...l2, vectors: changeItems(l2.vectors, { m: shape('m', 2) }) };
  const moved = buildDepthRenderGroups([layer(0), l1b, l2b], noDom, cache)[1].vectors;
  assert.deepEqual(Object.keys(moved), ['a', 'b', 'm']);
});
