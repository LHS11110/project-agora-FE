import test from 'node:test';
import assert from 'node:assert/strict';
import { connectorGeometry } from '../src/components/connectorGeometry.js';
import CanvasSpatialBTree from '../src/components/CanvasSpatialBTree.js';
import { itemSnapshot, changeItems } from '../src/canvas/itemSnapshots.js';

const world = { width: 1600, height: 1000 };
const points = geometry => geometry?.points?.map(p => [Math.round(p.x * 1e6), Math.round(p.y * 1e6)]) ?? null;

test('cached connector routes always equal a fresh route after nearby, far and unrelated edits', () => {
  let seed = 3; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const initial = {};
  for (let i = 0; i < 60; i++) initial['r' + i] = { kind: 'shape', shapeType: 'rectangle', x: random() * .9, y: random() * .9, width: .03 + random() * .04, height: .03 + random() * .04 };
  for (let i = 0; i < 8; i++) initial['k' + i] = { kind: 'connector', from: 'r' + (i * 3), to: 'r' + (i * 3 + 20) };
  initial.note = { kind: 'text', renderMode: 'plain', text: 'far', x: .97, y: .97, width: .02, height: .02 };
  let items = itemSnapshot(initial);
  const index = new CanvasSpatialBTree(items, world);
  for (let i = 0; i < 8; i++) connectorGeometry(items['k' + i], items, world.width, world.height, index);
  let reused = 0;
  for (let step = 0; step < 60; step++) {
    const changes = {}, removed = [];
    const roll = random();
    if (roll < .3) { const id = 'r' + Math.floor(random() * 60); if (items[id]) changes[id] = { ...items[id], x: random() * .9, y: random() * .9 }; }
    else if (roll < .45) changes['extra' + step] = { kind: 'shape', shapeType: 'rectangle', x: random() * .9, y: random() * .9, width: .05, height: .05 };
    else if (roll < .55) { const id = 'r' + Math.floor(random() * 60); if (items[id] && !Object.values(initial).some(c => c.kind === 'connector' && (c.from === id || c.to === id))) removed.push(id); }
    else changes.note = { ...items.note, text: 'far ' + step };
    const before = items;
    items = changeItems(items, changes, removed);
    if (items === before) continue;
    index.update(items, world, step + 1, [...Object.keys(changes), ...removed]);
    for (let i = 0; i < 8; i++) {
      const id = 'k' + i;
      const cached = connectorGeometry(items[id], items, world.width, world.height, index);
      // An unrelated lineage forces a full computation for comparison.
      const freshItems = itemSnapshot(Object.fromEntries(Object.keys(items).map(key => [key, items[key]])));
      const fresh = connectorGeometry(freshItems[id], freshItems, world.width, world.height, new CanvasSpatialBTree(freshItems, world));
      assert.deepEqual(points(cached), points(fresh), `step ${step} ${id}`);
    }
    if (Object.keys(changes).join() === 'note') reused++;
  }
  assert.ok(reused > 10);
});

test('an unrelated edit reuses every connector route instead of rerouting', () => {
  // A short connector: its obstacle search area does not reach the far corner.
  const initial = { a: { kind: 'shape', shapeType: 'rectangle', x: .1, y: .1, width: .05, height: .05 }, b: { kind: 'shape', shapeType: 'rectangle', x: .3, y: .1, width: .05, height: .05 }, wall: { kind: 'shape', shapeType: 'rectangle', x: .21, y: .02, width: .02, height: .25 }, far: { kind: 'text', renderMode: 'plain', text: 'x', x: .95, y: .95, width: .01, height: .01 }, k: { kind: 'connector', from: 'a', to: 'b' } };
  let items = itemSnapshot(initial);
  const index = new CanvasSpatialBTree(items, world);
  const first = connectorGeometry(items.k, items, world.width, world.height, index);
  assert.equal(first.routed, true, 'the wall forces an A* route');
  items = changeItems(items, { far: { ...items.far, text: 'y' } });
  index.update(items, world, 1, ['far']);
  assert.equal(connectorGeometry(items.k, items, world.width, world.height, index), first, 'same geometry object: no reroute');
  items = changeItems(items, { wall: { ...items.wall, y: .5 } });
  index.update(items, world, 2, ['wall']);
  assert.notEqual(connectorGeometry(items.k, items, world.width, world.height, index), first, 'moving an obstacle reroutes');
});
