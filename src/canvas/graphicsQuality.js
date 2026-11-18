export const GRAPHICS_QUALITY_KEY = 'agora_canvas_graphics_quality';
export const UNIFIED_GRAPHICS_PROFILE = Object.freeze({
  label: '고화질 통합',
  description: '성능 구분 없이 항상 원본 해상도와 그림자 품질 유지',
  maxDpr: 4,
  rasterMultiplier: 1,
  maxRasterRatio: 4,
  imagePreviewSize: 1024,
  documentPixelBudget: 16_000_000,
  scenePixelBudget: 64_000_000,
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
  const effectiveScale = Number.isFinite(numericScale) && numericScale > 1 ? Math.min(4, numericScale) : 1;
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
