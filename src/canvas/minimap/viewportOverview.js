/** Keep the visible screen centered, with nearby space at a stable relative scale. */
export function viewportOverview(viewport, aspect = 1.6, overviewScale = 1.5) {
  const visibleWidth = viewport.maxX - viewport.minX;
  const visibleHeight = viewport.maxY - viewport.minY;
  const centerX = (viewport.minX + viewport.maxX) / 2;
  const centerY = (viewport.minY + viewport.maxY) / 2;
  const width = Math.max(visibleWidth, visibleHeight * aspect) * overviewScale;
  const height = width / aspect;
  return { minX: centerX - width / 2, minY: centerY - height / 2, maxX: centerX + width / 2, maxY: centerY + height / 2, width, height };
}
