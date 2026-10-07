import { strokePaintSize } from '../canvas/inkStroke.js';
import { obstacleRoute } from '../canvas/connectors/obstacleRoute.js';
import { connectorObjectSize, connectorMetricsRevision } from '../canvas/connectors/objectMetrics.js';
import { CANVAS_SPACE } from '../canvas/canvasSpace.js';
import { arrowPathGeometry } from './arrowheadGeometry.js';
import { shapeOutlinePaths } from '../canvas/shapeGeometry.js';

export const OBJECT_SIZES = {
  image: [0.3, 0.2],
  code: [0.32, 0.2],
  shape: [0.14, 0.12],
  math: [0.2, 0.09],
  text: [0.22, 0.12],
  note: [0.22, 0.15],
  table: [0.42, 0.32],
  link: [0.3, 0.15],
};

function objectRect(item, width, height) {
  if (item?.kind === 'stroke' && item.points?.length) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const point of item.points) {
      minX = Math.min(minX, point.x * width); maxX = Math.max(maxX, point.x * width);
      minY = Math.min(minY, point.y * height); maxY = Math.max(maxY, point.y * height);
    }
    const pad = strokePaintSize(item) / 2;
    return { centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2,
      halfWidth: (maxX - minX) / 2 + pad, halfHeight: (maxY - minY) / 2 + pad,
      rotation: (Number(item.rotation) || 0) * Math.PI / 180 };
  }

  const [defaultWidth, defaultHeight] = OBJECT_SIZES[item?.kind] || [0.2, 0.12];
  const x = (Number(item?.x) || 0) * width;
  const y = (Number(item?.y) || 0) * height;
  const measured = connectorObjectSize(item);
  const objectWidth = (measured ? measured.width / CANVAS_SPACE.width : Number(item?.width) || defaultWidth) * width;
  const objectHeight = (measured ? measured.height / CANVAS_SPACE.height : Number(item?.height) || defaultHeight) * height;
  return {
    centerX: x + objectWidth / 2,
    centerY: y + objectHeight / 2,
    halfWidth: objectWidth / 2,
    halfHeight: objectHeight / 2,
    rotation: (Number(item?.rotation) || 0) * Math.PI / 180,
    isEllipse: item?.kind === 'shape' && item.shapeType === 'ellipse',
    shapePaths: item?.kind === 'shape' && item.shapeType !== 'arrow'
      ? shapeOutlinePaths(item.shapeType, objectWidth, objectHeight) : null,
  };
}

function distanceToEdge(rect, directionX, directionY) {
  const cosine = Math.cos(rect.rotation);
  const sine = Math.sin(rect.rotation);
  const localX = directionX * cosine + directionY * sine;
  const localY = -directionX * sine + directionY * cosine;
  if (rect.shapePaths && !rect.isEllipse) {
    let distance = 0;
    for (const path of rect.shapePaths) {
      for (let index = 1; index < path.length; index += 1) {
        const a = { x: path[index - 1].x - rect.halfWidth, y: path[index - 1].y - rect.halfHeight };
        const edge = { x: path[index].x - path[index - 1].x, y: path[index].y - path[index - 1].y };
        const cross = localX * edge.y - localY * edge.x;
        if (Math.abs(cross) < 1e-8) continue;
        const rayDistance = (a.x * edge.y - a.y * edge.x) / cross;
        const segmentPosition = (a.x * localY - a.y * localX) / cross;
        if (rayDistance >= 0 && segmentPosition >= -1e-8 && segmentPosition <= 1 + 1e-8) distance = Math.max(distance, rayDistance);
      }
    }
    if (distance > 0) return distance;
  }
  if (rect.isEllipse) {
    const factor = (localX / rect.halfWidth) ** 2 + (localY / rect.halfHeight) ** 2;
    return factor > 0 ? 1 / Math.sqrt(factor) : 0;
  }
  const xDistance = Math.abs(localX) > 1e-8 ? rect.halfWidth / Math.abs(localX) : Infinity;
  const yDistance = Math.abs(localY) > 1e-8 ? rect.halfHeight / Math.abs(localY) : Infinity;
  return Math.min(xDistance, yDistance);
}

function bezierPoint(points, t) {
  const [p0, p1, p2, p3, p4, p5] = points;
  const inverse = 1 - t;
  const i2 = inverse * inverse;
  const t2 = t * t;
  const weights = [i2 * i2 * inverse, 5 * i2 * i2 * t, 10 * i2 * inverse * t2, 10 * i2 * t2 * t, 5 * inverse * t2 * t2, t2 * t2 * t];
  return points.reduce((point, current, index) => ({
    x: point.x + current.x * weights[index],
    y: point.y + current.y * weights[index],
  }), { x: 0, y: 0 });
}

