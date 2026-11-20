import { changedItemIds } from '../canvas/itemSnapshots.js';
import { sameStable } from '../canvas/asCode/manifest.js';
import { isDrawableCanvasItem } from '../canvas/drawableItems.js';
import {researchSymbolUsesFrameAnchors} from '../canvas/researchSymbols.js';
import { isLogicGate } from '../canvas/logicGates.js';
import { logicConnectorGeometry } from '../canvas/connectors/logicConnectorGeometry.js';
import { connectorControlHandles, connectorPointCount, sampleControlCurve } from '../canvas/connectors/controlPoints.js';
import { strokePaintSize } from '../canvas/inkStroke.js';
import { connectorObjectSize, connectorMetricsRevision, connectorMetricsChangedIds, CONNECTOR_METRICS_EVENT } from '../canvas/connectors/objectMetrics.js';
import { isRasterCode, codePreviewHeight } from '../canvas/codePreviewMetrics.js';
import { CANVAS_SPACE } from '../canvas/canvasSpace.js';
import { arrowPathGeometry } from './arrowheadGeometry.js';
import { objectCornerRadius, supportsObjectCorners } from '../canvas/objectCorners.js';
import { shapeOutlinePaths } from '../canvas/shapeGeometry.js';
import { parseRawStyleEnvelope, readObjectVisibility } from '../canvas/styling/objectStyleModel.js';
import { lookupSpatialIndex, routeConnectorAStarSteps, runSteps, rectCoreBounds } from '../canvas/connectors/aStarRoute.js';

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

function isObstacleCandidate(candidate) {
  // Freehand ink is annotation: scribbles and circles drawn around groups would
  // enclose endpoints and multiply the routing grid. Connectors avoid objects.
  if (!isDrawableCanvasItem(candidate) || candidate.kind === 'connector' || candidate.kind === 'stroke' || candidate.kind === 'frame' || candidate.type === 'chat_room') {
    return false;
  }
  return !readObjectVisibility(candidate).hidden;
}

function querySpatialObstacles(fromId, toId, items, minPxX, minPxY, maxPxX, maxPxY, width, height, spatial, obstacleMap) {
  const window = {
    minX: minPxX / Math.max(1, width),
    minY: minPxY / Math.max(1, height),
    maxX: maxPxX / Math.max(1, width),
    maxY: maxPxY / Math.max(1, height),
  };
  // Remember every area searched: an object entering it may change the route.
  const searched = obstacleMap.searched;
  obstacleMap.searched = searched ? { minX: Math.min(searched.minX, window.minX), minY: Math.min(searched.minY, window.minY), maxX: Math.max(searched.maxX, window.maxX), maxY: Math.max(searched.maxY, window.maxY) } : window;
  const candidates = spatial.query(window);
  let added = 0;
  for (let i = 0; i < candidates.length; i++) {
    const entry = candidates[i];
    const id = String(entry.id);
    if (id === fromId || id === toId || obstacleMap.has(id)) continue;
    const candidate = items[id] || entry.item;
    if (!isObstacleCandidate(candidate)) continue;
    obstacleMap.set(id, { id, ...objectRect(candidate, width, height) });
    added++;
  }
  return added;
}

