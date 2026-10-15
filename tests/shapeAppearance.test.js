import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeOutlinePaths } from '../src/canvas/shapeGeometry.js';
import { sketchHatchPaths } from '../src/canvas/vectorStyle.js';
import { drawVectorItems } from '../src/canvas/drawVectorItems.js';
import { exportManifest, planManifest } from '../src/canvas/asCode/manifest.js';
import { rasterDescriptor, sameRasterInput } from '../src/canvas/rasterObjectCache.js';
import { flatRectangleTint } from '../src/canvas/flatShapeTint.js';

const base = { kind: 'shape', shapeType: 'polygon', x: .1, y: .1, width: .2, height: .2, fill: '#ff0000', shadowEnabled: false, permission: 'default' };
test('custom polygons and rounded corners stay closed, finite and within their frame at supported extremes', () => {
  for (const vertexCount of [3, 7, 64]) for (const cornerStyle of ['sharp', 'rounded']) {
    const [path] = shapeOutlinePaths('polygon', 320, 180, { vertexCount, cornerStyle });
    assert.equal(path.length, vertexCount * (cornerStyle === 'rounded' ? 9 : 1) + 1);
    assert.deepEqual(path[0], path.at(-1));
    assert.ok(path.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 320 && p.y >= 0 && p.y <= 180));
    assert.equal(Math.min(...path.map(p => p.x)), 0); assert.equal(Math.max(...path.map(p => p.y)), 180);
  }
  assert.notDeepEqual(shapeOutlinePaths('rectangle', 320, 180, { cornerStyle: 'rounded' }), shapeOutlinePaths('rectangle', 320, 180));
  assert.equal(shapeOutlinePaths('star', 320, 180, { vertexCount: 7 })[0].length, 15);
});
test('fill transparency changes alpha only in standard mode and line density only in sketch mode', () => {
  const fills = [], strokes = [];
  const g = { clear() {}, poly() { return this; }, moveTo() {}, lineTo() {}, fill(s) { fills.push(s); return this; }, stroke(s) { strokes.push(s); return this; } };
  drawVectorItems(g, { a: { ...base, strokeEnabled: false, fillOpacity: .35 } }, 1600, 1000);
  assert.deepEqual(fills, [{ color: 0xff0000, alpha: .35 }]);
  const [polygon] = shapeOutlinePaths('polygon', 320, 180);
  const dense = sketchHatchPaths(polygon, 'a', undefined, 1), sparse = sketchHatchPaths(polygon, 'a', undefined, .25);
  assert.ok(sparse.length < dense.length / 2);
  assert.equal(sparse[0].alpha, dense[0].alpha, 'density does not fade the pen');
  for (const visualStyle of ['standard', 'sketch']) {
    fills.length = 0; strokes.length = 0;
    drawVectorItems(g, { a: { ...base, visualStyle, strokeEnabled: false, fillOpacity: 0 } }, 1600, 1000);
    assert.equal(fills.length, 0); assert.equal(strokes.length, 0);
  }
});
test('settings round-trip with strict validation and invalidate cached shape pixels', () => {
  const item = { ...base, vertexCount: 9, cornerStyle: 'rounded', fillOpacity: .4, sketchFillOpacity: .9 };
  assert.deepEqual(planManifest(exportManifest({ a: item }), {}, 'default').creates[0].item, item);
  for (const [field, values] of Object.entries({ vertexCount: [2, 65, 3.5], fillOpacity: [-.01, 1.01], sketchFillOpacity: [-.01, 1.01], cornerStyle: ['unknown'] })) {
    for (const value of values) assert.throws(() => planManifest(exportManifest({ a: { ...item, [field]: value } }), {}, 'default'));
  }
  for (const [field, value] of Object.entries({ vertexCount: 10, cornerStyle: 'sharp', fillOpacity: .7, sketchFillOpacity: 1 })) {
    const changed = { ...item, [field]: value };
    assert.equal(sameRasterInput(item, changed), false);
    assert.notEqual(rasterDescriptor('a', item, { width: 1600, height: 1000 }, {}).key, rasterDescriptor('a', changed, { width: 1600, height: 1000 }, {}).key);
  }
  const rect = { ...base, shapeType: 'rectangle', strokeEnabled: false };
  assert.equal(flatRectangleTint(rect), 0xff0000);
  assert.equal(flatRectangleTint({ ...rect, fillOpacity: .4 }), 0xff0000);
  assert.equal(flatRectangleTint({ ...rect, cornerStyle: 'rounded' }), null);
});

