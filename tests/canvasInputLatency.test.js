import test from 'node:test';
import assert from 'node:assert/strict';
import { predictInkTip, recordInkMotion } from '../src/canvas/inkInput.js';
import RawInkQueue from '../src/canvas/RawInkQueue.js';
import { createInkStrokeRenderer } from '../src/canvas/inkStrokeRenderer.js';
import { itemSnapshot, changeItems } from '../src/canvas/itemSnapshots.js';
import { RasterTextureAtlas } from '../src/canvas/textureAtlas.js';

const motion = (samples) => {
  const history = [];
  for (const [x, y, t] of samples) recordInkMotion(history, { clientX: x, clientY: y, timeStamp: t });
  return history;
};

test('tip prediction extrapolates recent velocity, is bounded, and stops when the pointer is still', () => {
  const moving = motion([[0, 0, 0], [8, 0, 8], [16, 0, 16]]);
  const [tip] = predictInkTip({}, moving);
  assert.ok(tip.clientX > 16 && tip.clientX <= 16 + 36, `predicted ${tip.clientX}`);
  assert.equal(tip.clientY, 0);

  const fast = motion([[0, 0, 0], [400, 0, 4]]);
  const [far] = predictInkTip({}, fast);
  assert.ok(Math.abs(far.clientX - 400 - 36) < 1e-9, 'prediction distance is capped');

  assert.deepEqual(predictInkTip({}, motion([[5, 5, 0], [5.01, 5, 30]])), [], 'slow hand gets no overshoot');
  assert.deepEqual(predictInkTip({}, motion([[0, 0, 0], [10, 0, 200]])), [], 'stale samples are not extrapolated');
});

test('native predicted events take precedence and are clamped to the same bound', () => {
  const history = motion([[0, 0, 0], [10, 0, 8]]);
  const event = { getPredictedEvents: () => [{ clientX: 14, clientY: 3 }, { clientX: 300, clientY: 0 }] };
  const predicted = predictInkTip(event, history);
  assert.equal(predicted.length, 2);
  assert.deepEqual([predicted[0].clientX, predicted[0].clientY], [14, 3]);
  assert.ok(Math.abs(predicted[1].clientX - 46) < 1e-9);
});

test('raw ink batches expose only the newest dispatch predictions', () => {
  const delivered = [];
  const queue = new RawInkQueue(event => delivered.push(event), fn => fn, () => {});
  queue.push({ pointerId: 1, clientX: 1, clientY: 0, getPredictedEvents: () => [{ clientX: 2, clientY: 0 }] });
  queue.push({ pointerId: 1, clientX: 3, clientY: 0, getPredictedEvents: () => [{ clientX: 5, clientY: 1 }] });
  queue.flush();
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].getCoalescedEvents().length, 2);
  assert.deepEqual(delivered[0].getPredictedEvents().map(p => [p.clientX, p.clientY]), [[5, 1]]);
  queue.push({ pointerId: 1, clientX: 6, clientY: 0 });
  queue.flush();
  assert.deepEqual(delivered[1].getPredictedEvents(), []);
});

function withCanvasMocks(run) {
  const oldDocument = globalThis.document, oldPath = globalThis.Path2D, canvases = [];
  globalThis.Path2D = class { constructor() { this.points = 0; } moveTo() { this.points++; } lineTo() { this.points++; } arc() { this.points++; } };
  globalThis.document = { createElement() {
    const context = {
      transform: [1, 0, 0, 1, 0, 0], clears: [], strokes: [], clips: [],
      setTransform(...value) { this.transform = value; },
      clearRect(...rect) { this.clears.push({ transform: [...this.transform], rect }); },
      save() {}, restore() {}, beginPath() {}, rect(...r) { this.clips.push(r); }, clip() {}, translate() {}, rotate() {}, strokeRect() {}, fill() {},
      getTransform() { return { a: this.transform[0], b: this.transform[1] }; },
      stroke(path) { this.strokes.push(path.points); },
    };
    const canvas = { style: {}, width: 300, height: 150, getContext: () => context, remove() {}, context };
    canvases.push(canvas); return canvas;
  } };
  try { return run(canvases); } finally { globalThis.document = oldDocument; globalThis.Path2D = oldPath; }
}

