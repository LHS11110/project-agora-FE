import { CANVAS_SPACE } from './canvasSpace.js';
import { OBJECT_SIZES } from '../components/connectorGeometry.js';
import { connectorObjectSize } from './connectors/objectMetrics.js';

export function numericObjectGeometry(item) {
  if (!item || item.kind === 'connector') return null;
  if (item.kind === 'stroke') {
    if (!item.points?.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const point of item.points) {
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    }
    return { x: minX * CANVAS_SPACE.width, y: minY * CANVAS_SPACE.height,
      width: (maxX - minX) * CANVAS_SPACE.width, height: (maxY - minY) * CANVAS_SPACE.height };
  }
  const [width, height] = OBJECT_SIZES[item.kind] || [.2, .12];
  const measured = connectorObjectSize(item);
  return { x: (Number(item.x) || 0) * CANVAS_SPACE.width, y: (Number(item.y) || 0) * CANVAS_SPACE.height,
    width: Number(item.width) > 0 ? item.width * CANVAS_SPACE.width : measured?.width ?? width * CANVAS_SPACE.width,
    height: Number(item.height) > 0 ? item.height * CANVAS_SPACE.height : measured?.height ?? height * CANVAS_SPACE.height };
}

export function numericObjectPatch(item, field, value) {
  if (!Number.isFinite(value)) return null;
  if (item?.kind === 'stroke' && field === 'strokeWidth') return value >= 1 && value <= 64 ? { strokeWidth: value } : null;
  if (item?.kind === 'stroke' && field === 'opacity') return value >= 0 && value <= 100 ? { opacity: value / 100 } : null;
  const geometry = numericObjectGeometry(item);
  if (!geometry || !['x', 'y', 'width', 'height'].includes(field)) return null;
  if (['width', 'height'].includes(field) && (value < 1 || value > 1_000_000)) return null;
  if (Math.abs(value) > 1_000_000_000) return null;
  const size = ['x', 'width'].includes(field) ? CANVAS_SPACE.width : CANVAS_SPACE.height;
  if (item.kind !== 'stroke') return { [field]: value / size };
  const axis = ['x', 'width'].includes(field) ? 'x' : 'y';
  const origin = geometry[axis] / size;
  const isSize = field === 'width' || field === 'height';
  if (isSize && geometry[field] <= 1e-8) return null;
  return { points: item.points.map(point => ({ ...point,
    [axis]: isSize ? origin + (point[axis] - origin) * value / geometry[field] : point[axis] + value / size - origin })) };
}
