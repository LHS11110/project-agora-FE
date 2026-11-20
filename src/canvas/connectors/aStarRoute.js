import MinHeap from '../MinHeap.js';

const spatialIndexByItems = new WeakMap();

export function registerSpatialIndex(items, index) {
  if (items && typeof items === 'object' && index) {
    spatialIndexByItems.set(items, index);
  }
}

export function lookupSpatialIndex(items) {
  return items && typeof items === 'object' ? spatialIndexByItems.get(items) || null : null;
}

export function rectCoreBounds(rect, padding = 0) {
  const angle = Number(rect.rotation) || 0;
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  const rx = Math.max(0, c * (rect.halfWidth || 0) + s * (rect.halfHeight || 0) + padding);
  const ry = Math.max(0, s * (rect.halfWidth || 0) + c * (rect.halfHeight || 0) + padding);
  return {
    id: rect.id,
    minX: Math.floor(rect.centerX - rx),
    minY: Math.floor(rect.centerY - ry),
    maxX: Math.ceil(rect.centerX + rx),
    maxY: Math.ceil(rect.centerY + ry),
  };
}

export function boxesOverlap(a, b, margin = 0) {
  return !(a.maxX + margin < b.minX || b.maxX + margin < a.minX || a.maxY + margin < b.minY || b.maxY + margin < a.minY);
}

/** True only when the two boxes genuinely overlap in interior area (by > inset px), never when merely adjacent/touching. */
export function boxesStrictlyOverlap(a, b, inset = 2) {
  return (
    a.minX + inset < b.maxX &&
    b.minX + inset < a.maxX &&
    a.minY + inset < b.maxY &&
    b.minY + inset < a.maxY
  );
}

function pointInsideBox(point, box, eps = 1e-6) {
  return point.x > box.minX + eps && point.x < box.maxX - eps && point.y > box.minY + eps && point.y < box.maxY - eps;
}

/** Exact Liang-Barsky / slab intersection against an AABB; touching outer boundary stays clear. */
export function segmentIntersectsBox(a, b, box) {
  if (Math.max(a.x, b.x) <= box.minX || Math.min(a.x, b.x) >= box.maxX || Math.max(a.y, b.y) <= box.minY || Math.min(a.y, b.y) >= box.maxY) {
    return false;
  }
  let low = 0;
  let high = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 1e-9) {
    if (a.x <= box.minX || a.x >= box.maxX) return false;
  } else {
    const t0 = (box.minX - a.x) / dx;
    const t1 = (box.maxX - a.x) / dx;
    low = Math.max(low, Math.min(t0, t1));
    high = Math.min(high, Math.max(t0, t1));
    if (high <= low + 1e-8) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (a.y <= box.minY || a.y >= box.maxY) return false;
  } else {
    const t0 = (box.minY - a.y) / dy;
    const t1 = (box.maxY - a.y) / dy;
    low = Math.max(low, Math.min(t0, t1));
    high = Math.min(high, Math.max(t0, t1));
    if (high <= low + 1e-8) return false;
  }
  return high > low + 1e-8;
}

export function pathIntersectsBoxes(points, boxes) {
  if (!Array.isArray(points) || points.length < 2 || !boxes?.length) return false;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    for (let j = 0; j < boxes.length; j++) {
      if (segmentIntersectsBox(a, b, boxes[j])) return true;
    }
  }
  return false;
}

function dedupeCoords(values, minGap = 1, importantSet = null) {
  const sorted = [...values].map((v) => Math.round(v)).sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    const v = sorted[i];
    if (!result.length) {
      result.push(v);
      continue;
    }
    const prev = result[result.length - 1];
    if (v === prev) continue;
    if (v - prev >= minGap || importantSet?.has(v) || importantSet?.has(prev)) {
      result.push(v);
    }
  }
  return result;
}

function addSubdivisions(coords, minVal, maxVal, maxCells) {
  if (coords.length >= maxCells) return coords;
  const budget = maxCells - coords.length;
  const span = maxVal - minVal;
  if (span <= 0 || budget <= 0) return coords;
  const step = Math.max(24, Math.ceil(span / Math.max(4, budget)));
  const out = new Set(coords);
  for (let x = minVal + step; x < maxVal; x += step) {
    out.add(Math.round(x));
    if (out.size >= maxCells) break;
  }
  return [...out].sort((a, b) => a - b);
}

function addGapMidpoints(boxes, axis, rawSet, importantSet) {
  if (boxes.length < 2) return;
  const intervals = boxes
    .map((b) => (axis === 'x' ? [b.minX, b.maxX] : [b.minY, b.maxY]))
    .sort((a, b) => a[0] - b[0]);
  let maxEnd = intervals[0][1];
  for (let i = 1; i < intervals.length; i++) {
    const [start, end] = intervals[i];
    const gap = start - maxEnd;
    if (gap >= 0 && gap <= 40) {
      const mid = Math.round((maxEnd + start) / 2);
      rawSet.add(mid);
      importantSet.add(mid);
    }
    if (end > maxEnd) maxEnd = end;
  }
}