const base = { previews: [], width: 1000, height: 1000, viewportWidth: 400, viewportHeight: 300, camera: { x: 0, y: 0, scale: 1 }, pixelRatio: 1 };

test('continuing drafts clear only the previously painted pixels and include the predicted tip', () => withCanvasMocks(canvases => {
  const renderer = createInkStrokeRenderer({ insertBefore() {}, appendChild() {} }, {}), live = canvases[1];
  const draft = { id: 'd', points: [{ x: .01, y: .01 }, { x: .02, y: .02 }], strokeWidth: 2, shadowEnabled: false };
  renderer.render({ ...base, items: {}, draft });
  assert.deepEqual(live.context.clears.at(-1).rect, [0, 0, 400, 300], 'first frame clears the surface');
  assert.equal(renderer.paintDraft({ ...draft, points: [...draft.points, { x: .03, y: .03 }], predicted: [{ x: .05, y: .05 }] }), true);
  const [, , w, h] = live.context.clears.at(-1).rect;
  assert.ok(w < 100 && h < 100, `dirty clear ${w}x${h} instead of full surface`);
  assert.equal(live.context.strokes.at(-1), 4, 'three stored samples plus one predicted sample were drawn');
  renderer.renderDraft(null);
  assert.deepEqual(live.context.clears.at(-1).rect, [0, 0, 400, 300], 'finishing clears the whole surface');
  renderer.destroy();
  assert.equal(live.width, 1, 'destroy releases the backing store');
}));

test('saved ink repaints only damaged strokes; in-progress saves of the hidden draft repaint nothing', () => withCanvasMocks(canvases => {
  const renderer = createInkStrokeRenderer({ insertBefore() {}, appendChild() {} }, {}), saved = canvases[0];
  const line = (x) => ({ kind: 'stroke', points: [{ x, y: .05 }, { x: x + .01, y: .06 }], strokeWidth: 2, shadowEnabled: false });
  let items = itemSnapshot({ a: line(.02), b: line(.2) });
  const draft = { id: 'draft', points: [{ x: .1, y: .1 }, { x: .11, y: .11 }], strokeWidth: 2 };
  renderer.render({ ...base, items, draft });
  const fullClears = saved.context.clears.length, fullStrokes = saved.context.strokes.length;
  assert.equal(fullStrokes, 2);

  items = changeItems(items, { draft: { ...line(.1), complete: false } });
  renderer.render({ ...base, items, draft });
  items = changeItems(items, { draft: { ...line(.1), points: [...line(.1).points, { x: .12, y: .07 }], complete: false } });
  renderer.render({ ...base, items, draft });
  assert.equal(saved.context.clears.length, fullClears, 'hidden in-progress stroke updates leave the saved surface untouched');
  assert.equal(saved.context.strokes.length, fullStrokes);

  items = changeItems(items, { draft: { ...line(.1), complete: true } });
  renderer.render({ ...base, items, draft: null });
  const clear = saved.context.clears.at(-1).rect;
  assert.ok(clear[2] < saved.width / 2 && clear[3] < saved.height / 2, `completed stroke repaints a clipped region (${clear})`);
  assert.equal(saved.context.strokes.length, fullStrokes + 1, 'only the stroke inside the damage is drawn');

  renderer.render({ ...base, items: itemSnapshot({}), draft: null });
  assert.equal(saved.style.display, 'none');
  assert.equal(saved.width, 1, 'an empty saved surface releases its backing store');
  renderer.destroy();
}));

