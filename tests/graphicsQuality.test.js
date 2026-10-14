import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAPHICS_PROFILES, normalizeGraphicsQuality, graphicsResolution, graphicsRasterRatio } from '../src/canvas/graphicsQuality.js';

test('graphics defaults to fastest profile and caps high-DPI surface allocation', () => {
  assert.equal(normalizeGraphicsQuality(null), 'low');
  assert.equal(normalizeGraphicsQuality('invalid'), 'low');
  assert.equal(normalizeGraphicsQuality('toString'), 'low');
  assert.equal(graphicsResolution('low', 3), 1);
  assert.equal(graphicsResolution('medium', 3), 1.5);
  assert.equal(graphicsResolution('high', 3), 2);
});

test('higher graphics quality increases detail even on a standard-DPI screen while bounding work', () => {
  assert.equal(graphicsRasterRatio('low', 1, 1), 1);
  assert.equal(graphicsRasterRatio('medium', 1, 1), 1.5);
  assert.equal(graphicsRasterRatio('high', 1, 1), 2);
  for (const quality of Object.keys(GRAPHICS_PROFILES)) {
    assert.ok(graphicsRasterRatio(quality, 100, 4) <= GRAPHICS_PROFILES[quality].maxRasterRatio);
    assert.ok(graphicsRasterRatio(quality, .25, 1) < graphicsRasterRatio(quality, 1, 1));
  }
  assert.ok(GRAPHICS_PROFILES.low.scenePixelBudget < GRAPHICS_PROFILES.medium.scenePixelBudget);
  assert.ok(GRAPHICS_PROFILES.medium.scenePixelBudget < GRAPHICS_PROFILES.high.scenePixelBudget);
});
