import test from 'node:test';
import assert from 'node:assert/strict';
import { numericObjectPatch, numericObjectGeometry } from '../src/canvas/objectNumericGeometry.js';
import { shapeArrowGeometry, shapeArrowControlFromPointer, resizeShapeArrowControls } from '../src/components/shapeArrowGeometry.js';
import { connectorGeometry } from '../src/components/connectorGeometry.js';
import { sameRasterInput, rasterDescriptor } from '../src/canvas/rasterObjectCache.js';
import { exportManifest, planManifest } from '../src/canvas/asCode/manifest.js';
import { objectBounds } from '../src/components/CanvasSpatialBTree.js';
const world = { width: 1600, height: 1000 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('numeric positions and dimensions use world pixels beyond the initial viewport', () => {
  const shape = { kind: 'shape', x: .1, y: .2, width: .14, height: .12 };
  assert.deepEqual(numericObjectGeometry(shape), { x: 160, y: 200, width: 224.00000000000003, height: 120 });
  assert.deepEqual(numericObjectPatch(shape, 'x', -8000), { x: -5 });
  assert.deepEqual(numericObjectPatch(shape, 'height', 333), { height: .333 });
  for (const value of [NaN, Infinity, -1, 0]) assert.equal(numericObjectPatch(shape, 'width', value), null);
  assert.equal(numericObjectPatch({ kind: 'connector' }, 'x', 50), null);
});

test('numeric stroke transforms preserve pressure and reshape actual points', () => {
  const item = { kind: 'stroke', points: [{ x: .1, y: .2, pressure: .4 }, { x: .3, y: .4, pressure: .9 }] };
  const moved = { ...item, ...numericObjectPatch(item, 'x', -100) };
  close(numericObjectGeometry(moved).x, -100);
  close(moved.points[1].x - moved.points[0].x, .2);
  assert.equal(moved.points[0].pressure, .4);
  const resized = { ...moved, ...numericObjectPatch(moved, 'height', 400) };
  close(numericObjectGeometry(resized).height, 400);
  close(resized.points[0].y, .2);
  assert.deepEqual(numericObjectPatch(item, 'opacity', 0), { opacity: 0 });
  assert.equal(numericObjectPatch({ kind: 'stroke', points: [{ x: 0, y: 0 }] }, 'width', 100), null);
});

test('free curve handles follow both pointer axes after inverse rotation', () => {
  const item = { kind: 'shape', shapeType: 'arrow', x: .2, y: .3, width: .2, height: .2, rotation: 90 };
  const patch = shapeArrowControlFromPointer(item, { x: .4, y: .5 }, world);
  // Center is (480,400), pointer (640,500). Inverse rotation => (580,240).
  close(patch.bendPoints[0].x, 260 / 320);
  close(patch.bendPoints[0].y, -60 / 200);
  const geometry = shapeArrowGeometry(320, 200, item.bend, item.startHead, item.endHead, { ...item, ...patch });
  assert.ok(geometry.curvePoints.some(p => Math.hypot(p.x - 260, p.y + 60) < 1e-7));
  assert.deepEqual(shapeArrowControlFromPointer(item, { x: .4, y: .5 }, world, 2), {});
});

test('multiple independent shape handles are interpolated, resize with the box, and expand bounds', () => {
  const item = { kind: 'shape', shapeType: 'arrow', x: 0, y: 0, width: .2, height: .2, bendPointCount: 3,
    bendPoints: [{ x: .2, y: 1.4 }, { x: .5, y: -.5 }, { x: .8, y: .7 }] };
  const geometry = shapeArrowGeometry(320, 200, 0, undefined, undefined, item);
  for (const point of geometry.controlHandles) assert.ok(geometry.curvePoints.some(p => Math.hypot(p.x - point.x, p.y - point.y) < 1e-7));
  const bigger = shapeArrowGeometry(640, 400, 0, undefined, undefined, item);
  close(bigger.controlHandles[1].x, geometry.controlHandles[1].x * 2);
  const bounds = objectBounds(item, { a: item }, 1600, 1000);
  assert.ok(bounds.minY < -.09 && bounds.maxY > .27);
  const resized = resizeShapeArrowControls(item, 320, 200, 6);
  assert.equal(resized.bendPoints.length, 6);
  assert.ok(resized.bendPoints.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
});

test('head size affects ordinary and connecting arrows and invalidates cached pixels', () => {
  const item = { kind: 'shape', shapeType: 'arrow', width: .2, height: .2, headSize: 12 };
  const small = shapeArrowGeometry(320, 200, 0, 'none', 'triangle', item);
  const large = shapeArrowGeometry(320, 200, 0, 'none', 'triangle', { ...item, headSize: 48 });
  const extent = g => Math.hypot(g.heads[0].points[0].x - g.heads[0].points[1].x, g.heads[0].points[0].y - g.heads[0].points[1].y);
  assert.ok(extent(large) > extent(small) * 3);
  assert.equal(sameRasterInput(item, { ...item, headSize: 48 }), false);
  assert.notEqual(rasterDescriptor('a', item, world, {}).key, rasterDescriptor('a', { ...item, headSize: 48 }, world, {}).key);
  const items = { a: { kind: 'shape', x: .1, y: .2, width: .1, height: .1 }, b: { kind: 'shape', x: .7, y: .2, width: .1, height: .1 } };
  const connector = { kind: 'connector', from: 'a', to: 'b', headSize: 12 };
  assert.ok(extent(connectorGeometry({ ...connector, headSize: 48 }, items, 1600, 1000)) > extent(connectorGeometry(connector, items, 1600, 1000)) * 3);
});

test('head size and free shape points survive manifest export/import; invalid sizes fail', () => {
  const items = { a: { kind: 'shape', shapeType: 'arrow', x: .1, y: .2, width: .2, height: .2, headSize: 48, bendPointCount: 2, bendPoints: [{ x: .2, y: -.4 }, { x: .8, y: 1.3 }] } };
  const manifest = exportManifest(items), plan = planManifest(manifest, {}, 'public');
  assert.deepEqual(plan.creates[0].item.bendPoints, items.a.bendPoints);
  assert.equal(plan.creates[0].item.headSize, 48);
  assert.throws(() => planManifest({ version: 1, items: { a: { ...manifest.items.a, headSize: 129 } } }, {}, 'public'), /headSize/);
});

test('straightening keeps three handles collinear and allows editing the curve again', async () => {
  const { shapeArrowBendPatch } = await import('../src/components/shapeArrowGeometry.js');
  const item = { kind: 'shape', shapeType: 'arrow', x: .1, y: .2, width: .2, height: .2, bendPointCount: 3,
    bendPoints: [{ x: .2, y: 1.4 }, { x: .5, y: -.5 }, { x: .8, y: .7 }] };
  const straight = { ...item, ...shapeArrowBendPatch(item, 0) };
  assert.equal(straight.bendPoints.length, 3);
  for (const point of straight.bendPoints) close(point.x + point.y, 1);
  const curved = { ...straight, ...shapeArrowControlFromPointer(straight, { x: .5, y: .7 }, world, 1) };
  assert.equal(curved.bendPoints.length, curved.bendPointCount);
  assert.ok(Math.abs(curved.bendPoints[1].x + curved.bendPoints[1].y - 1) > .1);
  assert.doesNotThrow(() => planManifest(exportManifest({ arrow: curved }), {}, 'public'));
});
