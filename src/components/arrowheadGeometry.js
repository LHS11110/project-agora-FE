import { ARROW_HEAD_OPTIONS, headNeedsTrim, makeArrowHead } from './arrowheads/headShapes.js';
export { ARROW_HEAD_OPTIONS } from './arrowheads/headShapes.js';
export const DEFAULT_ARROW_START_HEAD = 'none';
export const DEFAULT_ARROW_END_HEAD = 'triangle';

const validHeads = new Set(ARROW_HEAD_OPTIONS.map(({ value }) => value));

export function normalizeArrowHead(value, fallback = DEFAULT_ARROW_END_HEAD) {
  return validHeads.has(value) ? value : fallback;
}

function vectorBetween(a, b) {
  const x = b.x - a.x;
  const y = b.y - a.y;
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function polylineLength(points) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return length;
}

function pointAtDistance(points, distance) {
  let traversed = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);
    if (traversed + segmentLength >= distance && segmentLength > 0) {
      const ratio = (distance - traversed) / segmentLength;
      return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
    }
    traversed += segmentLength;
  }
  return points[points.length - 1];
}

function trimPolyline(points, startDistance, endDistance, totalLength) {
  const start = pointAtDistance(points, startDistance);
  const end = pointAtDistance(points, Math.max(startDistance, totalLength - endDistance));
  let traversed = 0;
  const middle = [];
  for (let index = 1; index < points.length - 1; index += 1) {
    traversed += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    if (traversed > startDistance && traversed < totalLength - endDistance) middle.push(points[index]);
  }
  return [start, ...middle, end];
}

export function arrowPathGeometry(points, {
  startHead = DEFAULT_ARROW_START_HEAD,
  endHead = DEFAULT_ARROW_END_HEAD,
  headSize = 14,
  strokeWidth = 2.5,
} = {}) {
  if (!Array.isArray(points) || points.length < 2) return { points: points || [], curvePoints: points || [], heads: [], start: points?.[0], end: points?.at(-1) };

  // Routing can repeat its port/tip. Remove duplicates before deriving an end direction.
  const curvePoints = [];
  for (const point of points) {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue;
    const last = curvePoints.at(-1);
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 1e-6) curvePoints.push(point);
  }
  const totalLength = polylineLength(curvePoints);
  if (curvePoints.length < 2 || totalLength < 1e-6) return { points: curvePoints, curvePoints, heads: [], start: curvePoints[0], end: curvePoints.at(-1) };
  const startType = normalizeArrowHead(startHead, DEFAULT_ARROW_START_HEAD);
  const endType = normalizeArrowHead(endHead, DEFAULT_ARROW_END_HEAD);
  const count = Number(startType !== 'none') + Number(endType !== 'none');
  // Even open heads occupy space: shrink both ends together on short connections.
  const safeSize = Math.min(Math.max(2, Number(headSize) || 14), totalLength * .72 / Math.max(1, count));
  const startTrim = headNeedsTrim(startType) ? safeSize : 0;
  const endTrim = headNeedsTrim(endType) ? safeSize : 0;
  const start = curvePoints[0], end = curvePoints.at(-1);
  const headAt = (type, tip, base, fallbackAxis) => {
    const length = Math.hypot(tip.x - base.x, tip.y - base.y);
    return makeArrowHead(type, tip, length > 1e-6 ? vectorBetween(base, tip) : fallbackAxis, length > 1e-6 ? length : safeSize, strokeWidth);
  };
  // Head dimensions are independent of shaft trimming; open heads always have a base.
  const heads = [
    headAt(startType, start, pointAtDistance(curvePoints, safeSize), vectorBetween(curvePoints[1], start)),
    headAt(endType, end, pointAtDistance(curvePoints, totalLength - safeSize), vectorBetween(curvePoints.at(-2), end)),
  ].filter(Boolean);

  return {
    points: trimPolyline(curvePoints, startTrim, endTrim, totalLength),
    curvePoints,
    heads,
    start,
    end,
    startHead: startType,
    endHead: endType,
  };
}
