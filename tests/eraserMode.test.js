import test from 'node:test';
import assert from 'node:assert/strict';
import { eraseStrokeWithEraser } from '../src/components/strokeGeometry.js';

const size = { width: 1000, height: 1000 };
const line = { kind: 'stroke', strokeWidth: 4, points: [{ x: .1, y: .2, pressure: .3 }, { x: .9, y: .2, pressure: .8 }] };
const point = (x, y) => ({ x, y });

test('partial mode keeps both ends and whole-stroke mode deletes the same touched line', () => {
  const at = point(.5, .2);
  const fragments = eraseStrokeWithEraser(line, at, at, size, 1, 12);
  assert.equal(fragments.length, 2);
  assert.deepEqual(fragments[0][0], line.points[0]);
  assert.deepEqual(fragments[1].at(-1), line.points.at(-1));
  assert.ok(fragments[0].at(-1).x < .5 && fragments[1][0].x > .5);
  assert.ok(fragments[0].at(-1).pressure > .3 && fragments[0].at(-1).pressure < .8);
  assert.deepEqual(eraseStrokeWithEraser(line, at, at, size, 1, 12, 'stroke'), []);
  assert.equal(eraseStrokeWithEraser(line, point(.5, .4), point(.5, .4), size, 1, 12, 'stroke'), null);
  assert.equal(line.points.length, 2, 'the source stroke must remain unchanged');
});

test('whole-stroke erasing detects a swept crossing and respects zoom, brush width and rotation', () => {
  const sweep = [point(.5, .1), point(.5, .3)];
  assert.deepEqual(eraseStrokeWithEraser(line, ...sweep, size, 2, 6, 'stroke'), []);
  const rotated = { ...line, rotation: 90 };
  assert.deepEqual(eraseStrokeWithEraser(rotated, point(.5, .4), point(.5, .4), size, 1, 5, 'stroke'), []);
  assert.equal(eraseStrokeWithEraser(rotated, point(.2, .2), point(.2, .2), size, 1, 5, 'stroke'), null);
  const wide = { ...line, brush: 'highlighter', strokeWidth: 20 };
  assert.deepEqual(eraseStrokeWithEraser(wide, point(.5, .229), point(.5, .229), size, 1, 4, 'stroke'), []);
  assert.equal(eraseStrokeWithEraser(wide, point(.5, .24), point(.5, .24), size, 1, 4, 'stroke'), null);
});

test('both modes erase a touched dot and leave unrelated or empty strokes alone', () => {
  const dot = { kind: 'stroke', points: [point(.3, .4)] };
  for (const mode of ['partial', 'stroke']) {
    assert.deepEqual(eraseStrokeWithEraser(dot, point(.3, .4), point(.3, .4), size, 1, 12, mode), []);
    assert.equal(eraseStrokeWithEraser(dot, point(.4, .4), point(.4, .4), size, 1, 12, mode), null);
    assert.equal(eraseStrokeWithEraser({ points: [] }, point(.3, .4), point(.3, .4), size, 1, 12, mode), null);
  }
});

test('whole and partial modes agree about hits for varied swept gestures', () => {
  let seed = 82391;
  const random = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 300; i += 1) {
    const stroke = { kind: 'stroke', strokeWidth: 3 + random() * 25, rotation: random() * 360,
      points: Array.from({ length: 4 }, () => point(random(), random())) };
    const from = point(random(), random()), to = point(random(), random());
    const partial = eraseStrokeWithEraser(stroke, from, to, size, 1, 12, 'partial');
    const whole = eraseStrokeWithEraser(stroke, from, to, size, 1, 12, 'stroke');
    assert.equal(whole === null, partial === null, `case ${i}`);
  }
});