test('texture atlas returns emptied pages beyond the first to the GPU and the canvas pool', () => {
  const old = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ clearRect() {}, drawImage() {} }) }) };
  try {
    const atlas = new RasterTextureAtlas(64, 4), removed = [];
    const renderer = { upload_canvas_texture: () => true, remove_texture: id => removed.push(id) };
    const a = atlas.allocate({ width: 56, height: 56 }), b = atlas.allocate({ width: 56, height: 56 });
    assert.notEqual(a.texId, b.texId);
    atlas.flush(renderer);
    atlas.release(b);
    assert.equal(atlas.pages.length, 1);
    assert.equal(b.page.canvas.width, 1);
    atlas.flush(renderer);
    assert.deepEqual(removed, [b.texId]);
    atlas.release(a);
    assert.equal(atlas.pages.length, 1, 'one empty page stays warm');
  } finally { globalThis.document = old; }
});

test('incrementally derived stroke lists match the snapshot after erasing, splitting and adding', () => withCanvasMocks(() => {
  const renderer = createInkStrokeRenderer({ insertBefore() {}, appendChild() {} }, {});
  const line = (x) => ({ kind: 'stroke', points: [{ x, y: .05 }, { x: x + .01, y: .06 }], strokeWidth: 2, shadowEnabled: false });
  const initial = {}; for (let i = 0; i < 40; i++) initial['s' + i] = line(i / 50);
  let items = itemSnapshot(initial);
  assert.equal(renderer.render({ ...base, items, draft: null }), 40);
  for (let step = 0; step < 30; step++) {
    const removed = [`s${step}`], changes = { [`f${step}`]: line(.5 + step / 100) };
    if (step % 3 === 0) changes[`s${39 - step}`] = { ...line(.9), shadowEnabled: false };
    if (step % 4 === 0) changes[`note${step}`] = { kind: 'text', text: 'not ink' };
    items = changeItems(items, changes, removed);
    const expected = Object.keys(items).filter(id => items[id]?.kind === 'stroke').length;
    assert.equal(renderer.render({ ...base, items, draft: null }), expected, `step ${step}`);
  }
  renderer.destroy();
}));

test('dragging strokes paints them once on an overlay and keeps the retained surface size', () => withCanvasMocks(canvases => {
  let requested = 0;
  const renderer = createInkStrokeRenderer({ insertBefore() {}, appendChild() {} }, {}, { requestRender: () => requested++ });
  const [saved, , drag] = canvases;
  const line = (x) => ({ kind: 'stroke', points: [{ x, y: .05 }, { x: x + .01, y: .06 }], strokeWidth: 2, shadowEnabled: false });
  const initial = {}; for (let i = 0; i < 30; i++) initial['s' + i] = line(i / 40);
  const items = itemSnapshot(initial);
  renderer.render({ ...base, items, draft: null });
  const size = [saved.width, saved.height], strokesBefore = saved.context.strokes.length;
  const ids = new Set(['s1', 's2']);
  for (let i = 1; i <= 20; i++) renderer.render({ ...base, items, draft: null, dragPreview: { ids, dx: i * .001, dy: 0 } });
  assert.deepEqual([saved.width, saved.height], size, 'retained surface is not reallocated for a drag');
  assert.ok(saved.context.strokes.length - strokesBefore < 30, 'the drag start removes the dragged strokes with a clipped repaint only');
  assert.equal(drag.context.strokes.length, 2, 'dragged strokes are painted once, then moved by transform');
  assert.match(drag.style.transform, /translate3d/);
  // Release: the overlay stays until the moved items arrive, so nothing flashes back.
  renderer.render({ ...base, items, draft: null, dragPreview: null });
  assert.equal(drag.style.display, '');
  const moved = changeItems(items, { s1: line(.5), s2: line(.6) });
  renderer.render({ ...base, items: moved, draft: null, dragPreview: null });
  assert.equal(drag.style.display, 'none');
  assert.equal(drag.width, 1, 'overlay backing store released');
  renderer.destroy();
}));