let lastObstacleMap = null;
function collectNearbyObstacles(item, items, from, to, width, height, clearance, spatial) {
  const fromId = String(item.from);
  const toId = String(item.to);
  const obstacleMap = new Map();
  lastObstacleMap = obstacleMap;
  obstacleMap.spatial = Boolean(spatial);
  if (spatial) {
    const padPx = Math.max(240, Math.min(960, Math.round(Math.hypot(to.centerX - from.centerX, to.centerY - from.centerY) * 0.6 + clearance * 6)));
    let minPxX = Math.min(from.centerX - from.halfWidth, to.centerX - to.halfWidth) - padPx;
    let minPxY = Math.min(from.centerY - from.halfHeight, to.centerY - to.halfHeight) - padPx;
    let maxPxX = Math.max(from.centerX + from.halfWidth, to.centerX + to.halfWidth) + padPx;
    let maxPxY = Math.max(from.centerY + from.halfHeight, to.centerY + to.halfHeight) + padPx;
    querySpatialObstacles(fromId, toId, items, minPxX, minPxY, maxPxX, maxPxY, width, height, spatial, obstacleMap);

    // If a collected tall/wide wall extends outside the initial window, pull in obstacles near its outer tips too.
    let expMinX = minPxX;
    let expMinY = minPxY;
    let expMaxX = maxPxX;
    let expMaxY = maxPxY;
    for (const obs of obstacleMap.values()) {
      const b = rectCoreBounds(obs, clearance * 2);
      if (b.minX < expMinX) expMinX = b.minX;
      if (b.minY < expMinY) expMinY = b.minY;
      if (b.maxX > expMaxX) expMaxX = b.maxX;
      if (b.maxY > expMaxY) expMaxY = b.maxY;
    }
    if (expMinX < minPxX || expMinY < minPxY || expMaxX > maxPxX || expMaxY > maxPxY) {
      querySpatialObstacles(fromId, toId, items, expMinX - 120, expMinY - 120, expMaxX + 120, expMaxY + 120, width, height, spatial, obstacleMap);
    }
    return obstacleMap;
  }
  let entries;
  try {
    entries = Object.entries(items);
  } catch {
    return obstacleMap;
  }
  for (let i = 0; i < entries.length; i++) {
    const [rawId, candidate] = entries[i];
    const id = String(rawId);
    if (id === fromId || id === toId) continue;
    if (!isObstacleCandidate(candidate)) continue;
    obstacleMap.set(id, { id, ...objectRect(candidate, width, height) });
  }
  return obstacleMap;
}

// Route mode for one calculateConnectorGeometry pass: `capture` collects the
// obstacle routes it needs (as resumable generators) and answers with the
// direct curve; `inject` answers those calls with finished routes, in order.
let routeMode = null;
function createDynamicRouter(item, items, width, height, clearance, spatial, obstacleMap) {
  const fromId = String(item.from);
  const toId = String(item.to);
  function* steps(routeArgs) {
    let obstacles = [...obstacleMap.values()];
    if (!obstacles.length) {
      return { points: routeArgs.preferredPoints, routed: false, corridor: null };
    }
    let result = yield* routeConnectorAStarSteps({ ...routeArgs, obstacles });
    if (!spatial || !result.routed || !result.corridor) return result;
    const expandPad = Math.max(48, Math.round(clearance * 3));
    for (let pass = 0; pass < 2; pass++) {
      const added = querySpatialObstacles(
        fromId,
        toId,
        items,
        result.corridor.minX - expandPad,
        result.corridor.minY - expandPad,
        result.corridor.maxX + expandPad,
        result.corridor.maxY + expandPad,
        width,
        height,
        spatial,
        obstacleMap
      );
      if (!added) break;
      obstacles = [...obstacleMap.values()];
      result = yield* routeConnectorAStarSteps({ ...routeArgs, obstacles });
      if (!result.routed || !result.corridor) break;
    }
    return result;
  }
  return (routeArgs) => {
    if (routeMode?.capture) {
      routeMode.capture.push(steps(routeArgs));
      return { points: routeArgs.preferredPoints, routed: false, corridor: null };
    }
    if (routeMode?.inject?.length) return routeMode.inject.shift();
    return runSteps(steps(routeArgs));
  };
}

function defaultCorridorBounds(from, to, points, width, height, clearance) {
  const fromB = rectCoreBounds(from, clearance);
  const toB = rectCoreBounds(to, clearance);
  let minX = Math.min(fromB.minX, toB.minX);
  let minY = Math.min(fromB.minY, toB.minY);
  let maxX = Math.max(fromB.maxX, toB.maxX);
  let maxY = Math.max(fromB.maxY, toB.maxY);
  if (Array.isArray(points)) {
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      minX = Math.min(minX, p.x - clearance);
      minY = Math.min(minY, p.y - clearance);
      maxX = Math.max(maxX, p.x + clearance);
      maxY = Math.max(maxY, p.y + clearance);
    }
  }
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  return { minX: minX / w, minY: minY / h, maxX: maxX / w, maxY: maxY / h };
}

