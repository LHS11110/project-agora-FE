import test from 'node:test';
import assert from 'node:assert/strict';
import { WgpuSceneBatcher } from '../src/canvas/wgpu/WgpuSceneBatcher.js';
import WorkerGpuRenderer from '../src/canvas/wgpu/WorkerGpuRenderer.js';
import { RasterTextureAtlas } from '../src/canvas/textureAtlas.js';
import { createInkStrokeRenderer } from '../src/canvas/inkStrokeRenderer.js';

const tick = () => new Promise(setImmediate);

test('WgpuSceneBatcher encodes gpuOffset drag flag in bit 31 while preserving base coordinates and RGB tint', () => {
  const batcher = new WgpuSceneBatcher();
  let captured = null;
  const renderer = { update_scene(...args) { captured = args.map((arr) => arr.slice()); } };
  const makeRec = (id, x, tint) => ({
    id,
    resource: { textureHandle: { texId: 1, uvMinX: 0, uvMinY: 0, uvMaxX: 1, uvMaxY: 1 } },
    descriptor: { x, y: 20, centerX: 10, centerY: 10, rotation: 0 },
    raster: { left: 0, top: 0, width: 20, height: 20 },
    paintedBounds: { minX: x, minY: 20, maxX: x + 20, maxY: 40 },
    tint,
  });

  const ordered = [makeRec('a', 10, 0x123456), makeRec('b', 5000, null)];
  const count = batcher.sync(
    renderer,
    ordered,
    { ids: new Set(['b']), dx: 100, dy: 50, gpuOffset: true },
    { minX: 0, minY: 0, maxX: 500, maxY: 500 },
  );
  // Both kept: 'a' is in cull bounds, 'b' is dragged so culling is bypassed.
  assert.equal(count, 2);
  const floats = new Float32Array(captured[0].buffer);
  // 'a' is not dragged: bit 31 is 0, RGB preserved
  assert.equal(captured[0][11], 0x123456);
  // 'b' is dragged with gpuOffset: base x kept (5000 + 10 = 5010), bit 31 set, RGB 0xffffff preserved
  assert.equal(floats[12], 5010);
  assert.equal(captured[0][23], 0x80ffffff >>> 0);
});

test('WorkerGpuRenderer splits large upload bursts across frames and renders dragOffset changes during interactive mode', async () => {
  const prevWorker = globalThis.Worker;
  const prevBitmap = globalThis.createImageBitmap;
  WorkerGpuRenderer.resetSharedWorker();
  const frames = [];
  globalThis.Worker = class {
    postMessage(packet) { if (packet.type === 'frame') frames.push(packet); }
    terminate() {}
  };
  globalThis.createImageBitmap = async () => ({ width: 10, height: 10, close() {} });
  const canvas = { style: {} };
  const app = new WorkerGpuRenderer(canvas, 200, 100);
  app.context = { transferFromImageBitmap() {} };
  const makeDone = (version, dragOffset = { dx: 0, dy: 0 }) => ({
    version,
    camera: { x: 0, y: 0, scale: 1 },
    viewportWidth: 200,
    viewportHeight: 100,
    margin: 192,
    dragOffset,
    bitmap: { width: 584, height: 484, close() {} },
  });
  try {
    // Queue 12 uploads + scene: first packet takes 8 uploads (scene deferred), second takes 4 + scene.
    for (let i = 1; i <= 12; i++) app.upload_canvas_texture(i, { width: 10, height: 10 }, 10, 10);
    app.update_scene(new Uint32Array(12), new Uint32Array([1]), new Uint32Array([0]), new Uint32Array([1]));
    app.render_frame(0, 0, 1, 200, 100);
    await tick();
    assert.equal(frames.length, 1);
    assert.equal(frames[0].textures.length, 8);
    assert.equal(frames[0].scene, null);

    app.receive(makeDone(1));
    await tick();
    assert.equal(frames.length, 2);
    assert.equal(frames[1].textures.length, 4);
    assert.ok(frames[1].scene !== null);

    app.receive(makeDone(1));
    await tick();
    // Interactive dragOffset change must dispatch immediately even when reprojection covers the viewport.
    app.interactive = true;
    app.set_drag_offset(42, -18);
    app.render_frame(0, 0, 1, 200, 100);
    assert.equal(frames.length, 3);
    assert.deepEqual(frames[2].dragOffset, { dx: 42, dy: -18 });
  } finally {
    app.destroy();
    WorkerGpuRenderer.resetSharedWorker();
    globalThis.Worker = prevWorker;
    globalThis.createImageBitmap = prevBitmap;
  }
});

test('RasterTextureAtlas defaults to 2048px pages so large HiDPI rasters stay batched instead of standalone', () => {
  const atlas = new RasterTextureAtlas();
  atlas.direct = true;
  assert.equal(atlas.size, 2048);
  const handle = atlas.allocate({ width: 1200, height: 1200 });
  assert.ok(handle.page, '1200x1200 raster should fit inside default 2048 atlas page');
  assert.equal(atlas.standalone.size, 0);
  atlas.destroy();
});

test('inkStrokeRenderer spatial index renders only strokes intersecting the viewport on dense ink scenes', () => {
  const oldDocument = globalThis.document;
  const oldPath = globalThis.Path2D;
  let fillCalls = 0;
  globalThis.Path2D = class { moveTo() {} lineTo() {} quadraticCurveTo() {} closePath() {} rect() {} arc() {} };
  globalThis.document = {
    createElement() {
      const ctx = {
        transform: [1, 0, 0, 1, 0, 0],
        setTransform(...v) { this.transform = v; },
        getTransform() { return { a: this.transform[0], b: this.transform[1] }; },
        clearRect() {}, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
        drawImage() {},
        fill() { fillCalls++; },
        stroke() { fillCalls++; },
      };
      return { style: {}, width: 1, height: 1, getContext: () => ctx, remove() {} };
    },
  };
  try {
    const renderer = createInkStrokeRenderer({ insertBefore() {}, appendChild() {} }, {});
    const items = {};
    // 100 strokes: 5 near viewport (x ~ 0.1..0.2), 95 far offscreen (x ~ 5.0..15.0)
    for (let i = 0; i < 100; i++) {
      const baseX = i < 5 ? 0.1 + i * 0.02 : 5 + i * 0.1;
      items[`s${i}`] = {
        kind: 'stroke',
        brush: 'pen',
        complete: true,
        shadowEnabled: false,
        strokeWidth: 3,
        points: [{ x: baseX, y: 0.2 }, { x: baseX + 0.01, y: 0.22 }],
      };
    }
    renderer.render({
      items,
      previews: [],
      draft: null,
      width: 1600,
      height: 1000,
      viewportWidth: 800,
      viewportHeight: 600,
      camera: { x: 0, y: 0, scale: 1 },
      pixelRatio: 1,
      interactive: false,
    });
    assert.equal(fillCalls, 5, 'only the 5 strokes inside viewport should be painted');
    renderer.destroy();
  } finally {
    globalThis.document = oldDocument;
    globalThis.Path2D = oldPath;
  }
});
