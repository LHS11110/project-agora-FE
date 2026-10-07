import './canvas-grid.css';

/** Keep dots legible when zoomed out and anchored to world coordinate (0, 0). */
export function canvasGridStyle(camera) {
  const scale = Number.isFinite(camera?.scale) && camera.scale > 0 ? camera.scale : 1;
  let worldStep = 20;
  while (worldStep * scale < 12) worldStep *= 2;
  const spacing = worldStep * scale;
  const offset = value => ((Number(value) || 0) % spacing) - spacing / 2;
  return {
    '--grid-size': `${spacing}px`,
    '--grid-dot-radius': '1px',
    '--grid-position-x': `${offset(camera?.x)}px`,
    '--grid-position-y': `${offset(camera?.y)}px`,
  };
}