function calculateConnectorGeometry(item, items, width, height, spatialIndex = null) {
  const fromItem = items?.[item?.from];
  const toItem = items?.[item?.to];
  if (!isDrawableCanvasItem(fromItem) || !isDrawableCanvasItem(toItem)) return null;

  if (String(item.from) === String(item.to)) return null;
  const spatial = spatialIndex || lookupSpatialIndex(items);
  const from = { id: String(item.from), ...objectRect(fromItem, width, height) };
  const to = { id: String(item.to), ...objectRect(toItem, width, height) };
  const strokeWidth = Number(item.strokeWidth) || 1.5;
  const headSize = Number.isFinite(item.headSize) ? Math.max(2, Math.min(128, item.headSize)) : Math.max(8, Math.min(15, 6 + strokeWidth * 2.5));
  const clearance = Math.max(12, Math.min(28, headSize * 0.5 + strokeWidth / 2 + 8));
  const obstacleMap = collectNearbyObstacles(item, items, from, to, width, height, clearance, spatial);
  const routeWithObstacles = createDynamicRouter(item, items, width, height, clearance, spatial, obstacleMap);

  if (isLogicGate(fromItem.shapeType) || isLogicGate(toItem.shapeType)) {
    return logicConnectorGeometry(item, fromItem, toItem, from, to, { width, height }, distanceToEdge, [...obstacleMap.values()], routeWithObstacles);
  }

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
  // Arrowheads extend backwards from their tips. Their size is obstacle
  // clearance, not a gap between the tip and the connected object's boundary.
  const availableGap = Math.max(0, (length - sourceReach - targetReach) / 3);
  const attachmentPadding = rect => Math.min(2 + strokeWidth / 2 + (rect.outlinePadding || 0), availableGap);
  const anchorAt = (rect, dir) => {
    const reach = distanceToEdge(rect, dir.x, dir.y) + attachmentPadding(rect);
    return { x: rect.centerX + dir.x * reach, y: rect.centerY + dir.y * reach };
  };
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
    const routedStraight = obstacleMap.size
      ? routeWithObstacles({
          from,
          to,
          preferredPoints: [start, end],
          clearance,
          anchorFn: anchorAt,
          keepOrthogonal: false,
        })
      : { points: [start, end], routed: false, corridor: null };
    const finalPoints = routedStraight.points || [start, end];
    const arrowPath = arrowPathGeometry(finalPoints, {
      startHead: item.startHead,
      endHead: item.endHead,
      headSize,
      strokeWidth,
    });
    const midPoint = routedStraight.routed && routedStraight.handles?.length
      ? routedStraight.handles[0]
      : { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const corridor = routedStraight.corridor
      ? {
          minX: routedStraight.corridor.minX / Math.max(1, width),
          minY: routedStraight.corridor.minY / Math.max(1, height),
          maxX: routedStraight.corridor.maxX / Math.max(1, width),
          maxY: routedStraight.corridor.maxY / Math.max(1, height),
        }
      : defaultCorridorBounds(from, to, finalPoints, width, height, clearance);
    return {
      ...arrowPath,
      directionX,
      directionY,
      normalX,
      normalY,
      gap,
      bend: 0,
      bendStart: finalPoints[0],
      bendEnd: finalPoints[finalPoints.length - 1],
      controlSourcePoints: finalPoints,
      controlHandles: [midPoint],
      routed: Boolean(routedStraight.routed),
      corridor,
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
    const routedOrtho = obstacleMap.size
      ? routeWithObstacles({
          from,
          to,
          preferredPoints: orthoPoints,
          clearance,
          anchorFn: anchorAt,
          keepOrthogonal: true,
        })
      : { points: orthoPoints, routed: false, corridor: null };
    const finalPoints = routedOrtho.points || orthoPoints;
    const arrowPath = arrowPathGeometry(finalPoints, {
      startHead: item.startHead,
      endHead: item.endHead,
      headSize,
      strokeWidth,
    });
    const handlePoint = routedOrtho.routed && routedOrtho.handles?.length
      ? routedOrtho.handles[0]
      : {
          x: (orthoPoints[1].x + orthoPoints[2].x) / 2,
          y: (orthoPoints[1].y + orthoPoints[2].y) / 2,
        };
    const corridor = routedOrtho.corridor
      ? {
          minX: routedOrtho.corridor.minX / Math.max(1, width),
          minY: routedOrtho.corridor.minY / Math.max(1, height),
          maxX: routedOrtho.corridor.maxX / Math.max(1, width),
          maxY: routedOrtho.corridor.maxY / Math.max(1, height),
        }
      : defaultCorridorBounds(from, to, finalPoints, width, height, clearance);
    return {
      ...arrowPath,
      directionX,
      directionY,
      normalX,
      normalY,
      gap,
      bend: Number(item.bend) || 0,
      bendStart: finalPoints[0],
      bendEnd: finalPoints[finalPoints.length - 1],
      controlSourcePoints: finalPoints,
      controlHandles: [handlePoint],
      routed: Boolean(routedOrtho.routed),
      corridor,
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
  const aStarResult = obstacleMap.size
    ? routeWithObstacles({
        from,
        to,
        preferredPoints: curvePoints,
        clearance,
        anchorFn: anchorAt,
        guides: hasControls ? controls : null,
        keepOrthogonal: false,
      })
    : { points: curvePoints, routed: false, corridor: null };
  const finalPoints = aStarResult.points || curvePoints;
  const arrowPath = arrowPathGeometry(finalPoints, {
    startHead: item.startHead,
    endHead: item.endHead,
    headSize,
    strokeWidth: Number(item.strokeWidth) || 1.5,
  });
  const corridor = aStarResult.corridor
    ? {
        minX: aStarResult.corridor.minX / Math.max(1, width),
        minY: aStarResult.corridor.minY / Math.max(1, height),
        maxX: aStarResult.corridor.maxX / Math.max(1, width),
        maxY: aStarResult.corridor.maxY / Math.max(1, height),
      }
    : defaultCorridorBounds(from, to, finalPoints, width, height, clearance);
  return {
    ...arrowPath,
    directionX,
    directionY,
    normalX,
    normalY,
    gap,
    bend,
    bendStart: finalPoints[0] || start,
    bendEnd: finalPoints[finalPoints.length - 1] || end,
    controlSourcePoints: finalPoints,
    controlHandles: hasControls ? controls : [finalPoints[Math.floor((finalPoints.length - 1) / 2)]],
    routed: Boolean(aStarResult.routed),
    corridor,
  };
}

const geometryCache = new WeakMap();
// Per connector: the route and what it depended on. A new items snapshot reuses
// the route unless a changed object is an endpoint, was an obstacle, or now lies
// in an area searched for obstacles. Rerouting every connector (A*) on every
// unrelated edit dropped frames on canvases with connectors.
const routeCache = new WeakMap();
function routeStillValid(entry, item, items, width, height, spatial) {
  if (items[item.from] !== entry.fromItem || items[item.to] !== entry.toItem) return false;
  const edited = entry.items === items ? [] : changedItemIds(entry.items, items);
  const remeasured = connectorMetricsChangedIds(entry.metricsRevision);
  if (!edited || !remeasured) return false;
  const changed = remeasured.length ? [...edited, ...remeasured] : edited;
  const searched = entry.searched;
  for (const id of changed) {
    if (entry.obstacles.has(id) || id === String(item.from) || id === String(item.to)) return false;
    const candidate = items[id];
    if (!candidate || !isObstacleCandidate(candidate)) continue;
    // Without a spatial index every candidate is an obstacle.
    if (!entry.spatial || !searched) return false;
    const rect = objectRect(candidate, width, height), indexed = spatial?.entries?.get?.(id);
    // The obstacle query matches index bounds, which may exceed the object rect.
    let minX = (rect.centerX - rect.halfWidth) / Math.max(1, width), maxX = (rect.centerX + rect.halfWidth) / Math.max(1, width);
    let minY = (rect.centerY - rect.halfHeight) / Math.max(1, height), maxY = (rect.centerY + rect.halfHeight) / Math.max(1, height);
    if (indexed && Number.isFinite(indexed.minX)) { minX = Math.min(minX, indexed.minX); minY = Math.min(minY, indexed.minY); maxX = Math.max(maxX, indexed.maxX); maxY = Math.max(maxY, indexed.maxY); }
    if (!(maxX < searched.minX || minX > searched.maxX || maxY < searched.minY || minY > searched.maxY)) return false;
  }
  return true;
}
// Obstacle routing is A* over a grid. On the browser main thread a route may run
// only for the rest of a small per-task budget; an unfinished route shows the
// direct curve and continues in later slices, without restarting.
// CONNECTOR_METRICS_EVENT then refreshes just those connectors.
const ROUTE_BUDGET_MS = typeof window === 'object' && typeof document === 'object' ? 4 : Infinity;
const REFINE_SLICE_MS = 8;
let budgetSpent = 0, budgetResetScheduled = false;
const pendingJobs = new Map();
let refineTimer = null;
function taskBudgetLeft() {
  if (ROUTE_BUDGET_MS === Infinity) return Infinity;
  if (!budgetResetScheduled) { budgetResetScheduled = true; setTimeout(() => { budgetSpent = 0; budgetResetScheduled = false; }, 0); }
  return ROUTE_BUDGET_MS - budgetSpent;
}
// Copies made for rasterisation and selection share a route with the original.
const SIGNATURE_LIMIT = 4096;
const routeBySignature = new Map();
// Fields a connector's route never reads: rendering copies differ only here.
const ROUTE_IRRELEVANT = new Set(['__selectionOutline', 'shadowEnabled', 'shadowBlur', 'shadowOpacity', 'shadowOffsetX', 'shadowOffsetY', 'depth', 'locked', 'permission', 'x', 'y']);
function routeSignature(item) {
  try {
    const rest = {};
    for (const key of Object.keys(item).sort()) if (!ROUTE_IRRELEVANT.has(key)) rest[key] = item[key];
    return JSON.stringify(rest);
  } catch { return null; }
}
// What a route reads from an object: its content and its measured rectangle.
// Items are immutable snapshots: the key is cached per object and world size, so
// validating routes on every scene change never re-measures unchanged outlines.
const rectKeys = new WeakMap();
function rectKey(item, width, height) {
  const size = `${width}:${height}:${connectorMetricsRevision()}`;
  const cached = rectKeys.get(item);
  if (cached?.size === size) return cached.key;
  const r = objectRect(item, width, height);
  const key = `${r.centerX},${r.centerY},${r.halfWidth},${r.halfHeight},${r.rotation},${r.outlinePadding},${r.cornerRadius}`;
  rectKeys.set(item, { size, key });
  return key;
}
function sameRouteInput(before, after, width, height) {
  return before === after || Boolean(before && after && sameStable(before, after) && rectKey(before, width, height) === rectKey(after, width, height));
}
function obstacleIdsIn(window, item, items, spatial) {
  const fromId = String(item.from), toId = String(item.to), ids = new Set();
  for (const entry of spatial.query(window)) {
    const id = String(entry.id);
    if (id === fromId || id === toId) continue;
    if (isObstacleCandidate(items[id] || entry.item)) ids.add(id);
  }
  return ids;
}
// Exact dependency check against the current index, independent of snapshot
// lineage, so a full resync with identical content keeps every route.
function routeInputsUnchanged(entry, item, items, width, height, spatial) {
  if (!sameRouteInput(entry.fromItem, items[item.from], width, height) || !sameRouteInput(entry.toItem, items[item.to], width, height)) return false;
  if (!entry.spatial || !spatial || !entry.searched || !entry.windowIds) return routeStillValid(entry, item, items, width, height, spatial);
  const current = obstacleIdsIn(entry.searched, item, items, spatial);
  if (current.size !== entry.windowIds.size) return false;
  for (const id of current) if (!entry.windowIds.has(id)) return false;
  for (const id of current) if (!sameRouteInput(entry.items[id], items[id], width, height)) return false;
  return true;
}
// Snapshot lineage names exactly what changed since the route was validated. When
// none of it can be an endpoint or obstacle (strokes being drawn or erased, other
// connectors), the route is still valid without re-querying its search window.
function lineageUnchanged(entry, item, items) {
  if (!entry.items || entry.provisional) return false;
  const changed = changedItemIds(entry.items, items);
  if (!changed) return false;
  const fromId = String(item.from), toId = String(item.to);
  for (const id of changed) {
    if (String(id) === fromId || String(id) === toId) return false;
    const before = entry.items[id], after = items[id];
    if ((before && isObstacleCandidate(before)) || (after && isObstacleCandidate(after))) return false;
  }
  return true;
}
function rememberRoute(item, entry) {
  routeCache.set(item, entry);
  const signature = routeSignature(item);
  if (signature === null) return;
  routeBySignature.delete(signature); routeBySignature.set(signature, entry);
  if (routeBySignature.size > SIGNATURE_LIMIT) routeBySignature.delete(routeBySignature.keys().next().value);
}
function startJob(item, items, width, height, spatial, routeKey) {
  const metricsRevision = connectorMetricsRevision();
  const capture = [];
  const outer = routeMode;
  lastObstacleMap = null; routeMode = { capture };
  let provisional;
  try { provisional = calculateConnectorGeometry(item, items, width, height, spatial); }
  finally { routeMode = outer; }
  return { item, items, width, height, spatial, routeKey, metricsRevision, provisional, obstacleMap: lastObstacleMap, steps: capture, results: [], step: null };
}
function advanceJob(job, deadline) {
  while (job.results.length < job.steps.length) {
    const steps = job.steps[job.results.length];
    let next;
    do next = steps.next(); while (!next.done && performance.now() < deadline);
    if (!next.done) return false;
    job.results.push(next.value);
  }
  return true;
}
function finishJob(job) {
  let geometry = job.provisional;
  if (job.steps.length) {
    const outer = routeMode;
    routeMode = { inject: [...job.results] };
    try { geometry = calculateConnectorGeometry(job.item, job.items, job.width, job.height, job.spatial); }
    finally { routeMode = outer; }
  }
  storeRoute(job, geometry, false);
  return geometry;
}
function storeRoute(job, geometry, provisional) {
  const { item, items, obstacleMap: used } = job;
  if (used) rememberRoute(item, { key: job.routeKey, items, metricsRevision: job.metricsRevision, geometry, provisional, job: provisional ? job : null, fromItem: items[item.from], toItem: items[item.to], obstacles: new Set(used.keys()), searched: used.searched || null, spatial: used.spatial,
    windowIds: used.spatial && used.searched && job.spatial ? obstacleIdsIn(used.searched, item, items, job.spatial) : null });
  else routeCache.delete(item);
  const cache = geometryCache.get(items);
  if (cache) cache.results.set(item, geometry);
}
function scheduleRefinement() {
  if (refineTimer !== null || !pendingJobs.size) return;
  refineTimer = setTimeout(() => {
    refineTimer = null;
    const deadline = performance.now() + REFINE_SLICE_MS, done = [];
    for (const [key, job] of pendingJobs) {
      if (routeCache.get(job.item)?.job !== job) { pendingJobs.delete(key); continue; }
      if (!advanceJob(job, deadline)) break;
      pendingJobs.delete(key);
      finishJob(job);
      done.push(job);
      if (performance.now() >= deadline) break;
    }
    if (done.length && typeof window === 'object') {
      const wanted = new Set(done.map(job => job.item)), ids = [];
      const items = done[0].items;
      for (const id of Object.keys(items)) if (wanted.has(items[id])) ids.push(id);
      const event = new Event(CONNECTOR_METRICS_EVENT);
      event.changedItemIds = ids.length === wanted.size ? ids : null;
      window.dispatchEvent(event);
    }
    scheduleRefinement();
  }, 0);
}
function computeRoute(item, items, width, height, spatial, routeKey) {
  const started = performance.now(), left = taskBudgetLeft();
  try {
    const job = startJob(item, items, width, height, spatial, routeKey);
    if (advanceJob(job, left === Infinity ? Infinity : started + Math.max(0, left))) return finishJob(job);
    storeRoute(job, job.provisional, true);
    // One pending job per connector: a newer request (new snapshot, a copy made
    // for rasterising) supersedes the older one instead of queueing beside it.
    const key = routeSignature(item) ?? item;
    pendingJobs.delete(key);
    pendingJobs.set(key, job);
    scheduleRefinement();
    return job.provisional;
  } finally {
    budgetSpent += performance.now() - started;
  }
}
export function connectorGeometry(item, items, width = 1, height = 1, spatialIndex = null) {
  if (!item || !items) return null;
  const spatial = spatialIndex || lookupSpatialIndex(items);
  const spatialRev = spatial?.obstacleRevision ?? spatial?.stats?.updates ?? 0;
  const key = `${width}:${height}:${connectorMetricsRevision()}:${spatialRev}`;
  let cache = geometryCache.get(items);
  if (!cache || cache.key !== key) { cache = { key, results: new WeakMap() }; geometryCache.set(items, cache); }
  if (cache.results.has(item)) return cache.results.get(item);
  const routeKey = `${width}:${height}`;
  let entry = routeCache.get(item);
  // A provisional entry is superseded once its background job finishes; copies of
  // the connector (snapshots, rasterisation copies) must follow to the final route
  // instead of keeping the straight provisional line forever.
  if (!entry || entry.provisional) {
    const shared = routeBySignature.get(routeSignature(item));
    if (shared && (!entry || !shared.provisional)) entry = shared;
  }
  if (entry && entry.key === routeKey && (lineageUnchanged(entry, item, items) || routeInputsUnchanged(entry, item, items, width, height, spatial))) {
    // A provisional route keeps refining in the background; reuse it meanwhile.
    if (!entry.provisional) { entry.items = items; entry.metricsRevision = connectorMetricsRevision(); }
    if (routeCache.get(item) !== entry) routeCache.set(item, entry);
    cache.results.set(item, entry.geometry);
    return entry.geometry;
  }
  return computeRoute(item, items, width, height, spatial, routeKey);
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
