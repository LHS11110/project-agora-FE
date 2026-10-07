export const MAX_BEND_POINTS = 32;
export const connectorPointCount = item => Math.max(1, Math.min(MAX_BEND_POINTS, Math.trunc(Number(item?.bendPointCount) || item?.bendPoints?.length || 1)));
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export function connectorControlHandles(item, start, end) {
  const count = connectorPointCount(item), dx = end.x - start.x, dy = end.y - start.y;
  const gap = Math.max(1, Math.hypot(dx, dy)), angle = (Number(item.rotation) || 0) * Math.PI / 180;
  const direction = { x: dx / gap, y: dy / gap }, normal = { x: -direction.y, y: direction.x };
  return Array.from({ length: count }, (_, index) => {
    const t = (index + 1) / (count + 1), base = lerp(start, end, t);
    const point = item.bendPoints?.[index] || { x: 0, y: 10 * t * t * (1 - t) ** 2 * (Number(item.bend) || 0) };
    const x = point.x * Math.cos(angle) - point.y * Math.sin(angle), y = point.x * Math.sin(angle) + point.y * Math.cos(angle);
    return { x: base.x + gap * (direction.x * x + normal.x * y), y: base.y + gap * (direction.y * x + normal.y * y) };
  });
}
function encodePoint(item, start, end, point, index, count) {
  const gap = Math.max(1, Math.hypot(end.x - start.x, end.y - start.y));
  const base = lerp(start, end, (index + 1) / (count + 1));
  const dx = (end.x - start.x) / gap, dy = (end.y - start.y) / gap;
  const x = ((point.x - base.x) * dx + (point.y - base.y) * dy) / gap;
  const y = (-(point.x - base.x) * dy + (point.y - base.y) * dx) / gap;
  const angle = (Number(item.rotation) || 0) * Math.PI / 180;
  return { x: x * Math.cos(angle) + y * Math.sin(angle), y: -x * Math.sin(angle) + y * Math.cos(angle) };
}
export function resizeConnectorControls(item, geometry, count) {
  const nextCount = Math.max(1, Math.min(MAX_BEND_POINTS, Math.trunc(Number(count) || 1)));
  const start = geometry?.bendStart, end = geometry?.bendEnd;
  const points = geometry?.controlSourcePoints || geometry?.curvePoints;
  if (!start || !end || !points?.length) return { bendPointCount: nextCount, bendPoints: Array.from({ length: nextCount }, () => ({ x: 0, y: 0 })) };
  return { bendPointCount: nextCount, bendPoints: Array.from({ length: nextCount }, (_, index) => {
    const position = (index + 1) / (nextCount + 1) * (points.length - 1), low = Math.floor(position);
    return encodePoint(item, start, end, lerp(points[low], points[Math.min(low + 1, points.length - 1)], position - low), index, nextCount);
  }) };
}
export function connectorControlFromPointer(item, geometry, pointer, viewSize, index) {
  if (!geometry?.bendStart || !geometry?.bendEnd) return {};
  const count = connectorPointCount(item);
  if (!Number.isInteger(index) || index < 0 || index >= count) return {};
  const handles = connectorControlHandles(item, geometry.bendStart, geometry.bendEnd);
  const bendPoints = handles.map((point, i) => encodePoint(item, geometry.bendStart, geometry.bendEnd, point, i, count));
  bendPoints[index] = encodePoint(item, geometry.bendStart, geometry.bendEnd, { x: pointer.x * viewSize.width, y: pointer.y * viewSize.height }, index, count);
  return { bendPointCount: count, bendPoints, bend: Math.min(1.5, Math.max(...bendPoints.map(point => Math.hypot(point.x, point.y))) / 0.625) };
}
export function connectorBendPatch(item, bend) {
  if (!item.bendPoints?.length) return { bend };
  const previous = Math.max(...item.bendPoints.map(point => Math.hypot(point.x, point.y))) / 0.625;
  return { bend, bendPoints: item.bendPoints.map((point, index) => {
    if (bend === 0) return { x: 0, y: 0 };
    if (previous > 1e-8) return { x: point.x * bend / previous, y: point.y * bend / previous };
    const t = (index + 1) / (item.bendPoints.length + 1);
    return { x: 0, y: 10 * t * t * (1 - t) ** 2 * bend };
  }) };
}
/** Smooth interpolating cubic segments: every editable handle lies on the curve. */
export function sampleControlCurve(knots) {
  const tangent = knots.map((point, index) => {
    const before = knots[Math.max(0, index - 1)], after = knots[Math.min(knots.length - 1, index + 1)];
    const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy) || 1;
    const reach = index === 0 ? Math.hypot(after.x - point.x, after.y - point.y) : index === knots.length - 1 ? Math.hypot(point.x - before.x, point.y - before.y) : Math.min(Math.hypot(point.x - before.x, point.y - before.y), Math.hypot(after.x - point.x, after.y - point.y));
    return { x: dx / length * reach / 3, y: dy / length * reach / 3 };
  });
  const result = [knots[0]];
  for (let index = 0; index < knots.length - 1; index++) {
    const a = knots[index], d = knots[index + 1], b = { x: a.x + tangent[index].x, y: a.y + tangent[index].y }, c = { x: d.x - tangent[index + 1].x, y: d.y - tangent[index + 1].y };
    for (let step = 1; step <= 16; step++) {
      const t = step / 16, u = 1 - t;
      result.push({ x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x, y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y });
    }
  }
  return result;
}