test('shape border width is respected by both styles, arrow heads, cached pixels and outside-edge hit tests', async () => {
  const { shapeArrowGeometry } = await import('../src/components/shapeArrowGeometry.js');
  const { default: CanvasSpatialBTree } = await import('../src/components/CanvasSpatialBTree.js');
  const { hitTestVector } = await import('../src/canvas/vectorHitTest.js');
  for (const visualStyle of ['standard', 'sketch']) {
    const strokes = [], g = { clear() {}, poly() { return this; }, moveTo() {}, lineTo() {}, fill() { return this; }, stroke(s) { strokes.push(s); return this; } };
    drawVectorItems(g, { a: { ...base, fill: '', strokeWidth: 20, visualStyle } }, 1600, 1000);
    assert.equal(strokes[0].width, visualStyle === 'sketch' ? 17 : 20);
  }
  const thin = shapeArrowGeometry(200, 100, 0, 'none', 'triangle', { strokeWidth: .5 });
  const thick = shapeArrowGeometry(200, 100, 0, 'none', 'triangle', { strokeWidth: 12 });
  assert.ok(thick.heads[0].strokeWidth > thin.heads[0].strokeWidth);
  const item = { ...base, shapeType: 'rectangle', fill: '', strokeWidth: 64 };
  const world = { width: 1600, height: 1000 }, index = new CanvasSpatialBTree({ a: item }, world);
  assert.equal(hitTestVector(index, { x: item.x - 31 / world.width, y: item.y + .1 }, world)?.id, 'a');
  assert.equal(hitTestVector(index, { x: item.x - 34 / world.width, y: item.y + .1 }, world), null);
  assert.notEqual(rasterDescriptor('a', item, world, {}).key, rasterDescriptor('a', { ...item, strokeWidth: 1 }, world, {}).key);
  assert.equal(planManifest(exportManifest({ a: item }), {}, 'default').creates[0].item.strokeWidth, 64);
  for (const strokeWidth of [0, .1, 65]) assert.throws(() => planManifest(exportManifest({ a: { ...item, strokeWidth } }), {}, 'default'));
});

test('sketch fill ink becomes opaque without adding lines or affecting standard fills and arrowhead defaults', () => {
  const [path] = shapeOutlinePaths('polygon', 320, 180);
  const legacy = sketchHatchPaths(path, 'ink'), opaque = sketchHatchPaths(path, 'ink', undefined, 1, 1);
  assert.deepEqual(legacy.map(s => s.points), opaque.map(s => s.points));
  assert.ok(opaque.filter(s => s.widthScale === 1).every(s => s.alpha === 1));
  assert.ok(legacy.filter(s => s.widthScale === 1).every(s => s.alpha < .33));
  assert.deepEqual(sketchHatchPaths(path, 'ink', undefined, 1, 0), []);
  const strokes = [], fills = [];
  const g = { clear() {}, poly() { return this; }, moveTo() {}, lineTo() {}, fill(s) { fills.push(s); return this; }, stroke(s) { strokes.push(s); return this; } };
  drawVectorItems(g, { a: { ...base, strokeEnabled: false, visualStyle: 'sketch' } }, 1600, 1000);
  assert.ok(strokes[0].alpha >= .775 && strokes[0].alpha <= .825, 'unspecified shape ink defaults to 80%');
  strokes.length = 0;
  drawVectorItems(g, { a: { ...base, strokeEnabled: false, visualStyle: 'sketch', sketchFillOpacity: 0 } }, 1600, 1000);
  assert.equal(strokes.length, 0);
  drawVectorItems(g, { a: { ...base, strokeEnabled: false, visualStyle: 'standard', sketchFillOpacity: 0, fillOpacity: .5 } }, 1600, 1000);
  assert.deepEqual(fills, [{ color: 0xff0000, alpha: .5 }]);
});
