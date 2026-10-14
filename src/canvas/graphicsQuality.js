export const GRAPHICS_QUALITY_KEY = 'agora_canvas_graphics_quality';
export const GRAPHICS_PROFILES = Object.freeze({
  low: Object.freeze({ label: '낮음', description: '속도 우선 · 대량 객체에 권장', maxDpr: 1, rasterMultiplier: 1, maxRasterRatio: 1.5, scenePixelBudget: 8_000_000 }),
  medium: Object.freeze({ label: '보통', description: '속도와 선명도의 균형', maxDpr: 1.5, rasterMultiplier: 1.5, maxRasterRatio: 2, scenePixelBudget: 16_000_000 }),
  high: Object.freeze({ label: '높음', description: '선명도 우선 · GPU와 메모리 사용 증가', maxDpr: 2, rasterMultiplier: 2, maxRasterRatio: 3, scenePixelBudget: 32_000_000 }),
});
export function normalizeGraphicsQuality(value) {
  return Object.hasOwn(GRAPHICS_PROFILES, value) ? value : 'low';
}
export function graphicsResolution(quality, deviceRatio = 1) {
  return Math.min(Math.max(1, Number(deviceRatio) || 1), GRAPHICS_PROFILES[normalizeGraphicsQuality(quality)].maxDpr);
}
export function graphicsRasterRatio(quality, scale, deviceRatio = 1) {
  const profile = GRAPHICS_PROFILES[normalizeGraphicsQuality(quality)];
  const zoomRatio = scale > 1.25 ? 1.5 : scale < .5 ? .5 : 1;
  return Math.min(profile.maxRasterRatio, zoomRatio * profile.rasterMultiplier * graphicsResolution(quality, deviceRatio));
}
