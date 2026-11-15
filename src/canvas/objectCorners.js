import { hasShapeCorners } from './shapeAppearance.js';
import { parseRawStyleEnvelope, normalizeCornerRadius } from './styling/objectStyleModel.js';

const cardKinds = new Set(['project', 'image', 'pdf', 'chart', 'value', 'question', 'table', 'text', 'code', 'link', 'frame']);
export const supportsObjectCorners = item => cardKinds.has(item?.kind);
export const supportsAnyCorners = item => supportsObjectCorners(item) || (item?.kind === 'shape' && !item.runtimeRole && hasShapeCorners(item.shapeType));
export const validObjectCornerStyle = value => value === 'sharp' || value === 'rounded';
export const objectCornerStyle = item => item?.cornerStyle || (['image', 'frame'].includes(item?.kind) ? 'sharp' : 'rounded');
export const effectiveCornerStyle = item => (item?.kind === 'shape' ? item?.cornerStyle || 'sharp' : objectCornerStyle(item));

/** Summarize corner styling across one or more selected items (cards, images, frames, shapes). */
export function selectionCornerState(ids, items) {
  const targetIds = [];
  const styles = new Set();
  for (const id of ids || []) {
    const item = items?.[id];
    if (!supportsAnyCorners(item)) continue;
    targetIds.push(id);
    styles.add(effectiveCornerStyle(item));
  }
  if (!targetIds.length) return { targetIds, value: null };
  return { targetIds, value: styles.size === 1 ? [...styles][0] : 'mixed' };
}

/** World-pixel radius shared by the DOM and the GPU thumbnail renderer. */
export function objectCornerRadius(item, width = Infinity, height = Infinity) {
  const env = parseRawStyleEnvelope(item);
  if (env.cornerRadius) {
    const c = normalizeCornerRadius(env.cornerRadius, 0);
    const maxR = Math.max(c.tl, c.tr, c.br, c.bl);
    return Math.max(0, Math.min(maxR, width / 2, height / 2));
  }
  return objectCornerStyle(item) === 'rounded' ? Math.max(0, Math.min(24, width / 2, height / 2)) : 0;
}

export function objectCornerRadii(item, width = Infinity, height = Infinity) {
  const env = parseRawStyleEnvelope(item);
  const cap = (v) => Math.max(0, Math.min(v, width / 2, height / 2));
  if (env.cornerRadius) {
    const c = normalizeCornerRadius(env.cornerRadius, 0);
    return { tl: cap(c.tl), tr: cap(c.tr), br: cap(c.br), bl: cap(c.bl) };
  }
  const uniform = objectCornerStyle(item) === 'rounded' ? cap(24) : 0;
  return { tl: uniform, tr: uniform, br: uniform, bl: uniform };
}
