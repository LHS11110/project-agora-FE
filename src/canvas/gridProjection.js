// Display rule of the original stage grid: dots every 20 world px (or the snap
// interval's nearest multiple), doubled only while they would sit closer than 12
// screen px. Spacing therefore grows with zoom (20px at 100%, 320px at 1600%); a
// constant 28-56px band derived from the 1px snap interval read as a dense mesh.
const DISPLAY_WORLD_STEP = 20;
const MIN_VISIBLE_SPACING = 12;
// Up to this spacing the pre-painted surface is translated on the compositor;
// wider grids repaint with a background offset instead of growing the surface.
const MAX_TRANSLATED_SPACING = 512;

function phase(offset, spacing) {
  const remainder = (Number(offset) || 0) % spacing;
  const centered = (remainder < 0 ? remainder + spacing : remainder) - spacing / 2;
  return centered > 0 ? centered - spacing : centered;
}

export function gridProjection(camera, interval) {
  const scale = Number.isFinite(camera?.scale) && camera.scale > 0 ? camera.scale : 1;
  const projected = value => {
    const base = Number(value);
    const snap = Number.isFinite(base) && base > 0 ? base : DISPLAY_WORLD_STEP;
    // Keep dots on snap positions: the display step is a whole multiple of the interval.
    let spacing = snap * Math.max(1, Math.ceil(DISPLAY_WORLD_STEP / snap - 1e-9)) * scale;
    while (spacing < MIN_VISIBLE_SPACING) spacing *= 2;
    return spacing;
  };
  const separate = interval && typeof interval === 'object';
  const spacingX = projected(separate ? interval.x : interval);
  const spacingY = projected(separate ? interval.y : interval);
  const x = phase(camera?.x, spacingX);
  const y = phase(camera?.y, spacingY);
  const paintsOffset = Math.max(spacingX, spacingY) > MAX_TRANSLATED_SPACING;
  return {
    spacing: spacingX,
    spacingX,
    spacingY,
    x,
    y,
    paintsOffset,
    transform: paintsOffset ? 'none' : `translate3d(${x}px,${y}px,0)`,
    backgroundPosition: paintsOffset ? `${x}px ${y}px` : '0px 0px',
  };
}

export function applyGridProjection(grid, projection) {
  grid.style.backgroundSize = `${projection.spacingX}px ${projection.spacingY}px`;
  grid.style.transform = projection.transform;
  grid.style.backgroundPosition = projection.backgroundPosition;
  // The surface is shifted by up to one period, so it must extend one period past the
  // stage. The extension is rounded up to a power of two: spacing changes on every zoom
  // frame, and resizing the surface each frame added a layout per frame.
  const pad = spacing => 2 ** Math.max(5, Math.ceil(Math.log2(spacing)));
  const width = projection.paintsOffset ? '100%' : `calc(100% + ${pad(projection.spacingX)}px)`;
  const height = projection.paintsOffset ? '100%' : `calc(100% + ${pad(projection.spacingY)}px)`;
  if (grid.style.width !== width) grid.style.width = width;
  if (grid.style.height !== height) grid.style.height = height;
}
