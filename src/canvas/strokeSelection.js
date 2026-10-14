import { strokePaintSize } from './inkStroke.js';

export function strokeSelectionGeometry(item, viewSize) {
  const points = (item.points || []).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map(p => ({ x: p.x * viewSize.width, y: p.y * viewSize.height }));
  if (!points.length) return null;
  const hitWidth = Math.max(14, strokePaintSize(item));
  const pad = hitWidth / 2;
  const x = Math.min(...points.map(p => p.x)) - pad;
  const y = Math.min(...points.map(p => p.y)) - pad;
  const width = Math.max(...points.map(p => p.x)) + pad - x;
  const height = Math.max(...points.map(p => p.y)) + pad - y;
  return { x, y, width, height, hitWidth, points: points.map(p => ({ x: p.x - x, y: p.y - y })) };
}
