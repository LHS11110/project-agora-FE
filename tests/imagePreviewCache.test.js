import test from 'node:test';
import assert from 'node:assert/strict';
import ImagePreviewCache from '../src/canvas/ImagePreviewCache.js';
import { overviewProxy, overviewScale } from '../src/canvas/sceneRepresentation.js';
const tick = () => new Promise(setImmediate);
test('image previews deduplicate requests and bound concurrent decode work', async () => {
  const pending = [], ready = [];
  const cache = new ImagePreviewCache(source => new Promise(resolve => pending.push({ source, resolve })), (source, ids) => ready.push([source, ids]), { concurrency: 2 });
  try {
    cache.request('same', 'a'); cache.request('same', 'b'); cache.request('other', 'c'); cache.request('last', 'd');
    await tick(); assert.equal(pending.length, 2); assert.equal(cache.active, 2);
    pending[0].resolve({ width: 40, height: 20 }); await tick();
    assert.deepEqual(ready[0], ['same', ['a', 'b']]); assert.equal(pending.length, 3);
    for (const entry of pending.slice(1)) entry.resolve({ width: 10, height: 10 }); await tick();
    assert.ok(cache.peek('same').version > 0);
  } finally { cache.destroy(); }
});
test('queued work cannot immediately evict a completed thumbnail before its render frame', async () => {
  const pending = [];
  const cache = new ImagePreviewCache(() => new Promise(resolve => pending.push(resolve)), () => {}, { concurrency: 1, maxEntries: 1, maxPixels: 400 });
  try {
    cache.request('a', 'a'); cache.request('b', 'b'); cache.request('c', 'c'); await tick();
    const a = { width: 10, height: 10 }; pending[0](a); await tick();
    assert.equal(cache.peek('a').canvas, a);
    const b = { width: 10, height: 10 }; pending[1](b); await tick();
    assert.equal(cache.peek('a'), undefined); assert.equal(a.width, 1); assert.equal(cache.peek('b').canvas, b);
    pending[2]({ width: 10, height: 10 }); await tick();
    assert.ok(cache.pixels <= 400);
  } finally { cache.destroy(); }
});
test('late image decode completion after layer cleanup releases its bitmap without publishing', async () => {
  let resolve, published = false;
  const cache = new ImagePreviewCache(() => new Promise(done => { resolve = done; }), () => { published = true; });
  cache.request('x', 'x'); await tick(); cache.destroy();
  const bitmap = { width: 96, height: 64 }; resolve(bitmap); await tick();
  assert.equal(bitmap.width, 1); assert.equal(published, false);
});
test('overview preserves actual text and image source, while subpixel images do not start downloads', () => {
  const world = { width: 1600, height: 1000 };
  const text = { kind: 'text', text: '# Actual heading', renderMode: 'markdown', width: .2, height: .1 };
  const preview = overviewProxy(text, world, .1);
  assert.equal(preview.kind, 'text'); assert.equal(preview.text, text.text); assert.equal(text.renderMode, 'markdown');
  const image = { kind: 'image', src: '/api/image.png', width: .2, height: .1, imageFrameEnabled: false };
  assert.equal(overviewProxy(image, world, .1).__imagePreview, image.src);
  assert.equal(overviewProxy(image, world, .001).__imagePreview, undefined);
  assert.equal(overviewScale(.1), overviewScale(.101));
  assert.notEqual(overviewScale(.1), overviewScale(.2));
});

test('thumbnail loader authenticates API images without leaking credentials to external or inline sources', async () => {
  const { loadImagePreview } = await import('../src/canvas/ImagePreviewCache.js');
  const names = ['fetch', 'document', 'createImageBitmap'], originals = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  const requests = []; let closed = 0;
  Object.assign(globalThis, {
    fetch: async (url, options) => { requests.push([url, options.headers]); return { ok: true, blob: async () => ({}) }; },
    createImageBitmap: async () => ({ width: 400, height: 200, close() { closed++; } }),
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }) }) },
  });
  try {
    const resolve = path => new URL(path, 'https://api.example.test').href;
    const canvas = await loadImagePreview('/api/image.png', 'private-account-token', resolve);
    assert.equal(canvas.width, 96); assert.equal(canvas.height, 48);
    await loadImagePreview('https://external.example.test/image.png', 'private-account-token', resolve);
    await loadImagePreview('data:image/png;base64,AA==', 'private-account-token', () => { throw Error('Inline images must not resolve API URLs'); });
    assert.deepEqual(requests.map(([, headers]) => headers), [{ Authorization: 'Bearer private-account-token' }, {}, {}]);
    assert.equal(closed, 3);
  } finally {
    names.forEach((name, i) => originals[i] ? Object.defineProperty(globalThis, name, originals[i]) : delete globalThis[name]);
  }
});

test('quantized previews remain selectable across representation thresholds', async () => {
  const { default: CanvasSpatialBTree } = await import('../src/components/CanvasSpatialBTree.js');
  const { hitTestVector } = await import('../src/canvas/vectorHitTest.js');
  const world = { width: 1600, height: 1000 }, scale = .105;
  const image = { kind: 'image', x: .1, y: .1, width: .2, height: .24, shadowEnabled: false };
  const index = new CanvasSpatialBTree({ image }, world);
  assert.equal(hitTestVector(index, { x: .15, y: .15 }, world, scale, new Map(), overviewScale(scale))?.id, 'image');
});

test('large inline image sources are not duplicated in raster resource keys', async () => {
  const { rasterDescriptor } = await import('../src/canvas/rasterObjectCache.js');
  const world = { width: 1600, height: 1000 };
  const item = overviewProxy({ kind: 'image', src: 'data:image/png;base64,' + 'A'.repeat(100000), width: .2, height: .1 }, world, .1);
  const first = rasterDescriptor('a', item, world, {}, 'image:0:1');
  assert.ok(first.key.length < 1000);
  assert.notEqual(first.key, rasterDescriptor('a', item, world, {}, 'image:0:2').key);
});
