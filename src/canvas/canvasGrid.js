import './canvas-grid.css';

/** Keep dots legible when zoomed out and anchored to world coordinate (0, 0). */
export function canvasGridStyle(camera) {
  const scale = Number.isFinite(camera?.scale) && camera.scale > 0 ? camera.scale : 1;
  // Logarithmic spacing avoids overflowing world steps at tiny zoom levels.
  const baseLog = Math.log2(20) + Math.log2(scale);
  const step = Math.ceil(Math.log2(12) - baseLog);
  const spacing = 2 ** (baseLog + step);
  const offset = value => ((Number(value) || 0) % spacing) - spacing / 2;
  return {
    '--grid-size': `${spacing}px`,
    '--grid-dot-radius': '1px',
    '--grid-position-x': `${offset(camera?.x)}px`,
    '--grid-position-y': `${offset(camera?.y)}px`,
  };
}
