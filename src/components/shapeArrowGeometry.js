import { shapeStrokeWidth } from '../canvas/shapeAppearance.js';
import { CANVAS_SPACE } from '../canvas/canvasSpace.js';
import { connectorPointCount, sampleControlCurve, MAX_BEND_POINTS } from '../canvas/connectors/controlPoints.js';
import { arrowPathGeometry, DEFAULT_ARROW_END_HEAD, DEFAULT_ARROW_START_HEAD } from './arrowheadGeometry.js';

export const DEFAULT_SHAPE_ARROW_BEND = 0.12;

export function shapeArrowGeometry(width, height, bend = DEFAULT_SHAPE_ARROW_BEND, startHead = DEFAULT_ARROW_START_HEAD, endHead = DEFAULT_ARROW_END_HEAD, options = {}) {
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
  let points = Array.from({ length: 33 }, (_, index) => {
    const t = index / 32;
    const inverse = 1 - t;
    return {
      x: inverse * inverse * 0 + 2 * inverse * t * control.x + t * t * w,
      y: inverse * inverse * h + 2 * inverse * t * control.y,
    };
  });
  const controlHandles = Array.isArray(options.bendPoints)
    ? options.bendPoints.map(point => ({ x: point.x * w, y: point.y * h }))
    : [curveMidpoint];
  if (Array.isArray(options.bendPoints)) points = sampleControlCurve([{ x: 0, y: h }, ...controlHandles, { x: w, y: 0 }]);
  const headLength = Number.isFinite(options.headSize) ? Math.max(2, Math.min(128, options.headSize)) : Math.max(9, Math.min(17, length * 0.17));
  const arrowPath = arrowPathGeometry(points, { startHead, endHead, headSize: headLength, strokeWidth: shapeStrokeWidth(options) });

  return { width: w, height: h, length, normal, midpoint, control, curveMidpoint, controlHandles, ...arrowPath, bend: bendRatio };
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

// Points are local fractions of the object's box, so resizing preserves the curve.
export function resizeShapeArrowControls(item, width, height, count) {
  const geometry = shapeArrowGeometry(width, height, item.bend, item.startHead, item.endHead, item);
  const nextCount = Math.max(1, Math.min(MAX_BEND_POINTS, Math.trunc(Number(count) || 1)));
  const points = geometry.curvePoints;
  return { bendPointCount: nextCount, bendPoints: Array.from({ length: nextCount }, (_, index) => {
    const position = (index + 1) / (nextCount + 1) * (points.length - 1), low = Math.floor(position);
    const a = points[low], b = points[Math.min(low + 1, points.length - 1)], t = position - low;
    return { x: (a.x + (b.x - a.x) * t) / geometry.width, y: (a.y + (b.y - a.y) * t) / geometry.height };
  }) };
}
export function shapeArrowControlFromPointer(item, pointer, viewSize, index = 0) {
  const width = (Number(item.width) || .14) * viewSize.width, height = (Number(item.height) || .12) * viewSize.height;
  const count = connectorPointCount(item);
  if (!Number.isInteger(index) || index < 0 || index >= count) return {};
  const geometry = shapeArrowGeometry(width, height, item.bend, item.startHead, item.endHead, item);
  const bendPoints = geometry.controlHandles.map(point => ({ x: point.x / width, y: point.y / height }));
  const angle = -(Number(item.rotation) || 0) * Math.PI / 180;
  const dx = (pointer.x - (Number(item.x) || 0)) * viewSize.width - width / 2;
  const dy = (pointer.y - (Number(item.y) || 0)) * viewSize.height - height / 2;
  bendPoints[index] = { x: .5 + (dx * Math.cos(angle) - dy * Math.sin(angle)) / width, y: .5 + (dx * Math.sin(angle) + dy * Math.cos(angle)) / height };
  return { bendPointCount: bendPoints.length, bendPoints };
}

export function shapeArrowBendPatch(item, bend) {
  const value = Math.max(-1.5, Math.min(1.5, Number(bend) || 0));
  if (!item.bendPoints?.length) return { bend: value };
  const count = connectorPointCount(item);
  const width = Math.max(1, (Number(item.width) || .14) * CANVAS_SPACE.width);
  const height = Math.max(1, (Number(item.height) || .12) * CANVAS_SPACE.height);
  return { bend: value, bendPointCount: count, bendPoints: Array.from({ length: count }, (_, index) => {
    const t = (index + 1) / (count + 1), offset = 2 * t * (1 - t) * value;
    return { x: t + height / width * offset, y: 1 - t + width / height * offset };
  }) };
}
