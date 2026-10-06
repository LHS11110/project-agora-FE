export const MIN_CONTENT_SCALE = 0.25;
export const MAX_CONTENT_SCALE = 8;
const SCALABLE_KINDS = new Set(['text', 'code', 'math', 'note', 'table', 'link']);

export const isContentScalable = item => SCALABLE_KINDS.has(item?.kind);
// Independent axis values retain the reference layout as the container resizes.
// Rendering uses the smaller value for a uniform scale that fits both axes.
export function objectContentScale(item, axis) {
  const scale = Number((axis && item?.[`contentScale${axis}`]) ?? item?.contentScale);
  return Number.isFinite(scale) && scale > 0
    ? Math.max(MIN_CONTENT_SCALE, Math.min(MAX_CONTENT_SCALE, scale)) : 1;
}
