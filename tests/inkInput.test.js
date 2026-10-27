import test from 'node:test';
import assert from 'node:assert/strict';
import { appendInkInput, inkPointerSamples } from '../src/canvas/inkInput.js';

const size = { width: 1600, height: 1000 };
const sample = (x, y, pressure = .5, pointerId = 7) => ({ clientX: x, clientY: y, pointerType: 'pen', pressure, pointerId });
const options = (scale = 1, extra = {}) => ({
  size, scale, brush: 'pen',
  toPoint: event => ({ x: event.clientX / (size.width * scale), y: event.clientY / (size.height * scale) }),
  ...extra,
});

test('coalesced stylus samples keep order, pressure and the newest dispatch without duplicate points', () => {
  const points = [{ x: 0, y: 0, pressure: .3 }];
  const event = { ...sample(3, 1, .8), nativeEvent: { getCoalescedEvents: () => [sample(1, 0, .4), sample(2, .5, .6)] } };
  const added = appendInkInput(event, points, options());
  assert.equal(added.length, 3);
  assert.deepEqual(added.map(point => point.pressure), [.4, .6, .8]);
  assert.deepEqual(added.map(point => point.x), [1 / 1600, 2 / 1600, 3 / 1600]);
  const duplicate = { ...sample(4, 1, .8), nativeEvent: { getCoalescedEvents: () => [sample(4, 1, .8)] } };
  assert.equal(appendInkInput(duplicate, points, options()).length, 1);
});

test('sampling uses screen pixels rather than world units across zoom levels', () => {
  for (const scale of [.1, 1, 8]) {
    const points = [{ x: 0, y: 0, pressure: .5 }];
    assert.equal(appendInkInput(sample(.12, 0), points, options(scale)).length, 0);
    assert.equal(appendInkInput(sample(.3, 0), points, options(scale)).length, 1);
    assert.ok(Math.abs(points[1].x * size.width * scale - .3) < 1e-10);
  }
});

test('release retains the last contact pressure and adds the final small movement', () => {
  const points = [{ x: .1, y: .2, pressure: .7 }];
  const release = sample(160.3, 200, 0);
  const added = appendInkInput(release, points, options(1, { final: true }));
  assert.equal(added.length, 1);
  assert.equal(added[0].pressure, .7);
  assert.equal(appendInkInput(release, points, options(1, { final: true })).length, 0);
});

test('sample fallback, pointer identity and limits protect incomplete strokes', () => {
  const event = { ...sample(1, 1), nativeEvent: { getCoalescedEvents: () => { throw new Error('unsupported'); } } };
  assert.deepEqual(inkPointerSamples(event), [event]);
  const points = [{ x: 0, y: 0, pressure: .5 }];
  const mixed = { ...sample(3, 0), nativeEvent: { getCoalescedEvents: () => [sample(2, 0, .6, 8)] } };
  assert.equal(appendInkInput(mixed, points, options(1, { maxPoints: 2 })).length, 1);
  assert.equal(points[1].x, 3 / 1600);
  assert.equal(appendInkInput(sample(4, 0), points, options(1, { maxPoints: 2 })).length, 0);
});
