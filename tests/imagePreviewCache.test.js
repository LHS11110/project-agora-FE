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
    assert.deepEqual(requests.map(([, headers]) => headers), [{ Authorization: 'Bearer private-account-token' }, {}]);
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

test('shared authenticated image cache retains media across unmount/remount, prefetches once, and revokes mutable covers on release', async () => {
  const names = ['fetch', 'URL', 'window'];
  const originals = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
  let calls = 0, nextId = 0;
  const revoked = [];
  Object.assign(globalThis, {
    window: { location: { href: 'https://app.example.test/canvases/10' } },
    URL: class MockUrl extends URL {
      static createObjectURL(blob) { return `blob:mock-${++nextId}-${blob.size}`; }
      static revokeObjectURL(url) { revoked.push(url); }
    },
    fetch: async (url) => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        blob: async () => new Blob([`img-${url}`], { type: 'image/png' }),
      };
    },
  });
  try {
    const cacheMod = await import('../src/components/authenticatedImageCache.js');
    assert.equal(cacheMod.prefetchAuthenticatedImage('/api/canvases/10/media/abc.png', 'tok-1'), true);
    assert.equal(cacheMod.prefetchAuthenticatedImage('/api/canvases/10/media/abc.png', 'tok-1'), false);
    await new Promise((r) => setTimeout(r, 20));
    const entry = await cacheMod.acquireAuthenticatedImage('/api/canvases/10/media/abc.png', 'tok-1');
    assert.ok(entry?.src.startsWith('blob:mock-'));
    assert.equal(calls, 1, 'prefetched media is reused without a second fetch');
    cacheMod.releaseAuthenticatedImage(entry);
    assert.equal(revoked.includes(entry.src), false, 'retained media objectUrl survives unmount for instant pan-back');
    assert.ok(cacheMod.peekAuthenticatedImage('/api/canvases/10/media/abc.png', 'tok-1'));

    // Mutable cover image should NOT be prefetched or retained after release
    assert.equal(cacheMod.prefetchAuthenticatedImage('/api/canvases/10/image', 'tok-1'), false);
    const cover = await cacheMod.acquireAuthenticatedImage('/api/canvases/10/image', 'tok-1');
    cacheMod.releaseAuthenticatedImage(cover);
    assert.equal(revoked.includes(cover.src), true, 'mutable canvas cover is revoked on release');
    cacheMod.invalidateAuthenticatedImage('/api/canvases/10/media/abc.png', 'tok-1');
  } finally {
    names.forEach((name, i) => (originals[i] ? Object.defineProperty(globalThis, name, originals[i]) : delete globalThis[name]));
  }
});

test('viewport prefetch drains the entire batch at three transfers, shares raster bytes, and cancels stale queued windows', async()=>{
 const names=['window','URL','fetch'],originals=names.map(name=>Object.getOwnPropertyDescriptor(globalThis,name));
 const pending=[],fetched=[];let active=0,maxActive=0;
 const NativeURL=globalThis.URL;
 Object.assign(globalThis,{window:{location:{href:'https://preload.example.test/'}},URL:class extends NativeURL{static createObjectURL(){return 'blob:prefetch';}static revokeObjectURL(){}},fetch:(url)=>{fetched.push(url);active++;maxActive=Math.max(maxActive,active);return new Promise(resolve=>pending.push(()=>{active--;resolve({ok:true,status:200,headers:new Headers({'content-type':'image/png'}),blob:async()=>new Blob(['image'],{type:'image/png'})});}));}});
 try{
  const cache=await import('../src/components/authenticatedImageCache.js');
  const sources=Array.from({length:8},(_,i)=>`/api/canvases/72/media/warm-${i}.png`);
  cache.prefetchAuthenticatedImages(sources,'prefetch-test');assert.equal(pending.length,3);
  const shared=cache.sharedAuthenticatedImageBlob(sources[0],'prefetch-test');assert.equal(pending.length,3);
  while(pending.length){pending.shift()();await tick();}await shared;
  assert.equal(fetched.length,8);assert.equal(maxActive,3);
  assert.ok(await cache.sharedAuthenticatedImageBlob(sources[0],'prefetch-test'));assert.equal(fetched.length,8);
  const controller=new AbortController();cache.prefetchAuthenticatedImages(sources.map(x=>x.replace('warm','stale')),'prefetch-test',{signal:controller.signal});controller.abort();
  while(pending.length){pending.shift()();await tick();}assert.equal(fetched.length,11);
 }finally{names.forEach((name,i)=>originals[i]?Object.defineProperty(globalThis,name,originals[i]):delete globalThis[name]);}
});

test('newly visible previews overtake queued offscreen decodes without duplicating requests',async()=>{
 const pending=[],started=[];const cache=new ImagePreviewCache(source=>{started.push(source);return new Promise(resolve=>pending.push(resolve));},()=>{},{concurrency:1});
 try{cache.request('first','1');cache.request('offscreen','2');cache.request('visible','3');cache.request('visible','3',true);await tick();
 pending.shift()({width:10,height:10});await tick();assert.deepEqual(started,['first','visible']);
 pending.shift()({width:10,height:10});await tick();assert.deepEqual(started,['first','visible','offscreen']);
 pending.shift()({width:10,height:10});await tick();assert.equal(cache.queued,0);
 }finally{cache.destroy();}
});
