import test from 'node:test';
import assert from 'node:assert/strict';
import SceneViewModel from '../src/canvas/SceneViewModel.js';
import CanvasSpatialBTree from '../src/components/CanvasSpatialBTree.js';
import StableSpatialQuery from '../src/canvas/StableSpatialQuery.js';
import { itemSnapshot, changeItems } from '../src/canvas/itemSnapshots.js';

const world = { width: 1600, height: 1000 }, bounds = { minX: -1, minY: -1, maxX: 2, maxY: 2 };
const stroke = (x, y, depth = 0) => ({ kind: 'stroke', complete: true, brush: 'pen', strokeWidth: 3, depth, points: [{ x, y }, { x: x + .01, y: y + .01 }] });
const shape = (x, y, depth = 0) => ({ kind: 'shape', shapeType: 'rectangle', x, y, width: .02, height: .02, depth });

function summary(scene) {
  return scene.depthLayers.map(layer => ({
    depth: layer.depth,
    objects: layer.objects.map(([id]) => id).sort(),
    ink: Object.keys(layer.inkItems).sort(),
    vectors: Object.keys(layer.vectors).sort(),
  }));
}

test('erasing removes scene entries incrementally with the same result as a rebuild', () => {
  let seed = 7; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const initial = {};
  for (let i = 0; i < 80; i++) initial['s' + i] = i % 5 ? stroke(random(), random(), i % 3) : shape(random(), random(), i % 3);
  let items = itemSnapshot(initial), next = 80;
  const index = new CanvasSpatialBTree(), query = new StableSpatialQuery(), scene = new SceneViewModel();
  index.update(items, world);
  scene.update(query.query(index, bounds), items, world, 1, new Set(), new Set(), 0, index);
  let removals = 0;
  for (let step = 0; step < 120; step++) {
    const ids = Object.keys(items), changes = {}, removed = [];
    const roll = random();
    if (roll < .45 && ids.length > 4) { removed.push(ids[Math.floor(random() * ids.length)]); removals++; }
    else if (roll < .7) changes['n' + next++] = stroke(random(), random(), Math.floor(random() * 3));
    else { const id = ids[Math.floor(random() * ids.length)]; if (items[id].kind === 'stroke') changes[id] = { ...items[id], points: [...items[id].points, { x: random(), y: random() }] }; }
    if (step % 17 === 0 && ids.length > 6) { removed.push(ids[0], ids[1]); removals += 2; }
    items = changeItems(items, changes, removed);
    index.update(items, world, step + 1, [...Object.keys(changes), ...removed]);
    scene.update(query.query(index, bounds), items, world, 1, new Set(), new Set(), 0, index);
    const fresh = new SceneViewModel().update(new CanvasSpatialBTree(items, world).query(bounds), items, world, 1, new Set(), new Set(), 0, index);
    assert.deepEqual(summary(scene), summary(fresh), `step ${step}`);
    // Internal positions stay consistent after splicing.
    for (const [id, entry] of scene.byId) {
      assert.equal(scene.sorted[entry.sortIndex][0], id);
      assert.equal(scene.layers.get(entry.depth).objects[entry.objectIndex][0], id);
      assert.equal(scene.hitOrder.get(id), entry.sortIndex);
    }
    assert.equal(scene.sorted.length, scene.byId.size);
  }
  assert.ok(removals > 30);
  assert.ok(scene.stats.appends > 30, `incremental path used (${JSON.stringify(scene.stats)})`);
});
