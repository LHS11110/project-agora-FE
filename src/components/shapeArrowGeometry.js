import { arrowPathGeometry, DEFAULT_ARROW_END_HEAD, DEFAULT_ARROW_START_HEAD } from './arrowheadGeometry.js';

export const DEFAULT_SHAPE_ARROW_BEND = 0.12;

export function shapeArrowGeometry(width, height, bend = DEFAULT_SHAPE_ARROW_BEND, startHead = DEFAULT_ARROW_START_HEAD, endHead = DEFAULT_ARROW_END_HEAD) {
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const dx = w;
  const dy = -h;
  const length = Math.hypot(dx, dy);
  const normal = { x: -dy / length, y: dx / length };
  const midpoint = { x: w / 2, y: h / 2 };
  const bendRatio = Math.max(-1.5, Math.min(1.5, Number.isFinite(Number(bend)) ? Number(bend) : DEFAULT_SHAPE_ARROW_BEND));
  const control = {
    x: midpoint.x + normal.x * length * bendRatio,
    y: midpoint.y + normal.y * length * bendRatio,
  };
  const curveMidpoint = {
    x: (midpoint.x + control.x) / 2,
    y: (midpoint.y + control.y) / 2,
  };
  const points = Array.from({ length: 33 }, (_, index) => {
    const t = index / 32;
    const inverse = 1 - t;
    return {
      x: inverse * inverse * 0 + 2 * inverse * t * control.x + t * t * w,
      y: inverse * inverse * h + 2 * inverse * t * control.y,
    };
  });
  const headLength = Math.max(9, Math.min(17, length * 0.17));
  const arrowPath = arrowPathGeometry(points, { startHead, endHead, headSize: headLength, strokeWidth: 2.5 });

  return { width: w, height: h, length, normal, midpoint, control, curveMidpoint, ...arrowPath, bend: bendRatio };
}

export function shapeArrowBendFromPointer(item, pointer, viewSize) {
  const viewportWidth = Math.max(1, Number(viewSize?.width) || 1);
  const viewportHeight = Math.max(1, Number(viewSize?.height) || 1);
  const itemWidth = Math.max(0.001, Number(item.width) || 0.14);
  const itemHeight = Math.max(0.001, Number(item.height) || 0.12);
  const width = itemWidth * viewportWidth;
  const height = itemHeight * viewportHeight;
  const length = Math.hypot(width, height);
  const normal = { x: height / length, y: width / length };
  const center = {
    x: ((Number(item.x) || 0) + itemWidth / 2) * viewportWidth,
    y: ((Number(item.y) || 0) + itemHeight / 2) * viewportHeight,
  };
  const screenPoint = { x: (Number(pointer.x) || 0) * viewportWidth, y: (Number(pointer.y) || 0) * viewportHeight };
  const angle = -(Number(item.rotation) || 0) * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const dx = screenPoint.x - center.x;
  const dy = screenPoint.y - center.y;
  const localPoint = { x: center.x + dx * cosine - dy * sine, y: center.y + dx * sine + dy * cosine };
  const offset = (localPoint.x - center.x) * normal.x + (localPoint.y - center.y) * normal.y;
  return Math.max(-1.5, Math.min(1.5, (offset * 2) / length));
}
