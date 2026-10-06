/** Persistent coordinates are normalized against this fixed world, never the browser viewport. */
export const CANVAS_SPACE = Object.freeze({ width: 1600, height: 1000 });
export const MIN_CANVAS_ZOOM = 0.1;
export const MAX_CANVAS_ZOOM = 4;

export function canvasPointAtPointer(event, viewport, camera, space = CANVAS_SPACE) {
  return {
    x: (event.clientX - viewport.left - camera.x) / (space.width * camera.scale),
    y: (event.clientY - viewport.top - camera.y) / (space.height * camera.scale),
  };
}

export function fitCanvasCamera(viewport, space = CANVAS_SPACE) {
  const scale = Math.max(MIN_CANVAS_ZOOM, Math.min(1, viewport.width / space.width, viewport.height / space.height));
  return {
    scale,
    x: (viewport.width - space.width * scale) / 2,
    y: (viewport.height - space.height * scale) / 2,
  };
}
