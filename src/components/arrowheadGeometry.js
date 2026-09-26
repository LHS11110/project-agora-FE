export const DEFAULT_ARROW_START_HEAD = 'none';
export const DEFAULT_ARROW_END_HEAD = 'triangle';

export const ARROW_HEAD_OPTIONS = [
  { value: 'none', label: '없음' },
  { value: 'triangle', label: '삼각형' },
  { value: 'open', label: '열린 화살촉' },
  { value: 'diamond', label: '마름모' },
  { value: 'circle', label: '원형' },
  { value: 'bar', label: '막대' },
];

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

function makeHead(type, tip, axis, size, strokeWidth, basePoint) {
  if (type === 'none') return null;
  const perpendicular = { x: -axis.y, y: axis.x };
  const halfWidth = size * (type === 'diamond' ? 0.34 : 0.42);
  const base = basePoint || { x: tip.x - axis.x * size, y: tip.y - axis.y * size };
  if (type === 'triangle') {
    return {
      type,
      filled: true,
      tip,
      points: [
        tip,
        { x: base.x + perpendicular.x * halfWidth, y: base.y + perpendicular.y * halfWidth },
        { x: base.x - perpendicular.x * halfWidth, y: base.y - perpendicular.y * halfWidth },
      ],
    };
  }
  if (type === 'open') {
    return {
      type,
      tip,
      points: [
        { x: base.x + perpendicular.x * halfWidth, y: base.y + perpendicular.y * halfWidth },
        tip,
        { x: base.x - perpendicular.x * halfWidth, y: base.y - perpendicular.y * halfWidth },
      ],
    };
  }
  if (type === 'diamond') {
    const middle = { x: (tip.x + base.x) / 2, y: (tip.y + base.y) / 2 };
    return {
      type,
      filled: true,
      tip,
      points: [
        tip,
        { x: middle.x + perpendicular.x * halfWidth, y: middle.y + perpendicular.y * halfWidth },
        base,
        { x: middle.x - perpendicular.x * halfWidth, y: middle.y - perpendicular.y * halfWidth },
      ],
    };
  }
  if (type === 'circle') {
    const radius = Math.hypot(tip.x - base.x, tip.y - base.y) / 2;
    const center = { x: (tip.x + base.x) / 2, y: (tip.y + base.y) / 2 };
    return {
      type,
      tip,
      center,
      radius,
      points: Array.from({ length: 12 }, (_, index) => {
        const angle = index / 12 * Math.PI * 2;
        return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
      }),
    };
  }
  if (type === 'bar') {
    const barHalfWidth = Math.max(size * 0.42, Number(strokeWidth) || 1.5);
    return {
      type,
      tip,
      points: [
        { x: tip.x + perpendicular.x * barHalfWidth, y: tip.y + perpendicular.y * barHalfWidth },
        { x: tip.x - perpendicular.x * barHalfWidth, y: tip.y - perpendicular.y * barHalfWidth },
      ],
    };
  }
  return null;
}

export function arrowPathGeometry(points, {
  startHead = DEFAULT_ARROW_START_HEAD,
  endHead = DEFAULT_ARROW_END_HEAD,
  headSize = 14,
  strokeWidth = 2.5,
} = {}) {
  if (!Array.isArray(points) || points.length < 2) return { points: points || [], curvePoints: points || [], heads: [], start: points?.[0], end: points?.at(-1) };

  const curvePoints = points;
  const totalLength = polylineLength(curvePoints);
  const safeSize = Math.max(2, Number(headSize) || 14);
  const startType = normalizeArrowHead(startHead, DEFAULT_ARROW_START_HEAD);
  const endType = normalizeArrowHead(endHead, DEFAULT_ARROW_END_HEAD);
  let startTrim = ['none', 'open', 'bar'].includes(startType) ? 0 : safeSize;
  let endTrim = ['none', 'open', 'bar'].includes(endType) ? 0 : safeSize;
  const requestedTrim = startTrim + endTrim;
  const maxTrim = totalLength * 0.72;
  if (requestedTrim > maxTrim && requestedTrim > 0) {
    const ratio = maxTrim / requestedTrim;
    startTrim *= ratio;
    endTrim *= ratio;
  }

  const startAxis = vectorBetween(curvePoints[1], curvePoints[0]);
  const endAxis = vectorBetween(curvePoints[curvePoints.length - 2], curvePoints[curvePoints.length - 1]);
  const start = curvePoints[0];
  const end = curvePoints[curvePoints.length - 1];
  const startBase = pointAtDistance(curvePoints, startTrim);
  const endBase = pointAtDistance(curvePoints, Math.max(startTrim, totalLength - endTrim));
  const heads = [
    makeHead(startType, start, startAxis, Math.max(2, startTrim || safeSize), strokeWidth, startBase),
    makeHead(endType, end, endAxis, Math.max(2, endTrim || safeSize), strokeWidth, endBase),
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
