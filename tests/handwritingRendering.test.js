import test from 'node:test';
import assert from 'node:assert/strict';
import { getStroke, getStrokePoints } from 'perfect-freehand';
import { freehandOptions } from '../src/canvas/freehandOptions.js';
import { inkPointAtPointer, inkStrokeOutline, inkStrokeSize } from '../src/canvas/inkStroke.js';
import { penStrokePoints } from '../src/canvas/penStroke.js';

test('stylus pressure preserves light contact and falls back only when unavailable', () => {
  const point = { x: .2, y: .4 };
  assert.equal(inkPointAtPointer({ pointerType: 'pen', pressure: 0 }, point).pressure, .05);
  assert.equal(inkPointAtPointer({ pointerType: 'pen', pressure: .01 }, point).pressure, .05);
  assert.equal(inkPointAtPointer({ pointerType: 'pen', pressure: 1.2 }, point).pressure, 1);
  assert.equal(inkPointAtPointer({ pointerType: 'pen' }, point).pressure, .5);
  assert.deepEqual(inkPointAtPointer({ pointerType: 'mouse', pressure: .5 }, point), point);
});

test('live and completed outlines coincide for a handwriting pen and brush', () => {
  const points = [{ x: 0, y: 0, pressure: .2 }, { x: 10, y: 2, pressure: .4 },
    { x: 14, y: 11, pressure: .7 }, { x: 19, y: 14, pressure: .3 }];
  for (const brush of ['pen', 'ink']) for (const simulatePressure of [true, false]) {
    const stroke = { brush, strokeWidth: 4, simulatePressure };
    assert.deepEqual(inkStrokeOutline(points, { ...stroke, complete: false }),
      inkStrokeOutline(points, { ...stroke, complete: true }), `${brush}: ${simulatePressure}`);
  }
});

test('tuple input produces the same outline as normalized object input', () => {
  const points = Array.from({ length: 80 }, (_, index) => ({ x: index / 2, y: Math.sin(index / 5) * 4,
    ...(index % 9 ? { pressure: (index % 13) / 10 } : {}) }));
  const normalized = points.map(point => ({ ...point, pressure: Number.isFinite(point.pressure)
    ? Math.max(0, Math.min(1, point.pressure)) : .5 }));
  for (const brush of ['pen', 'ink']) for (const simulatePressure of [true, false]) for (const complete of [true, false]) {
    const stroke = { brush, strokeWidth: 4, simulatePressure, complete };
    const reference = brush === 'pen' ? penStrokePoints(normalized, stroke) : normalized;
    assert.deepEqual(inkStrokeOutline(points, stroke), getStroke(reference, freehandOptions(stroke, inkStrokeSize(4))));
  }
});

test('the handwriting pen follows a tight corner and retains its exact endpoint', () => {
  const points = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 },
    { x: 8, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 2 }, { x: 10, y: 4 },
    { x: 10, y: 6 }, { x: 10, y: 8 }, { x: 10, y: 10 }];
  const samples = getStrokePoints(points, freehandOptions({ brush: 'pen', complete: false }, 6));
  assert.ok(Math.min(...samples.map(sample => Math.hypot(sample.point[0] - 10, sample.point[1]))) < .5);
  assert.deepEqual(samples.at(-1).point, [10, 10]);
});

test('stylus pressure smoothing remains stable at different sample densities', () => {
  const sparse = [{ x: 0, y: 0, pressure: .2 }, { x: 10, y: 0, pressure: .8 }];
  const dense = Array.from({ length: 11 }, (_, x) => ({ x, y: 0, pressure: x ? .8 : .2 }));
  const actual = penStrokePoints(sparse, { simulatePressure: false }).at(-1).pressure;
  const withMoreSamples = penStrokePoints(dense, { simulatePressure: false }).at(-1).pressure;
  assert.ok(Math.abs(actual - withMoreSamples) < 1e-12);
  assert.ok(actual > .2 && actual < .8);
});

test('a stationary stylus can change pressure before it moves again', () => {
  const samples = penStrokePoints([{ x: 0, y: 0, pressure: .1 }, { x: 0, y: 0, pressure: .8 },
    { x: 4, y: 0, pressure: .8 }], { simulatePressure: false });
  assert.equal(samples[1].pressure, .8);
  assert.equal(samples[2].pressure, .8);
});