function buildStubs(rect, other, coreObsBoxes, padObsBoxes, anchorFn, stubDist, fixedPort = null) {
  const core = rectCoreBounds(rect, 0);
  const innerCore = rectCoreBounds(rect, -1);
  const stubs = [];
  const seen = new Set();

  const tryCandidate = (tip, stub, primary, dir, shortPenalty = 0) => {
    const key = `${Math.round(tip.x)}:${Math.round(tip.y)}->${stub.x}:${stub.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (pointInsideBox(stub, core)) return false;
    if (padObsBoxes.some((b) => pointInsideBox(stub, b))) return false;
    if (coreObsBoxes.some((b) => pointInsideBox(tip, b, -0.25) || segmentIntersectsBox(tip, stub, b))) return false;
    if (segmentIntersectsBox(tip, stub, innerCore)) return false;
    stubs.push({ tip, stub, primary, dir, penalty: (primary ? 0 : 8) + shortPenalty });
    return true;
  };

  if (fixedPort && Number.isFinite(fixedPort.x) && Number.isFinite(fixedPort.y)) {
    const nx = Number(fixedPort.nx) || 0;
    const ny = Number(fixedPort.ny) || 0;
    const nLen = Math.hypot(nx, ny) || 1;
    const ux = nx / nLen;
    const uy = ny / nLen;
    const tip = { x: fixedPort.x, y: fixedPort.y };
    const dists = [stubDist, Math.max(4, Math.round(stubDist * 0.5)), 2, Math.round(stubDist * 1.6)];
    for (let i = 0; i < dists.length; i++) {
      const d = dists[i];
      const sx = Math.round(tip.x + ux * d);
      const sy = Math.round(tip.y + uy * d);
      tryCandidate(tip, { x: sx, y: sy }, i === 0, { x: ux, y: uy }, i * 4);
      // Tangential escape offsets outside the fixed port face if straight ahead is blocked
      const tx = -uy;
      const ty = ux;
      for (const side of [-1, 1]) {
        const ox = Math.round(tip.x + ux * Math.max(3, Math.round(d * 0.6)) + tx * side * d);
        const oy = Math.round(tip.y + uy * Math.max(3, Math.round(d * 0.6)) + ty * side * d);
        tryCandidate(tip, { x: ox, y: oy }, false, { x: ux, y: uy }, 6 + i * 4);
      }
    }
    return stubs;
  }

  const dx = other.centerX - rect.centerX;
  const dy = other.centerY - rect.centerY;
  const len = Math.hypot(dx, dy) || 1;
  const baseAngle = Number(rect.rotation) || 0;

  const dirs = [
    { x: dx / len, y: dy / len, primary: true, offset: false },
    { x: 1, y: 0, primary: false, offset: false },
    { x: 0, y: 1, primary: false, offset: false },
    { x: -1, y: 0, primary: false, offset: false },
    { x: 0, y: -1, primary: false, offset: false },
  ];

  // Add face quarter-offset rays so an obstacle blocking just the face center still allows clean exit
  const hw = Math.max(4, rect.halfWidth || 0);
  const hh = Math.max(4, rect.halfHeight || 0);
  const offsetTargets = [
    [hw, hh * 0.55], [hw, -hh * 0.55],
    [-hw, hh * 0.55], [-hw, -hh * 0.55],
    [hw * 0.55, hh], [-hw * 0.55, hh],
    [hw * 0.55, -hh], [-hw * 0.55, -hh],
  ];
  const cosA = Math.cos(baseAngle);
  const sinA = Math.sin(baseAngle);
  for (const [lx, ly] of offsetTargets) {
    const rx = lx * cosA - ly * sinA;
    const ry = lx * sinA + ly * cosA;
    const rLen = Math.hypot(rx, ry) || 1;
    dirs.push({ x: rx / rLen, y: ry / rLen, primary: false, offset: true });
  }

  if (Math.abs(baseAngle) > 1e-4) {
    for (let s = 0; s < 4; s++) {
      const a = baseAngle + (s * Math.PI) / 2;
      dirs.push({ x: Math.cos(a), y: Math.sin(a), primary: false, offset: false });
    }
  }

  const tryDistances = stubDist > 4 ? [stubDist, Math.max(3, Math.round(stubDist * 0.5)), 2] : [stubDist, 2];

  for (let dIdx = 0; dIdx < tryDistances.length; dIdx++) {
    const d = tryDistances[dIdx];
    const penalty = dIdx * 6;
    for (const dir of dirs) {
      const tip = anchorFn(rect, dir);
      // Determine which side of the object the tip actually lies on, normalized by aspect ratio
      const relX = (tip.x - rect.centerX) / Math.max(1, hw);
      const relY = (tip.y - rect.centerY) / Math.max(1, hh);
      const horizontalDominant = Math.abs(relX) >= Math.abs(relY);
      const stub = horizontalDominant
        ? {
            x: Math.round((relX >= 0 ? Math.max(core.maxX + d, tip.x + d) : Math.min(core.minX - d, tip.x - d))),
            y: Math.round(tip.y),
          }
        : {
            x: Math.round(tip.x),
            y: Math.round((relY >= 0 ? Math.max(core.maxY + d, tip.y + d) : Math.min(core.minY - d, tip.y - d))),
          };
      tryCandidate(tip, stub, dir.primary && dIdx === 0, dir, penalty + (dir.offset ? 4 : 0));
    }
    if (stubs.length >= 2) break;
  }

  return stubs;
}

function removeCollinear(points) {
  if (points.length <= 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1];
    const b = points[i];
    const c = points[i + 1];
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.5) continue;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6 && ((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y) >= 0)) {
      continue;
    }
    out.push(b);
  }
  const last = points[points.length - 1];
  if (Math.hypot(last.x - out[out.length - 1].x, last.y - out[out.length - 1].y) >= 0.5) {
    out.push(last);
  } else if (out.length >= 2) {
    out[out.length - 1] = last;
  }
  return out;
}

function smoothCornerPolyline(waypoints, interiorGuardBoxes, terminalGuardBoxes, maxCornerRadius = 30) {
  if (waypoints.length <= 2) return waypoints;
  const result = [waypoints[0]];
  const lastIdx = waypoints.length - 1;
  for (let i = 1; i < lastIdx; i++) {
    const prev = waypoints[i - 1];
    const corner = waypoints[i];
    const next = waypoints[i + 1];
    const lenIn = Math.hypot(corner.x - prev.x, corner.y - prev.y);
    const lenOut = Math.hypot(next.x - corner.x, next.y - corner.y);
    if (lenIn < 2 || lenOut < 2) {
      result.push(corner);
      continue;
    }
    const ux1 = (corner.x - prev.x) / lenIn;
    const uy1 = (corner.y - prev.y) / lenIn;
    const ux2 = (next.x - corner.x) / lenOut;
    const uy2 = (next.y - corner.y) / lenOut;
    if (ux1 * ux2 + uy1 * uy2 > 0.995) {
      result.push(corner);
      continue;
    }

    const isTerminal = i === 1 || i === lastIdx - 1;
    const checkBoxes = isTerminal ? terminalGuardBoxes : interiorGuardBoxes;
    let r = Math.min(maxCornerRadius, lenIn * 0.42, lenOut * 0.42);
    let chosenArc = null;
    for (let attempt = 0; attempt < 5 && r >= 2; attempt++) {
      const q0 = { x: corner.x - ux1 * r, y: corner.y - uy1 * r };
      const q2 = { x: corner.x + ux2 * r, y: corner.y + uy2 * r };
      const arc = [q0];
      const steps = 8;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const u = 1 - t;
        arc.push({
          x: u * u * q0.x + 2 * u * t * corner.x + t * t * q2.x,
          y: u * u * q0.y + 2 * u * t * corner.y + t * t * q2.y,
        });
      }
      if (!pathIntersectsBoxes(arc, checkBoxes)) {
        chosenArc = arc;
        break;
      }
      r *= 0.5;
    }
    if (chosenArc) {
      for (const p of chosenArc) result.push(p);
    } else {
      result.push(corner);
    }
  }
  result.push(waypoints[lastIdx]);
  return result;
}

// Uniform buckets over obstacle boxes. A segment can only hit a box whose AABB
// overlaps its own (segmentIntersectsBox's early exit), so testing the boxes in
// the buckets under the segment's AABB gives exactly the same answer as testing
// every box, without O(segments x obstacles) work on dense canvases.
export class BoxBuckets {
  constructor(boxes, cell = 64) {
    this.boxes = boxes; this.cell = cell; this.stamp = new Uint32Array(boxes.length); this.query = 0;
    this.buckets = new Map(); this.always = [];
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (![b.minX, b.minY, b.maxX, b.maxY].every(Number.isFinite)) { this.always.push(i); continue; }
      const x0 = Math.floor(b.minX / cell), x1 = Math.floor(b.maxX / cell), y0 = Math.floor(b.minY / cell), y1 = Math.floor(b.maxY / cell);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4096) { this.always.push(i); continue; }
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        const key = cx * 1048576 + cy; let list = this.buckets.get(key);
        if (!list) this.buckets.set(key, list = []);
        list.push(i);
      }
    }
  }
  segmentHits(a, b) {
    const boxes = this.boxes, stamp = this.stamp, mark = ++this.query;
    for (const i of this.always) if (segmentIntersectsBox(a, b, boxes[i])) return true;
    const cell = this.cell;
    const x0 = Math.floor(Math.min(a.x, b.x) / cell), x1 = Math.floor(Math.max(a.x, b.x) / cell);
    const y0 = Math.floor(Math.min(a.y, b.y) / cell), y1 = Math.floor(Math.max(a.y, b.y) / cell);
    if (!Number.isFinite(x0 + x1 + y0 + y1) || (x1 - x0 + 1) * (y1 - y0 + 1) > 4096) {
      for (let i = 0; i < boxes.length; i++) if (segmentIntersectsBox(a, b, boxes[i])) return true;
      return false;
    }
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const list = this.buckets.get(cx * 1048576 + cy);
      if (!list) continue;
      for (const i of list) {
        if (stamp[i] === mark) continue;
        stamp[i] = mark;
        if (segmentIntersectsBox(a, b, boxes[i])) return true;
      }
    }
    return false;
  }
}

// Keep turns, ends and points every `spacing` px along straight runs: shortcut
// candidates stay spread along the path while dense grid crossings are dropped.
function thinStraightRuns(points, spacing) {
  const out = [points[0]];
  let last = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], p = points[i], b = points[i + 1];
    const turn = Math.abs((p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x)) > 1e-9;
    if (turn || Math.hypot(p.x - last.x, p.y - last.y) >= spacing) { out.push(p); last = p; }
  }
  out.push(points[points.length - 1]);
  return out;
}

function* shortcutClearSegmentsSteps(points, guardBoxes) {
  const n = points.length;
  if (n <= 2) return points;
  const guard = new BoxBuckets(guardBoxes);
  const dist = new Float64Array(n);
  const prev = new Int32Array(n);
  dist.fill(Infinity);
  prev.fill(-1);
  dist[0] = 0;

  for (let j = 1; j < n; j++) {
    if ((j & 31) === 0) yield;
    const stepLen = Math.hypot(points[j].x - points[j - 1].x, points[j].y - points[j - 1].y);
    dist[j] = dist[j - 1] + stepLen;
    prev[j] = j - 1;

    for (let i = 0; i < j - 1; i++) {
      const candidateDist = dist[i] + Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y);
      if (candidateDist + 1e-3 >= dist[j]) continue;
      if (!guard.segmentHits(points[i], points[j])) {
        dist[j] = candidateDist;
        prev[j] = i;
      }
    }
  }

  const out = [];
  for (let cur = n - 1; cur >= 0; cur = prev[cur]) {
    out.push(points[cur]);
    if (cur === 0) break;
  }
  out.reverse();
  return out;
}

// Index of the first sorted value strictly greater than v (length if none).
function firstIndexAbove(values, v) {
  let lo = 0, hi = values.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (values[mid] > v) hi = mid; else lo = mid + 1; }
  return lo;
}
// Index of the last sorted value strictly less than v (-1 if none).
function lastIndexBelow(values, v) {
  let lo = 0, hi = values.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (values[mid] < v) lo = mid + 1; else hi = mid; }
  return lo - 1;
}

const MAX_EXPANSIONS = 150000;
// Shared by every clearance pass and region of one route.
const ROUTE_EXPANSION_BUDGET = 400000;
function* runGridAStarSteps(starts, ends, xs, ys, blockedBoxes, cornerBoxes, budget = { left: Infinity }) {
  const cols = xs.length;
  const rows = ys.length;
  if (!cols || !rows) return null;

  const xIndex = new Map();
  for (let i = 0; i < cols; i++) xIndex.set(xs[i], i);
  const yIndex = new Map();
  for (let j = 0; j < rows; j++) yIndex.set(ys[j], j);

  const validStarts = starts.filter((s) => xIndex.has(s.stub.x) && yIndex.has(s.stub.y));
  const validEnds = ends.filter((e) => xIndex.has(e.stub.x) && yIndex.has(e.stub.y));
  if (!validStarts.length || !validEnds.length) return null;

  const goalCells = new Map();
  for (const e of validEnds) {
    const cell = yIndex.get(e.stub.y) * cols + xIndex.get(e.stub.x);
    const existing = goalCells.get(cell);
    if (!existing || (e.penalty || 0) < (existing.penalty || 0)) {
      goalCells.set(cell, e);
    }
  }
  const startCells = new Set(validStarts.map((s) => yIndex.get(s.stub.y) * cols + xIndex.get(s.stub.x)));

  // Testing every grid edge against every obstacle made routing O(cells x
  // obstacles) and froze the page on dense canvases. An axis-aligned edge can
  // only hit a box that strictly spans its fixed coordinate and overlaps its
  // span (segmentIntersectsBox's own early exit), so visit just those edges and
  // keep the exact test for them.
  const hBlocked = new Uint8Array(rows * Math.max(0, cols - 1));
  const vBlocked = new Uint8Array(Math.max(0, rows - 1) * cols);
  const a = { x: 0, y: 0 }, b = { x: 0, y: 0 };
  let marked = 0;
  for (const box of blockedBoxes) {
    if ((++marked & 31) === 0) yield;
    // Horizontal edges: rows with minY < y < maxY, edges with x1 > minX and x0 < maxX.
    const rowFrom = firstIndexAbove(ys, box.minY), rowTo = lastIndexBelow(ys, box.maxY);
    const segFrom = Math.max(0, firstIndexAbove(xs, box.minX) - 1), segTo = Math.min(cols - 2, lastIndexBelow(xs, box.maxX));
    for (let yIdx = rowFrom; yIdx <= rowTo; yIdx++) {
      a.y = b.y = ys[yIdx];
      for (let xIdx = segFrom; xIdx <= segTo; xIdx++) {
        const edge = yIdx * (cols - 1) + xIdx;
        if (hBlocked[edge]) continue;
        a.x = xs[xIdx]; b.x = xs[xIdx + 1];
        // An edge wholly within the box clips to t in [0, 1]: always blocked.
        if ((a.x >= box.minX && b.x <= box.maxX) || segmentIntersectsBox(a, b, box)) hBlocked[edge] = 1;
      }
    }
    // Vertical edges: columns with minX < x < maxX, edges with y1 > minY and y0 < maxY.
    const colFrom = firstIndexAbove(xs, box.minX), colTo = lastIndexBelow(xs, box.maxX);
    const vSegFrom = Math.max(0, firstIndexAbove(ys, box.minY) - 1), vSegTo = Math.min(rows - 2, lastIndexBelow(ys, box.maxY));
    for (let xIdx = colFrom; xIdx <= colTo; xIdx++) {
      a.x = b.x = xs[xIdx];
      for (let yIdx = vSegFrom; yIdx <= vSegTo; yIdx++) {
        const edge = yIdx * cols + xIdx;
        if (vBlocked[edge]) continue;
        a.y = ys[yIdx]; b.y = ys[yIdx + 1];
        if ((a.y >= box.minY && b.y <= box.maxY) || segmentIntersectsBox(a, b, box)) vBlocked[edge] = 1;
      }
    }
  }
  const hOpen = hBlocked.map(blocked => blocked ? 0 : 1);
  const vOpen = vBlocked.map(blocked => blocked ? 0 : 1);
  // Cells strictly inside a clearance box (pointInsideBox), precomputed once
  // instead of scanning every box for each expanded neighbour.
  const cornerCell = new Uint8Array(rows * cols);
  for (const box of cornerBoxes) {
    const x0 = firstIndexAbove(xs, box.minX + 1e-6), x1 = lastIndexBelow(xs, box.maxX - 1e-6);
    const y0 = firstIndexAbove(ys, box.minY + 1e-6), y1 = lastIndexBelow(ys, box.maxY - 1e-6);
    for (let yIdx = y0; yIdx <= y1; yIdx++) cornerCell.fill(1, yIdx * cols + x0, yIdx * cols + Math.max(x0, x1 + 1));
  }

  const totalStates = rows * cols * 5;
  const gScore = new Float64Array(totalStates);
  gScore.fill(Infinity);
  const parent = new Int32Array(totalStates);
  parent.fill(-1);
  const closed = new Uint8Array(totalStates);
  const startSource = new Map();

  const heuristic = (px, py) => {
    let best = Infinity;
    for (let i = 0; i < validEnds.length; i++) {
      const ex = validEnds[i].stub.x;
      const ey = validEnds[i].stub.y;
      const d = Math.abs(px - ex) + Math.abs(py - ey);
      if (d < best) best = d;
    }
    return best;
  };

  const heap = new MinHeap((a, b) => a.f - b.f);
  for (const s of validStarts) {
    const cell = yIndex.get(s.stub.y) * cols + xIndex.get(s.stub.x);
    const state = cell * 5 + 4;
    const initCost = Math.hypot(s.stub.x - s.tip.x, s.stub.y - s.tip.y) + (s.penalty || 0);
    if (initCost < gScore[state]) {
      gScore[state] = initCost;
      startSource.set(cell, s);
      heap.push({ state, f: initCost + heuristic(s.stub.x, s.stub.y) });
    }
  }

  const TURN_PENALTY = 26;
  let reachedState = -1;
  let reachedEnd = null;
  let bestFinishCost = Infinity;

  let expanded = 0;
  while (heap.length > 0) {
    if ((++expanded & 2047) === 0) yield;
    // A search this large is a maze or an unreachable target; treating it as
    // no path keeps one connector from costing hundreds of milliseconds.
    if (expanded > MAX_EXPANSIONS || --budget.left < 0) return null;
    const current = heap.pop();
    const s = current.state;
    if (closed[s]) continue;
    closed[s] = 1;

    const dir = s % 5;
    const cell = (s - dir) / 5;
    const yIdx = Math.floor(cell / cols);
    const xIdx = cell - yIdx * cols;

    const endMatch = goalCells.get(cell);
    if (endMatch) {
      const totalCost = gScore[s] + Math.hypot(endMatch.stub.x - endMatch.tip.x, endMatch.stub.y - endMatch.tip.y) + (endMatch.penalty || 0);
      if (totalCost < bestFinishCost) {
        bestFinishCost = totalCost;
        reachedState = s;
        reachedEnd = endMatch;
        break;
      }
    }

    const px = xs[xIdx];
    const py = ys[yIdx];
    const gBase = gScore[s];

    // Same neighbour order as before (right, down, left, up) so heap ties
    // resolve identically; no per-expansion arrays.
    for (let k = 0; k < 4; k++) {
      let nCell, stepLen;
      if (k === 0) { if (!(xIdx + 1 < cols && hOpen[yIdx * (cols - 1) + xIdx])) continue; nCell = yIdx * cols + xIdx + 1; stepLen = xs[xIdx + 1] - px; }
      else if (k === 1) { if (!(yIdx + 1 < rows && vOpen[yIdx * cols + xIdx])) continue; nCell = (yIdx + 1) * cols + xIdx; stepLen = ys[yIdx + 1] - py; }
      else if (k === 2) { if (!(xIdx - 1 >= 0 && hOpen[yIdx * (cols - 1) + xIdx - 1])) continue; nCell = yIdx * cols + xIdx - 1; stepLen = px - xs[xIdx - 1]; }
      else { if (!(yIdx - 1 >= 0 && vOpen[(yIdx - 1) * cols + xIdx])) continue; nCell = (yIdx - 1) * cols + xIdx; stepLen = py - ys[yIdx - 1]; }
      const nDir = k;
      const nState = nCell * 5 + nDir;
      if (closed[nState]) continue;
      let cornerBias = 0;
      const nYIdx = Math.floor(nCell / cols);
      const nXIdx = nCell - nYIdx * cols;
      const nx = xs[nXIdx];
      const ny = ys[nYIdx];
      if (cornerCell[nCell] && !startCells.has(nCell) && !goalCells.has(nCell)) {
        cornerBias = 12;
      }
      const turnCost = dir !== 4 && dir !== nDir ? TURN_PENALTY : 0;
      const candG = gBase + stepLen + turnCost + cornerBias;
      if (candG < gScore[nState]) {
        gScore[nState] = candG;
        parent[nState] = s;
        heap.push({ state: nState, f: candG + heuristic(nx, ny) });
      }
    }
  }

  if (reachedState < 0 || !reachedEnd) return null;

  const gridWaypoints = [];
  let trace = reachedState;
  let rootCell = 0;
  while (trace >= 0) {
    const d = trace % 5;
    const c = (trace - d) / 5;
    rootCell = c;
    const yi = Math.floor(c / cols);
    const xi = c - yi * cols;
    gridWaypoints.push({ x: xs[xi], y: ys[yi] });
    trace = parent[trace];
  }
  gridWaypoints.reverse();
  const startMatch = startSource.get(rootCell) || validStarts[0];
  return { startMatch, endMatch: reachedEnd, gridWaypoints };
}

/**
 * Grid-based A* connector router with progressive clearance fallback and obstacle-safe Bezier curves.
 */
export function* routeConnectorAStarSteps({
  from,
  to,
  preferredPoints,
  obstacles = [],
  clearance = 14,
  anchorFn,
  guides = null,
  keepOrthogonal = false,
  fromPort = null,
  toPort = null,
}) {
  const fromCore = rectCoreBounds(from, 0);
  const toCore = rectCoreBounds(to, 0);

  // Exclude only obstacles whose interiors genuinely overlap an endpoint (e.g. children inside a connected frame).
  // Adjacent/touching obstacles (0..2px away) are preserved so connectors never cut through them.
  const activeObstacles = [];
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    if (!obs || obs.id === from.id || obs.id === to.id) continue;
    const obsCore = rectCoreBounds(obs, 0);
    if (boxesStrictlyOverlap(obsCore, fromCore, 2) || boxesStrictlyOverlap(obsCore, toCore, 2)) continue;
    activeObstacles.push(obs);
  }

  if (!activeObstacles.length) {
    return { points: preferredPoints, routed: false, corridor: null };
  }

  const reqPad = Math.max(6, Math.round(clearance * 0.6));
  const requiredBoxes = activeObstacles.map((obs) => rectCoreBounds(obs, reqPad));
  const coreObsBoxes = activeObstacles.map((obs) => rectCoreBounds(obs, 1));
  const exactObsBoxes = activeObstacles.map((obs) => rectCoreBounds(obs, 0));
  const endpointCores = [rectCoreBounds(from, 2), rectCoreBounds(to, 2)];

  const preferredBlocked =
    pathIntersectsBoxes(preferredPoints, requiredBoxes) ||
    pathIntersectsBoxes(preferredPoints, exactObsBoxes) ||
    (preferredPoints.length >= 3 && pathIntersectsBoxes(preferredPoints.slice(1, -1), endpointCores));

  if (!preferredBlocked) {
    return {
      points: preferredPoints,
      routed: false,
      corridor: null,
    };
  }

  // Progressive clearance ladder: try ideal smooth clearance first, then tighten for narrow gaps so A*
  // never falls back to a colliding straight line whenever any valid detour or gap exists.
  const passes = [
    { pad: Math.max(10, Math.round(clearance)), stubLen: Math.max(12, Math.round(clearance)), endpointPad: 2, hardCores: coreObsBoxes },
    { pad: Math.max(4, Math.round(clearance * 0.4)), stubLen: Math.max(6, Math.round(clearance * 0.5)), endpointPad: 1, hardCores: coreObsBoxes },
    { pad: 1, stubLen: 3, endpointPad: 1, hardCores: coreObsBoxes },
    { pad: 0, stubLen: 2, endpointPad: 0, hardCores: exactObsBoxes },
  ];

  let chosen = null;
  let chosenPass = null;
  let chosenBounds = null;
  const searchBudget = { left: ROUTE_EXPANSION_BUDGET };

  for (let pIdx = 0; pIdx < passes.length; pIdx++) {
    const pass = passes[pIdx];
    const passObsBoxes = pass.pad > 0
      ? activeObstacles.map((obs) => rectCoreBounds(obs, pass.pad))
      : exactObsBoxes;
    const starts = buildStubs(from, to, pass.hardCores, passObsBoxes, anchorFn, pass.stubLen, fromPort);
    const ends = buildStubs(to, from, pass.hardCores, passObsBoxes, anchorFn, pass.stubLen, toPort);
    if (!starts.length || !ends.length) continue;

    let baseMinX = Math.min(fromCore.minX, toCore.minX);
    let baseMinY = Math.min(fromCore.minY, toCore.minY);
    let baseMaxX = Math.max(fromCore.maxX, toCore.maxX);
    let baseMaxY = Math.max(fromCore.maxY, toCore.maxY);
    for (const s of [...starts, ...ends]) {
      baseMinX = Math.min(baseMinX, s.stub.x); baseMaxX = Math.max(baseMaxX, s.stub.x);
      baseMinY = Math.min(baseMinY, s.stub.y); baseMaxY = Math.max(baseMaxY, s.stub.y);
    }
    if (Array.isArray(guides)) {
      for (const g of guides) {
        if (Number.isFinite(g?.x) && Number.isFinite(g?.y)) {
          baseMinX = Math.min(baseMinX, Math.round(g.x)); baseMaxX = Math.max(baseMaxX, Math.round(g.x));
          baseMinY = Math.min(baseMinY, Math.round(g.y)); baseMaxY = Math.max(baseMaxY, Math.round(g.y));
        }
      }
    }
    const outerPad = Math.max(24, Math.round(clearance * 2));
    // The grid used to span every collected obstacle, i.e. most of a dense
    // canvas (~800x700 cells, hundreds of boxes) for every connector, which
    // froze the page for seconds. Search a region around the endpoints first
    // and widen it once; detours further away are not worth that cost.
    const span = Math.max(baseMaxX - baseMinX, baseMaxY - baseMinY);
    const near = Math.max(outerPad, 160, Math.round(span * 0.35));
    for (const margin of [near, Math.max(near * 3, 480)]) {
      const minX = Math.floor(baseMinX - margin), minY = Math.floor(baseMinY - margin);
      const maxX = Math.ceil(baseMaxX + margin), maxY = Math.ceil(baseMaxY + margin);
      const inRegion = (b) => b.maxX >= minX - 1 && b.minX <= maxX + 1 && b.maxY >= minY - 1 && b.minY <= maxY + 1;
      const regionBoxes = passObsBoxes.filter(inRegion);
      const inside = (v, lo, hi) => v >= lo && v <= hi;

      const importantX = new Set([minX, maxX, ...starts.map((s) => s.stub.x), ...ends.map((e) => e.stub.x)]);
      const importantY = new Set([minY, maxY, ...starts.map((s) => s.stub.y), ...ends.map((e) => e.stub.y)]);
      const rawX = new Set([
        ...importantX,
        fromCore.minX - pass.stubLen,
        fromCore.maxX + pass.stubLen,
        toCore.minX - pass.stubLen,
        toCore.maxX + pass.stubLen,
      ].filter((v) => inside(v, minX, maxX)));
      const rawY = new Set([
        ...importantY,
        fromCore.minY - pass.stubLen,
        fromCore.maxY + pass.stubLen,
        toCore.minY - pass.stubLen,
        toCore.maxY + pass.stubLen,
      ].filter((v) => inside(v, minY, maxY)));

      for (const b of regionBoxes) {
        for (const x of [b.minX - 1, b.maxX + 1]) if (inside(x, minX, maxX)) { rawX.add(x); importantX.add(x); }
        for (const y of [b.minY - 1, b.maxY + 1]) if (inside(y, minY, maxY)) { rawY.add(y); importantY.add(y); }
      }
      const gapX = new Set(), gapY = new Set();
      addGapMidpoints(regionBoxes, 'x', gapX, importantX);
      addGapMidpoints(regionBoxes, 'y', gapY, importantY);
      for (const x of gapX) if (inside(x, minX, maxX)) rawX.add(x);
      for (const y of gapY) if (inside(y, minY, maxY)) rawY.add(y);

      const xs = addSubdivisions(dedupeCoords(rawX, 1, importantX), minX, maxX, 64);
      const ys = addSubdivisions(dedupeCoords(rawY, 1, importantY), minY, maxY, 64);

      const blockedBoxes = [
        ...regionBoxes,
        rectCoreBounds(from, pass.endpointPad),
        rectCoreBounds(to, pass.endpointPad),
      ];

      const aStar = yield* runGridAStarSteps(starts, ends, xs, ys, blockedBoxes, requiredBoxes.filter(inRegion), searchBudget);
      if (aStar) {
        chosen = aStar;
        chosenPass = pass;
        chosenBounds = { minX, minY, maxX, maxY };
        break;
      }
    }
    if (chosen) break;
  }

  if (!chosen || !chosenPass) {
    return {
      points: preferredPoints,
      routed: false,
      corridor: null,
    };
  }

  const shortcutObsGuard = chosenPass.pad >= reqPad
    ? requiredBoxes
    : chosenPass.pad > 0
      ? activeObstacles.map((obs) => rectCoreBounds(obs, chosenPass.pad))
      : exactObsBoxes;
  const passEndpointCores = [
    rectCoreBounds(from, chosenPass.endpointPad),
    rectCoreBounds(to, chosenPass.endpointPad),
  ];
  const interiorGuard = [...shortcutObsGuard, ...chosenPass.hardCores, ...passEndpointCores];
  const terminalGuard = [...shortcutObsGuard, ...chosenPass.hardCores, rectCoreBounds(from, -1), rectCoreBounds(to, -1)];

  const rawMid = keepOrthogonal
    ? removeCollinear(chosen.gridWaypoints)
    // Grid paths list every grid line they cross (hundreds of points); the
    // shortcut pass is quadratic, so keep only the turns on long paths.
    : removeCollinear(yield* shortcutClearSegmentsSteps(chosen.gridWaypoints.length > 48 ? thinStraightRuns(chosen.gridWaypoints, 24) : chosen.gridWaypoints, interiorGuard));
  const cleanedMid = removeCollinear(rawMid);

  const unsmoothedFull = removeCollinear([chosen.startMatch.tip, ...cleanedMid, chosen.endMatch.tip]);
  let fullPath = smoothCornerPolyline(
    unsmoothedFull,
    interiorGuard,
    terminalGuard,
    keepOrthogonal ? 10 : 48
  );
  fullPath = removeCollinear(fullPath);

  // Hard collision safety verification: never allow smoothing or shortcutting to graze obstacle cores.
  if (pathIntersectsBoxes(fullPath, chosenPass.hardCores)) {
    fullPath = unsmoothedFull;
  }
  if (pathIntersectsBoxes(fullPath, exactObsBoxes)) {
    fullPath = removeCollinear([chosen.startMatch.tip, ...chosen.gridWaypoints, chosen.endMatch.tip]);
  }
  if (fullPath.length < 2) fullPath = [chosen.startMatch.tip, chosen.endMatch.tip];

  let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
  for (let i = 0; i < fullPath.length; i++) {
    pMinX = Math.min(pMinX, fullPath[i].x); pMinY = Math.min(pMinY, fullPath[i].y);
    pMaxX = Math.max(pMaxX, fullPath[i].x); pMaxY = Math.max(pMaxY, fullPath[i].y);
  }

  return {
    points: fullPath,
    routed: true,
    handles: [fullPath[Math.floor((fullPath.length - 1) / 2)]],
    corridor: {
      minX: Math.min(chosenBounds.minX, pMinX),
      minY: Math.min(chosenBounds.minY, pMinY),
      maxX: Math.max(chosenBounds.maxX, pMaxX),
      maxY: Math.max(chosenBounds.maxY, pMaxY),
    },
  };
}

/** Run a routing generator to completion. */
export function runSteps(steps) {
  let step;
  do step = steps.next(); while (!step.done);
  return step.value;
}

/**
 * Grid-based A* connector router. The work is a generator that yields every
 * few thousand expansions, so the canvas can spread a heavy route over several
 * tasks; this synchronous form runs it to completion.
 */
export function routeConnectorAStar(args) {
  return runSteps(routeConnectorAStarSteps(args));
}
