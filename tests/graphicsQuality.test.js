import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UNIFIED_GRAPHICS_PROFILE,
  GRAPHICS_PROFILES,
  normalizeGraphicsQuality,
  graphicsResolution,
  graphicsRasterRatio,
  graphicsDocumentRatio,
  graphicsRasterItem,
  graphicsLodScale,
} from '../src/canvas/graphicsQuality.js';

test('graphics uses unified high-clarity profile without low/medium tier degradation', () => {
  assert.deepEqual(Object.keys(GRAPHICS_PROFILES), ['high']);
  assert.equal(normalizeGraphicsQuality(null), 'high');
  assert.equal(normalizeGraphicsQuality('low'), 'high');
  assert.equal(normalizeGraphicsQuality('medium'), 'high');
  assert.equal(normalizeGraphicsQuality('toString'), 'high');
  assert.equal(graphicsResolution('low', 2), 2);
  assert.equal(graphicsResolution('high', 3), 3);
  assert.equal(graphicsResolution('high', 6), UNIFIED_GRAPHICS_PROFILE.maxDpr);
});

test('raster resolution never degrades below native DPR when zoomed out and scales cleanly on zoom-in', () => {
  assert.equal(graphicsRasterRatio('high', 1, 1), 1);
  assert.equal(graphicsRasterRatio('high', 1, 2), 2);
  assert.equal(graphicsRasterRatio('low', 0.25, 2), 2);
  assert.equal(graphicsRasterRatio('high', 0.1, 1), 1);
  assert.equal(graphicsRasterRatio('high', 2, 1.5), 3);
  assert.ok(graphicsRasterRatio('high', 100, 4) <= UNIFIED_GRAPHICS_PROFILE.maxRasterRatio);
  // Max zoom (1600%) samples text and strokes at native resolution instead of stretching a 4x raster.
  assert.equal(graphicsRasterRatio('high', 16, 1), 16);
  assert.equal(graphicsRasterRatio('high', 16, 2), 32);
  assert.equal(graphicsLodScale(1.5, 5000, 'low'), 1.5);
});

test('document canvases and raster items preserve full resolution, image previews, and shadows', () => {
  assert.equal(graphicsDocumentRatio('high', 152, 202, 1), 2);
  const ratio = graphicsDocumentRatio('high', 600, 800, 2);
  assert.equal(ratio, 2);
  const large = graphicsDocumentRatio('high', 10000, 10000, 4);
  assert.ok(10000 * 10000 * large * large <= UNIFIED_GRAPHICS_PROFILE.documentPixelBudget + 1);
  assert.ok(UNIFIED_GRAPHICS_PROFILE.imagePreviewSize >= 1024);
  const source = { kind: 'shape', shadowEnabled: true, shadowBlur: 8 };
  assert.equal(graphicsRasterItem(source, 'low'), source);
  assert.equal(source.shadowEnabled, true);
});
