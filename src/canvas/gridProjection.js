const TILE_SIZE = 24;
const COARSE_SPACING = 96;
// Keep the compositor surface bounded even for custom intervals spanning many screens.
const MAX_TRANSLATED_SPACING = 512;

function phase(offset, spacing) {
  const remainder = (Number(offset) || 0) % spacing;
  return (remainder < 0 ? remainder + spacing : remainder) - spacing / 2;
}

export function gridProjection(camera, interval) {
  const scale = Number.isFinite(camera?.scale) && camera.scale > 0 ? camera.scale : 1;
  const projected = value => {
    const base = Number(value);
    const baseLog = Math.log2(Number.isFinite(base) && base > 0 ? base : 20) + Math.log2(scale);
    const band = Math.ceil(Math.log2(12) - baseLog);
    return 2 ** (baseLog + (interval === undefined ? band : Math.max(0, band)));
  };
  const separate = interval && typeof interval === 'object';
  const spacingX = projected(separate ? interval.x : interval);
  const spacingY = projected(separate ? interval.y : interval);
  const x = phase(camera?.x, spacingX);
  const y = phase(camera?.y, spacingY);
  const maxSpacing = Math.max(spacingX, spacingY);
  const coarse = maxSpacing > COARSE_SPACING;
  const paintsOffset = maxSpacing > MAX_TRANSLATED_SPACING;
  let transform;
  if (paintsOffset) transform = 'translate3d(-48px,-48px,0)';
  else if (coarse) transform = `translate3d(${x - spacingX}px,${y - spacingY}px,0)`;
  else transform = `translate3d(${x - spacingX * 2}px,${y - spacingY * 2}px,0) scale(${spacingX / TILE_SIZE},${spacingY / TILE_SIZE})`;
  return {
    spacing: spacingX, spacingX, spacingY, x, y, coarse, paintsOffset, transform,
    backgroundPosition: paintsOffset ? `${x + 48}px ${y + 48}px` : '0 0',
  };
}

export function applyGridProjection(grid, camera, interval, projection = gridProjection(camera, interval)) {
  const { style } = grid;
  const { coarse, paintsOffset, spacingX, spacingY, transform, backgroundPosition } = projection;
  style.transform = transform;
  style.backgroundSize = coarse ? `${spacingX}px ${spacingY}px` : '24px 24px';
  style.backgroundPosition = backgroundPosition;
  style.width = coarse && !paintsOffset ? `calc(100% + ${spacingX * 2}px)` : '';
  style.height = coarse && !paintsOffset ? `calc(100% + ${spacingY * 2}px)` : '';
  style.setProperty('--surface-dot-x', `${coarse ? 2 : 48 / spacingX}px`);
  style.setProperty('--surface-dot-y', `${coarse ? 2 : 48 / spacingY}px`);
  style.setProperty('--surface-dot-radius', `${coarse ? 1.5 : 36 / spacingX}px`);
}