function calculateConnectorGeometry(item, items, width, height) {
  const fromItem = items?.[item?.from];
  const toItem = items?.[item?.to];
  if (!fromItem || !toItem) return null;

  if (String(item.from) === String(item.to)) return null;
  const rectangles = Object.entries(items).filter(([, candidate]) => candidate && candidate.kind !== 'connector').map(([id, candidate]) => ({ id, ...objectRect(candidate, width, height) }));
  const from = rectangles.find(rect => rect.id === String(item.from));
  const to = rectangles.find(rect => rect.id === String(item.to));
  if (!from || !to) return null;
  const dx = to.centerX - from.centerX;
  const dy = to.centerY - from.centerY;
  const length = Math.hypot(dx, dy);
  if (length < 1) return null;

  const directionX = dx / length;
  const directionY = dy / length;
  const normalX = -directionY;
  const normalY = directionX;
  const curveRotation = (Number(item.rotation) || 0) * Math.PI / 180;
  const curveNormalX = normalX * Math.cos(curveRotation) - normalY * Math.sin(curveRotation);
  const curveNormalY = normalX * Math.sin(curveRotation) + normalY * Math.cos(curveRotation);
  const sourceReach = distanceToEdge(from, directionX, directionY);
  const targetReach = distanceToEdge(to, -directionX, -directionY);
  const strokeWidth = Number(item.strokeWidth) || 1.5;
  const headSize = Math.max(8, Math.min(15, 6 + strokeWidth * 2.5));
  const edgePadding = Math.min(headSize + strokeWidth / 2 + 4,
    Math.max(0, (length - sourceReach - targetReach) / 3));
  const start = {
    x: from.centerX + directionX * (sourceReach + edgePadding),
    y: from.centerY + directionY * (sourceReach + edgePadding),
  };
  const end = {
    x: to.centerX - directionX * (targetReach + edgePadding),
    y: to.centerY - directionY * (targetReach + edgePadding),
  };
  const gap = Math.max(1, (end.x - start.x) * directionX + (end.y - start.y) * directionY);
  const hasCustomBend = Number.isFinite(Number(item.bend));
  const bend = hasCustomBend
    ? gap * Math.max(0, Math.min(1.5, Number(item.bend)))
    : 0;
  const curve = [
    start,
    { x: start.x + directionX * gap * 0.2, y: start.y + directionY * gap * 0.2 },
    { x: start.x + directionX * gap * 0.4 + curveNormalX * bend, y: start.y + directionY * gap * 0.4 + curveNormalY * bend },
    { x: end.x - directionX * gap * 0.4 + curveNormalX * bend, y: end.y - directionY * gap * 0.4 + curveNormalY * bend },
    { x: end.x - directionX * gap * 0.2, y: end.y - directionY * gap * 0.2 },
    end,
  ];
  const curvePoints = Array.from({ length: 33 }, (_, index) => bezierPoint(curve, index / 32));
  const routed = obstacleRoute({ preferred: curvePoints, rectangles, from, to,
    padding: headSize + strokeWidth / 2 + 4, preserveBend: bend > 0,
    anchor: (rect, direction, padding) => {
      const reach = distanceToEdge(rect, direction.x, direction.y) + padding;
      return { x: rect.centerX + direction.x * reach, y: rect.centerY + direction.y * reach };
    },
  });
  if (!routed) return null;
  const arrowPath = arrowPathGeometry(routed.points, {
    startHead: item.startHead,
    endHead: item.endHead,
    headSize,
    strokeWidth: Number(item.strokeWidth) || 1.5,
  });
  return { ...arrowPath, directionX, directionY, normalX, normalY, gap, bend, bendStart: start, bendEnd: end, routed: routed.routed };
}

const geometryCache = new WeakMap();
export function connectorGeometry(item, items, width = 1, height = 1) {
  if (!item || !items) return null;
  const key = `${width}:${height}:${connectorMetricsRevision()}`;
  let cache = geometryCache.get(items);
  if (!cache || cache.key !== key) { cache = { key, results: new WeakMap() }; geometryCache.set(items, cache); }
  if (cache.results.has(item)) return cache.results.get(item);
  const geometry = calculateConnectorGeometry(item, items, width, height);
  cache.results.set(item, geometry);
  return geometry;
}

export function connectorBendFromPointer(geometry, pointer, viewSize) {
  if (!geometry?.start || !geometry?.end || !geometry.gap) return { bend: 0, rotation: 0 };
  const width = Math.max(1, Number(viewSize?.width) || 1);
  const height = Math.max(1, Number(viewSize?.height) || 1);
  const pointerX = (Number(pointer?.x) || 0) * width;
  const pointerY = (Number(pointer?.y) || 0) * height;
  const start = geometry.bendStart || geometry.start, end = geometry.bendEnd || geometry.end;
  const centerX = (start.x + end.x) / 2;
  const centerY = (start.y + end.y) / 2;
  const offsetX = pointerX - centerX;
  const offsetY = pointerY - centerY;
  const offsetLength = Math.hypot(offsetX, offsetY);
  if (offsetLength < 1) return { bend: 0, rotation: 0 };
  const baseAngle = Math.atan2(geometry.normalY, geometry.normalX);
  const desiredAngle = Math.atan2(offsetY, offsetX);
  const rotation = ((desiredAngle - baseAngle) * 180 / Math.PI + 540) % 360 - 180;
  return {
    bend: Math.max(0, Math.min(1.5, offsetLength / (geometry.gap * 0.625))),
    rotation,
  };
}
