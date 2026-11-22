import { MAX_CANVAS_SCALE } from './canvasSpace.js';

export const GRAPHICS_QUALITY_KEY = 'agora_canvas_graphics_quality';
export const UNIFIED_GRAPHICS_PROFILE = Object.freeze({
  label: '고화질 통합',
  description: '성능 구분 없이 항상 원본 해상도와 그림자 품질 유지',
  maxDpr: 4,
  rasterMultiplier: 1,
  // DPR 2 × the 1600% zoom limit. A cap of 4 left text and strokes sampled at 4x and
  // stretched another 4x at max zoom; large objects are clipped to the viewport
  // (DepthVectorLayer) so a high ratio does not inflate their textures.
  maxRasterRatio: 32,
  imagePreviewSize: 1024,
  // Per-object rasters still reach native DPR × zoom (maxRasterRatio); these caps
  // bound the total so dense scenes do not exhaust GPU memory.
  documentPixelBudget: 8_000_000,
  scenePixelBudget: 32_000_000,
});
export const GRAPHICS_PROFILES = Object.freeze({
  high: UNIFIED_GRAPHICS_PROFILE,
});

export function normalizeGraphicsQuality() {
  return 'high';
}

export function graphicsResolution(_quality, deviceRatio = 1) {
  return Math.min(Math.max(1, Number(deviceRatio) || 1), UNIFIED_GRAPHICS_PROFILE.maxDpr);
}

export function graphicsRasterRatio(_quality, scale = 1, deviceRatio = 1) {
  const dpr = graphicsResolution('high', deviceRatio);
  const numericScale = Number(scale);
  const effectiveScale = Number.isFinite(numericScale) && numericScale > 1 ? Math.min(MAX_CANVAS_SCALE, numericScale) : 1;
  return Math.min(UNIFIED_GRAPHICS_PROFILE.maxRasterRatio, Math.max(dpr, dpr * effectiveScale));
}

export function graphicsDocumentRatio(_quality, width, height, deviceRatio = 1) {
  const dpr = graphicsResolution('high', deviceRatio);
  return Math.min(
    Math.max(2, dpr),
    4096 / Math.max(1, width, height),
    Math.sqrt(UNIFIED_GRAPHICS_PROFILE.documentPixelBudget / Math.max(1, width * height))
  );
}

export function graphicsRasterItem(item) {
  return item;
}

export function graphicsLodScale(scale) {
  return scale;
}
