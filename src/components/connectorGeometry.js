import { isDrawableCanvasItem } from '../canvas/drawableItems.js';
import {researchSymbolUsesFrameAnchors} from '../canvas/researchSymbols.js';
import { isLogicGate } from '../canvas/logicGates.js';
import { logicConnectorGeometry } from '../canvas/connectors/logicConnectorGeometry.js';
import { connectorControlHandles, connectorPointCount, sampleControlCurve } from '../canvas/connectors/controlPoints.js';
import { strokePaintSize } from '../canvas/inkStroke.js';
import { connectorObjectSize, connectorMetricsRevision } from '../canvas/connectors/objectMetrics.js';
import { isRasterCode, codePreviewHeight } from '../canvas/codePreviewMetrics.js';
import { CANVAS_SPACE } from '../canvas/canvasSpace.js';
import { arrowPathGeometry } from './arrowheadGeometry.js';
import { objectCornerRadius, supportsObjectCorners } from '../canvas/objectCorners.js';
import { shapeOutlinePaths } from '../canvas/shapeGeometry.js';
import { parseRawStyleEnvelope } from '../canvas/styling/objectStyleModel.js';

export const OBJECT_SIZES = {
  value: [0.28,0.21],
  pdf: [0.3, 0.48],
  'user-group': [0.3, 0.2],
  image: [0.3, 0.2],
  code: [0.32, 0.2],
  shape: [0.14, 0.12],
  math: [0.2, 0.09],
  text: [0.22, 0.12],
  note: [0.22, 0.15],
  table: [0.42, 0.32],
  chart: [0.3, 0.25],
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
  const objectHeight = (measured ? measured.height / CANVAS_SPACE.height : Number(item?.height) || (isRasterCode(item) ? codePreviewHeight(item, height) / height : defaultHeight)) * height;
  return {
    centerX: x + objectWidth / 2,
    centerY: y + objectHeight / 2,
    halfWidth: objectWidth / 2,
    halfHeight: objectHeight / 2,
    rotation: (Number(item?.rotation) || 0) * Math.PI / 180,
    outlinePadding: item?.kind === 'shape' && !item.runtimeRole && item.strokeEnabled !== false ? Math.max(0, Number(item.strokeWidth) || 1.5) / 2 : 0,
    cornerRadius: supportsObjectCorners(item) ? objectCornerRadius(item, objectWidth, objectHeight) : 0,
    isEllipse: item?.kind === 'shape' && item.shapeType === 'ellipse',
    shapePaths: item?.kind === 'shape' && item.shapeType !== 'arrow' && !researchSymbolUsesFrameAnchors(item.shapeType)
      ? shapeOutlinePaths(item.shapeType, objectWidth, objectHeight, item) : null,
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
  const reach = Math.min(xDistance, yDistance);
  const radius = rect.cornerRadius || 0;
  // A ray near a rounded card corner meets its arc before the bounding box.
  if (radius > 0) {
    const x = Math.abs(localX), y = Math.abs(localY);
    const cx = rect.halfWidth - radius, cy = rect.halfHeight - radius;
    if (reach * x > cx && reach * y > cy) {
      const projection = cx * x + cy * y;
      const discriminant = projection * projection - (cx * cx + cy * cy - radius * radius);
      if (discriminant >= 0) return projection + Math.sqrt(discriminant);
    }
  }
  return reach;
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
  if (!isDrawableCanvasItem(fromItem) || !isDrawableCanvasItem(toItem)) return null;

  if (String(item.from) === String(item.to)) return null;
  // Pin routing needs only its endpoints. It must not depend on unrelated
  // background frames, labels, or enumeration of a structurally shared view.
  if (isLogicGate(fromItem.shapeType) || isLogicGate(toItem.shapeType)) {
    return logicConnectorGeometry(item, fromItem, toItem, objectRect(fromItem, width, height), objectRect(toItem, width, height), { width, height }, distanceToEdge);
  }
  const from = {id:String(item.from),...objectRect(fromItem,width,height)};
  const to = {id:String(item.to),...objectRect(toItem,width,height)};
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
  const headSize = Number.isFinite(item.headSize) ? Math.max(2, Math.min(128, item.headSize)) : Math.max(8, Math.min(15, 6 + strokeWidth * 2.5));
  // Arrowheads extend backwards from their tips. Their size is obstacle
  // clearance, not a gap between the tip and the connected object's boundary.
  const availableGap = Math.max(0, (length - sourceReach - targetReach) / 3);
  const attachmentPadding = rect => Math.min(2 + strokeWidth / 2 + (rect.outlinePadding || 0), availableGap);
  const sourcePadding = attachmentPadding(from), targetPadding = attachmentPadding(to);
  const start = {
    x: from.centerX + directionX * (sourceReach + sourcePadding),
    y: from.centerY + directionY * (sourceReach + sourcePadding),
  };
  const end = {
    x: to.centerX - directionX * (targetReach + targetPadding),
    y: to.centerY - directionY * (targetReach + targetPadding),
  };
  const gap = Math.max(1, (end.x - start.x) * directionX + (end.y - start.y) * directionY);
  const routingMode = parseRawStyleEnvelope(item)?.connector?.routing || 'curved';
  if (routingMode === 'straight') {
    const arrowPath = arrowPathGeometry([start, end], {
      startHead: item.startHead,
      endHead: item.endHead,
      headSize,
      strokeWidth,
    });
    const midPoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    return {
      ...arrowPath,
      directionX,
      directionY,
      normalX,
      normalY,
      gap,
      bend: 0,
      bendStart: start,
      bendEnd: end,
      controlSourcePoints: [start, end],
      controlHandles: [midPoint],
      routed: false,
    };
  }
  if (routingMode === 'orthogonal') {
    const horizontalPrimary = Math.abs(dx) >= Math.abs(dy);
    const axisShift = (Number(item.bend) || 0) * (item.rotation < 0 ? -1 : 1) * 40;
    let orthoPoints;
    if (horizontalPrimary) {
      const signX = dx >= 0 ? 1 : -1;
      const sx = from.centerX + signX * (distanceToEdge(from, signX, 0) + sourcePadding);
      const ex = to.centerX - signX * (distanceToEdge(to, -signX, 0) + targetPadding);
      const midX = (sx + ex) / 2 + axisShift;
      orthoPoints = [
        { x: sx, y: from.centerY },
        { x: midX, y: from.centerY },
        { x: midX, y: to.centerY },
        { x: ex, y: to.centerY },
      ];
    } else {
      const signY = dy >= 0 ? 1 : -1;
      const sy = from.centerY + signY * (distanceToEdge(from, 0, signY) + sourcePadding);
      const ey = to.centerY - signY * (distanceToEdge(to, 0, -signY) + targetPadding);
      const midY = (sy + ey) / 2 + axisShift;
      orthoPoints = [
        { x: from.centerX, y: sy },
        { x: from.centerX, y: midY },
        { x: to.centerX, y: midY },
        { x: to.centerX, y: ey },
      ];
    }
    const arrowPath = arrowPathGeometry(orthoPoints, {
      startHead: item.startHead,
      endHead: item.endHead,
      headSize,
      strokeWidth,
    });
    const handlePoint = {
      x: (orthoPoints[1].x + orthoPoints[2].x) / 2,
      y: (orthoPoints[1].y + orthoPoints[2].y) / 2,
    };
    return {
      ...arrowPath,
      directionX,
      directionY,
      normalX,
      normalY,
      gap,
      bend: Number(item.bend) || 0,
      bendStart: orthoPoints[0],
      bendEnd: orthoPoints[orthoPoints.length - 1],
      controlSourcePoints: orthoPoints,
      controlHandles: [handlePoint],
      routed: false,
    };
  }
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
  const hasControls = connectorPointCount(item) > 1 || Array.isArray(item.bendPoints);
  const controls = connectorControlHandles(item, start, end);
  let curvePoints = Array.from({ length: 33 }, (_, index) => bezierPoint(curve, index / 32));
  if (hasControls) {
    const attached = (rect, point, fallback) => {
      const dx = point.x - rect.centerX, dy = point.y - rect.centerY, length = Math.hypot(dx, dy);
      if (length < 1) return fallback;
      const reach = distanceToEdge(rect, dx / length, dy / length) + attachmentPadding(rect);
      return { x: rect.centerX + dx / length * reach, y: rect.centerY + dy / length * reach };
    };
    curvePoints = sampleControlCurve([attached(from, controls[0], start), ...controls, attached(to, controls.at(-1), end)]);
  }
  const arrowPath = arrowPathGeometry(curvePoints, {
    startHead: item.startHead,
    endHead: item.endHead,
    headSize,
    strokeWidth: Number(item.strokeWidth) || 1.5,
  });
  return { ...arrowPath, directionX, directionY, normalX, normalY, gap, bend, bendStart: start, bendEnd: end, controlSourcePoints: curvePoints, controlHandles: hasControls ? controls : [curvePoints[Math.floor((curvePoints.length - 1) / 2)]], routed: false };
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
