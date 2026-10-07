const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
function rectangleBounds(rect, padding) {
  const c = Math.abs(Math.cos(rect.rotation)), s = Math.abs(Math.sin(rect.rotation));
  const x = c * rect.halfWidth + s * rect.halfHeight + padding;
  const y = s * rect.halfWidth + c * rect.halfHeight + padding;
  return { id: rect.id, minX: rect.centerX - x, maxX: rect.centerX + x, minY: rect.centerY - y, maxY: rect.centerY + y };
}
const inside = (p, b) => p.x > b.minX && p.x < b.maxX && p.y > b.minY && p.y < b.maxY;
/** Touching an inflated corner is safe; crossing its interior is not. */
function intersects(a, b, box) {
  if (Math.max(a.x, b.x) <= box.minX || Math.min(a.x, b.x) >= box.maxX || Math.max(a.y, b.y) <= box.minY || Math.min(a.y, b.y) >= box.maxY) return false;
  let low = 0, high = 1;
  for (const [axis, min, max] of [['x', box.minX, box.maxX], ['y', box.minY, box.maxY]]) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-9) { if (a[axis] <= min || a[axis] >= max) return false; continue; }
    const t0 = (min - a[axis]) / delta, t1 = (max - a[axis]) / delta;
    low = Math.max(low, Math.min(t0, t1)); high = Math.min(high, Math.max(t0, t1));
    if (high <= low + 1e-8) return false;
  }
  return high > low + 1e-8;
}
const clear = (a, b, boxes) => !boxes.some(box => intersects(a, b, box));
const pathIsClear = (points, boxes) => points.length >= 2 && points.slice(1).every((point, index) => clear(points[index], point, boxes));
function roundedPath(points) {
  if (points.length < 3) return points;
  const result = [points[0]];
  for (let index = 1; index < points.length - 1; index++) {
    const a = points[index - 1], b = points[index], c = points[index + 1];
    const before = distance(a, b), after = distance(b, c);
    if (before < 1e-6 || after < 1e-6) continue;
    const radius = Math.min(8, before / 3, after / 3);
    const start = { x: b.x + (a.x - b.x) * radius / before, y: b.y + (a.y - b.y) * radius / before };
    const end = { x: b.x + (c.x - b.x) * radius / after, y: b.y + (c.y - b.y) * radius / after };
    result.push(start);
    for (let step = 1; step <= 8; step++) {
      const t = step / 8, u = 1 - t;
      result.push({ x: u * u * start.x + 2 * u * t * b.x + t * t * end.x, y: u * u * start.y + 2 * u * t * b.y + t * t * end.y });
    }
  }
  result.push(points.at(-1)); return result;
}
/** Keep a clear straight/custom curve, otherwise find a rounded detour. */
export function obstacleRoute({ preferred, rectangles, from, to, padding, anchor, preserveBend = false }) {
  // Endpoints define attachment positions only; they are never obstacles.
  const obstacles = rectangles.filter(rect => rect.id !== from.id && rect.id !== to.id);
  const required = obstacles.map(rect => rectangleBounds(rect, padding));
  if (pathIsClear(preferred, required)) return { points: preferred, routed: false };
  const boxes = obstacles.map(rect => rectangleBounds(rect, padding + 12));
  const ports = (rect, other) => {
    const dx = other.centerX - rect.centerX, dy = other.centerY - rect.centerY, length = Math.hypot(dx, dy) || 1;
    const directions = [{ x: dx / length, y: dy / length }, ...[0, 1, 2, 3].map(side => ({ x: Math.cos(rect.rotation + side * Math.PI / 2), y: Math.sin(rect.rotation + side * Math.PI / 2) }))];
    const box = rectangleBounds(rect, padding + 12);
    return directions.map(direction => {
      const tip = anchor(rect, direction, padding);
      const xReach = Math.abs(direction.x) > 1e-8 ? (direction.x > 0 ? box.maxX - rect.centerX : rect.centerX - box.minX) / Math.abs(direction.x) : Infinity;
      const yReach = Math.abs(direction.y) > 1e-8 ? (direction.y > 0 ? box.maxY - rect.centerY : rect.centerY - box.minY) / Math.abs(direction.y) : Infinity;
      const reach = Math.min(xReach, yReach) + 1;
      return { x: rect.centerX + direction.x * reach, y: rect.centerY + direction.y * reach, tip };
    }).filter(port => !boxes.some(candidate => inside(port, candidate)) && clear(port.tip, port, required));
  };
  const starts = ports(from, to), ends = ports(to, from);
  if (!starts.length || !ends.length) return null;
  const nodes = [...starts, ...ends];
  for (const box of boxes) for (const point of [{ x: box.minX - 1, y: box.minY - 1 }, { x: box.maxX + 1, y: box.minY - 1 }, { x: box.maxX + 1, y: box.maxY + 1 }, { x: box.minX - 1, y: box.maxY + 1 }]) {
    if (!boxes.some(candidate => inside(point, candidate))) nodes.push(point);
  }
  const search = (startIndices, isTarget) => {
    const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set();
    startIndices.forEach(index => { costs[index] = index < starts.length ? distance(nodes[index].tip, nodes[index]) : 0; });
    let target = -1;
    while (visited.size < nodes.length) {
      let current = -1;
      for (let index = 0; index < nodes.length; index++) if (!visited.has(index) && (current < 0 || costs[index] < costs[current])) current = index;
      if (current < 0 || !Number.isFinite(costs[current])) break;
      if (isTarget(current)) { target = current; break; }
      visited.add(current);
      for (let index = 0; index < nodes.length; index++) {
        if (visited.has(index) || !clear(nodes[current], nodes[index], boxes)) continue;
        const cost = costs[current] + distance(nodes[current], nodes[index]);
        if (cost < costs[index]) { costs[index] = cost; previous[index] = current; }
      }
    }
    if (target < 0) return null;
    const route = [];
    for (let index = target; index >= 0; index = previous[index]) route.unshift(nodes[index]);
    return { route, target };
  };
  const isEnd = index => index >= starts.length && index < starts.length + ends.length;
  const startIndices = starts.map((_, index) => index);
  let route;
  if (preserveBend) {
    const desired = preferred[Math.floor(preferred.length / 2)];
    let guide;
    if (!boxes.some(box => inside(desired, box))) { guide = nodes.length; nodes.push(desired); }
    else {
      guide = nodes.reduce((best, node, index) => distance(node, desired) < distance(nodes[best], desired) ? index : best, 0);
    }
    const first = search(startIndices, index => index === guide);
    const second = first && search([guide], isEnd);
    if (first && second) route = [...first.route, ...second.route.slice(1)];
  }
  if (!route) route = search(startIndices, isEnd)?.route;
  if (!route) return null;
  const middle = roundedPath(route);
  const points = [route[0].tip, ...middle, route.at(-1).tip];
  if (!pathIsClear(points, required) || !pathIsClear(middle, required)) return null;
  return { points, routed: true };
}
