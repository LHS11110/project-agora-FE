/** Persistent coordinates are normalized against this fixed world, never the browser viewport. */
export const CANVAS_SPACE = Object.freeze({ width: 1600, height: 1000 });

export function canvasPointAtPointer(event, viewport, camera, space = CANVAS_SPACE) {
  return {
    x: (event.clientX - viewport.left - camera.x) / (space.width * camera.scale),
    y: (event.clientY - viewport.top - camera.y) / (space.height * camera.scale),
  };
}

export function fitCanvasCamera(viewport, space = CANVAS_SPACE) {
  const scale = Math.min(1, Math.max(1, viewport.width) / space.width, Math.max(1, viewport.height) / space.height);
  return {
    scale,
    x: (viewport.width - space.width * scale) / 2,
    y: (viewport.height - space.height * scale) / 2,
  };
}

/** No product zoom limits; reject only values that cannot form finite coordinates. */
export function zoomCanvasCamera(current, factor, anchor, viewport) {
  const scale = current.scale * factor;
  if (!(scale > 0) || !Number.isFinite(scale)) return current;
  const ratio = scale / current.scale;
  const x = anchor.x - (anchor.x - current.x) * ratio;
  const y = anchor.y - (anchor.y - current.y) * ratio;
  const coordinates = [x, y, -x / scale, -y / scale,
    (viewport.width - x) / scale, (viewport.height - y) / scale];
  if (!coordinates.every(Number.isFinite)) return current;
  return { scale, x, y };
}

export function formatCanvasZoom(scale) {
  const percent = scale * 100;
  if (percent >= 1 && percent < 100000) return `${Number(percent.toFixed(2))}%`;
  if (Number.isFinite(percent) && percent > 0) return `${percent.toExponential(2)}%`;
  return `${scale.toExponential(2)}×`;
}
