import test from 'node:test';
import assert from 'node:assert/strict';
import CanvasGridIndex from '../src/canvas/grid/CanvasGridIndex.js';
import CanvasSpatialBTree from '../src/components/CanvasSpatialBTree.js';
import RasterPaintIndex from '../src/canvas/RasterPaintIndex.js';
import { WgpuSceneBatcher } from '../src/canvas/wgpu/WgpuSceneBatcher.js';
import { itemSnapshot, changeItems } from '../src/canvas/itemSnapshots.js';

test('CanvasGridIndex indexes 1px grid tiles with macro bitsets, stamp dedupe, oversize buckets, and O(1) empty skip', () => {
  const grid = new CanvasGridIndex(1600, 1000);
  const items = [];
  for (let i = 0; i < 12000; i++) {
    const x = ((i % 120) * 140) / 1600;
    const y = (Math.floor(i / 120) * 140) / 1000;
    const entry = { id: `e${i}`, minX: x, minY: y, maxX: x + 64 / 1600, maxY: y + 64 / 1000 };
    items.push(entry);
  }
  const giantFrame = { id: 'giant', minX: -2, minY: -2, maxX: 6, maxY: 6 };
  items.push(giantFrame);
  grid.load(items);

  // Query intersecting only cell (0,0) and giant frame
  const hits = grid.search({ minX: 0, minY: 0, maxX: 50 / 1600, maxY: 50 / 1000 });
  const ids = new Set(hits.map((h) => h.id));
  assert.equal(ids.has('e0'), true);
  assert.equal(ids.has('giant'), true);
  assert.equal(ids.size, 2);

  // Repeating identical query hits exact cached result array reference
  assert.equal(grid.search({ minX: 0, minY: 0, maxX: 50 / 1600, maxY: 50 / 1000 }), hits);

  // Huge zoom-out query over unoccupied empty negative space executes cleanly and returns only overlapping entries
  const farEmpty = grid.search({ minX: -500, minY: -500, maxX: -10, maxY: -10 });
  assert.deepEqual(farEmpty, []);

  // Remove giant frame and verify macro bounds/oversize cleanup
  grid.remove(giantFrame);
  const afterRemove = grid.search({ minX: 0, minY: 0, maxX: 50 / 1600, maxY: 50 / 1000 });
  assert.deepEqual(afterRemove.map((h) => h.id), ['e0']);
});

test('CanvasSpatialBTree and RasterPaintIndex use 1px grid indexing cleanly across incremental moves', () => {
  const initial = itemSnapshot({
    a: { kind: 'shape', shapeType: 'rectangle', x: 0.05, y: 0.05, width: 0.1, height: 0.1 },
    b: { kind: 'shape', shapeType: 'rectangle', x: 2.5, y: 2.5, width: 0.1, height: 0.1 },
  });
  const world = { width: 1600, height: 1000 };
  const tree = new CanvasSpatialBTree(initial, world);
  assert.ok(tree.gridIndex instanceof CanvasGridIndex);
  assert.deepEqual(tree.query({ minX: 0, minY: 0, maxX: 0.2, maxY: 0.2 }).map((e) => e.id), ['a']);

  const moved = changeItems(initial, {
    b: { kind: 'shape', shapeType: 'rectangle', x: 0.08, y: 0.08, width: 0.1, height: 0.1 },
  });
  tree.update(moved, world);
  assert.deepEqual(
    tree.query({ minX: 0, minY: 0, maxX: 0.25, maxY: 0.25 }).map((e) => e.id).sort(),
    ['a', 'b']
  );

  const paintIndex = new RasterPaintIndex();
  const r1 = { id: 'r1', paintedBounds: { minX: 10, minY: 10, maxX: 90, maxY: 90 } };
  const r2 = { id: 'r2', paintedBounds: { minX: 4000, minY: 3000, maxX: 4100, maxY: 3100 } };
  const r3 = { id: 'r3', paintedBounds: { minX: 30, minY: 30, maxX: 150, maxY: 150 } };
  const r4 = { id: 'r4', paintedBounds: { minX: 4500, minY: 3500, maxX: 4600, maxY: 3600 } };
  const r5 = { id: 'r5', paintedBounds: { minX: 5000, minY: 4000, maxX: 5100, maxY: 4100 } };
  const ordered = [r1, r2, r3, r4, r5];
  ordered.forEach((r, i) => paintIndex.update(r, i));
  const partial = paintIndex.query({ minX: 0, minY: 0, maxX: 200, maxY: 200 }, ordered);
  assert.deepEqual(partial.map((r) => r.id), ['r1', 'r3']);
});

test('WgpuSceneBatcher culls off-frustum records while keeping visible and active-drag records', () => {
  const batcher = new WgpuSceneBatcher();
  let uploadedCounts = 0;
  const fakeRenderer = {
    update_scene(words) {
      uploadedCounts = words.length / 12;
    },
  };
  const makeRec = (id, minX, minY, maxX, maxY, texId = 1) => ({
    id,
    hidden: false,
    descriptor: { x: minX, y: minY, centerX: (maxX - minX) / 2, centerY: (maxY - minY) / 2, rotation: 0 },
    raster: { left: 0, top: 0, width: maxX - minX, height: maxY - minY },
    paintedBounds: { minX, minY, maxX, maxY },
    resource: { textureHandle: { texId, uvMinX: 0, uvMinY: 0, uvMaxX: 1, uvMaxY: 1 } },
  });

  const ordered = [
    makeRec('onScreen', 100, 100, 200, 200),
    makeRec('offScreen', 5000, 5000, 5100, 5100),
    makeRec('draggedIntoScreen', 4800, 120, 4900, 220),
  ];

  // Without cull bounds: submits all 3
  assert.equal(batcher.sync(fakeRenderer, ordered, null, null), 3);
  assert.equal(uploadedCounts, 3);

  // With viewport cull bounds: submits only overlapping instances; dragging offscreen record into frustum renders it
  const drag = { ids: new Set(['draggedIntoScreen']), dx: -4500, dy: 0 };
  const drawn = batcher.sync(fakeRenderer, ordered, drag, { minX: 0, minY: 0, maxX: 1600, maxY: 1000 });
  assert.equal(drawn, 2);
  assert.equal(uploadedCounts, 2);
});
