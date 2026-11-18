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
  const rx = c * (rect.halfWidth || 0) + s * (rect.halfHeight || 0) + padding;
  const ry = s * (rect.halfWidth || 0) + c * (rect.halfHeight || 0) + padding;
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

function dedupeCoords(values, minGap = 2, importantSet = null) {
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

function buildStubs(rect, other, requiredBoxes, detourBoxes, anchorFn, stubDist) {
  const dx = other.centerX - rect.centerX;
  const dy = other.centerY - rect.centerY;
  const len = Math.hypot(dx, dy) || 1;
  const baseAngle = Number(rect.rotation) || 0;
  const dirs = [
    { x: dx / len, y: dy / len, primary: true },
    { x: 1, y: 0, primary: false },
    { x: 0, y: 1, primary: false },
    { x: -1, y: 0, primary: false },
    { x: 0, y: -1, primary: false },
  ];
  if (Math.abs(baseAngle) > 1e-4) {
    for (let s = 0; s < 4; s++) {
      const a = baseAngle + (s * Math.PI) / 2;
      dirs.push({ x: Math.cos(a), y: Math.sin(a), primary: false });
    }
  }
  const core = rectCoreBounds(rect, 0);
  const stubs = [];
  const seen = new Set();
  for (const dir of dirs) {
    const tip = anchorFn(rect, dir);
    // Project stub outside inflated endpoint box on a clean 1px-snapped grid axis
    const sxRaw = Math.abs(dir.x) >= Math.abs(dir.y)
      ? (dir.x >= 0 ? core.maxX + stubDist : core.minX - stubDist)
      : Math.round(tip.x + dir.x * stubDist);
    const syRaw = Math.abs(dir.y) > Math.abs(dir.x)
      ? (dir.y >= 0 ? core.maxY + stubDist : core.minY - stubDist)
      : Math.round(tip.y + dir.y * stubDist);
    const stub = { x: Math.round(sxRaw), y: Math.round(syRaw) };
    const key = `${stub.x}:${stub.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const blockedInside = detourBoxes.some((b) => pointInsideBox(stub, b)) || pointInsideBox(stub, core);
    const crossesObs = requiredBoxes.some((b) => segmentIntersectsBox(tip, stub, b));
    if (!blockedInside && !crossesObs) {
      stubs.push({ tip, stub, primary: dir.primary, dir });
    }
  }
  if (!stubs.length) {
    // Emergency radial clearance port outside core box
    const dir = { x: dx / len, y: dy / len };
    const tip = anchorFn(rect, dir);
    const stub = {
      x: Math.round(rect.centerX + dir.x * (Math.hypot(rect.halfWidth, rect.halfHeight) + stubDist)),
      y: Math.round(rect.centerY + dir.y * (Math.hypot(rect.halfWidth, rect.halfHeight) + stubDist)),
    };
    stubs.push({ tip, stub, primary: true, dir });
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

function smoothCornerPolyline(waypoints, checkBoxes, maxCornerRadius = 30) {
  if (waypoints.length <= 2) return waypoints;
  const result = [waypoints[0]];
  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = waypoints[i - 1];
    const corner = waypoints[i];
    const next = waypoints[i + 1];
    const lenIn = Math.hypot(corner.x - prev.x, corner.y - prev.y);
    const lenOut = Math.hypot(next.x - corner.x, next.y - corner.y);
    if (lenIn < 2 || lenOut < 2) {
      result.push(corner);
      continue;
    }
    // Check dot product so nearly straight bends pass cleanly
    const ux1 = (corner.x - prev.x) / lenIn;
    const uy1 = (corner.y - prev.y) / lenIn;
    const ux2 = (next.x - corner.x) / lenOut;
    const uy2 = (next.y - corner.y) / lenOut;
    if (ux1 * ux2 + uy1 * uy2 > 0.995) {
      result.push(corner);
      continue;
    }

    let r = Math.min(maxCornerRadius, lenIn * 0.42, lenOut * 0.42);
    let chosenArc = null;
    for (let attempt = 0; attempt < 4 && r >= 2; attempt++) {
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
  result.push(waypoints[waypoints.length - 1]);
  return result;
}

function shortcutClearSegments(points, guardBoxes) {
  const n = points.length;
  if (n <= 2) return points;
  const dist = new Float64Array(n);
  const prev = new Int32Array(n);
  dist.fill(Infinity);
  prev.fill(-1);
  dist[0] = 0;

  for (let j = 1; j < n; j++) {
    // Immediate grid step is guaranteed obstacle-free; seed it first so triangle inequality prunes most checks.
    const stepLen = Math.hypot(points[j].x - points[j - 1].x, points[j].y - points[j - 1].y);
    dist[j] = dist[j - 1] + stepLen;
    prev[j] = j - 1;

    for (let i = 0; i < j - 1; i++) {
      const candidateDist = dist[i] + Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y);
      if (candidateDist + 1e-3 >= dist[j]) continue;
      let blocked = false;
      for (let b = 0; b < guardBoxes.length; b++) {
        if (segmentIntersectsBox(points[i], points[j], guardBoxes[b])) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
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

function runGridAStar(starts, ends, xs, ys, blockedBoxes, cornerBoxes) {
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
    goalCells.set(cell, e);
  }
  const startCells = new Set(validStarts.map((s) => yIndex.get(s.stub.y) * cols + xIndex.get(s.stub.x)));

  // Precompute horizontal & vertical edge walkability once
  const hOpen = new Uint8Array(rows * Math.max(0, cols - 1));
  const vOpen = new Uint8Array(Math.max(0, rows - 1) * cols);

  for (let yIdx = 0; yIdx < rows; yIdx++) {
    const y = ys[yIdx];
    for (let xIdx = 0; xIdx < cols - 1; xIdx++) {
      const a = { x: xs[xIdx], y };
      const b = { x: xs[xIdx + 1], y };
      let blocked = false;
      for (let k = 0; k < blockedBoxes.length; k++) {
        if (segmentIntersectsBox(a, b, blockedBoxes[k])) { blocked = true; break; }
      }
      if (!blocked) hOpen[yIdx * (cols - 1) + xIdx] = 1;
    }
  }
  for (let yIdx = 0; yIdx < rows - 1; yIdx++) {
    const y0 = ys[yIdx];
    const y1 = ys[yIdx + 1];
    for (let xIdx = 0; xIdx < cols; xIdx++) {
      const x = xs[xIdx];
      const a = { x, y: y0 };
      const b = { x, y: y1 };
      let blocked = false;
      for (let k = 0; k < blockedBoxes.length; k++) {
        if (segmentIntersectsBox(a, b, blockedBoxes[k])) { blocked = true; break; }
      }
      if (!blocked) vOpen[yIdx * cols + xIdx] = 1;
    }
  }

  // States encoded as (cell * 5 + dir) where dir 0..3 = E,S,W,N, 4 = initial
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
    const initCost = Math.hypot(s.stub.x - s.tip.x, s.stub.y - s.tip.y) + (s.primary ? 0 : 8);
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

  while (heap.length > 0) {
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
      const totalCost = gScore[s] + Math.hypot(endMatch.stub.x - endMatch.tip.x, endMatch.stub.y - endMatch.tip.y) + (endMatch.primary ? 0 : 8);
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

    // E (0), S (1), W (2), N (3)
    const neighbors = [
      xIdx + 1 < cols && hOpen[yIdx * (cols - 1) + xIdx] ? [yIdx * cols + xIdx + 1, xs[xIdx + 1] - px, 0] : null,
      yIdx + 1 < rows && vOpen[yIdx * cols + xIdx] ? [(yIdx + 1) * cols + xIdx, ys[yIdx + 1] - py, 1] : null,
      xIdx - 1 >= 0 && hOpen[yIdx * (cols - 1) + xIdx - 1] ? [yIdx * cols + xIdx - 1, px - xs[xIdx - 1], 2] : null,
      yIdx - 1 >= 0 && vOpen[(yIdx - 1) * cols + xIdx] ? [(yIdx - 1) * cols + xIdx, py - ys[yIdx - 1], 3] : null,
    ];

    for (let k = 0; k < 4; k++) {
      const nb = neighbors[k];
      if (!nb) continue;
      const [nCell, stepLen, nDir] = nb;
      const nState = nCell * 5 + nDir;
      if (closed[nState]) continue;
      let cornerBias = 0;
      const nYIdx = Math.floor(nCell / cols);
      const nXIdx = nCell - nYIdx * cols;
      const nx = xs[nXIdx];
      const ny = ys[nYIdx];
      // Slight nudge off dead-center obstacle edges if already tight
      if (!startCells.has(nCell) && !goalCells.has(nCell) && cornerBoxes.some((b) => pointInsideBox({ x: nx, y: ny }, b))) {
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
 * Grid-based A* connector router with obstacle avoidance and smooth Bezier corner curves.
 */
export function routeConnectorAStar({
  from,
  to,
  preferredPoints,
  obstacles = [],
  clearance = 14,
  anchorFn,
  guides = null,
  keepOrthogonal = false,
}) {
  const fromCore = rectCoreBounds(from, 0);
  const toCore = rectCoreBounds(to, 0);

  // Exclude obstacles that overlap endpoints (e.g., nested children inside a connected frame).
  const activeObstacles = [];
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    if (!obs || obs.id === from.id || obs.id === to.id) continue;
    const obsCore = rectCoreBounds(obs, 0);
    if (boxesOverlap(obsCore, fromCore, 2) || boxesOverlap(obsCore, toCore, 2)) continue;
    activeObstacles.push(obs);
  }

  const reqPad = Math.max(6, Math.round(clearance * 0.6));
  const requiredBoxes = activeObstacles.map((obs) => rectCoreBounds(obs, reqPad));
  const endpointCores = [rectCoreBounds(from, 2), rectCoreBounds(to, 2)];
  const allGuardBoxes = [...requiredBoxes, ...endpointCores];

  if (!pathIntersectsBoxes(preferredPoints, requiredBoxes) && (preferredPoints.length < 3 || !pathIntersectsBoxes(preferredPoints.slice(1, -1), endpointCores))) {
    return {
      points: preferredPoints,
      routed: false,
      corridor: null,
    };
  }

  const stubDist = Math.max(12, Math.round(clearance));
  const detourPad = Math.max(10, Math.round(clearance));
  const detourBoxes = activeObstacles.map((obs) => rectCoreBounds(obs, detourPad));

  const starts = buildStubs(from, to, requiredBoxes, detourBoxes, anchorFn, stubDist);
  const ends = buildStubs(to, from, requiredBoxes, detourBoxes, anchorFn, stubDist);

  // Compute grid corridor enclosing endpoints, nearby obstacles, and outer escape margin
  let minX = Math.min(fromCore.minX, toCore.minX);
  let minY = Math.min(fromCore.minY, toCore.minY);
  let maxX = Math.max(fromCore.maxX, toCore.maxX);
  let maxY = Math.max(fromCore.maxY, toCore.maxY);
  for (const s of starts) {
    minX = Math.min(minX, s.stub.x); maxX = Math.max(maxX, s.stub.x);
    minY = Math.min(minY, s.stub.y); maxY = Math.max(maxY, s.stub.y);
  }
  for (const e of ends) {
    minX = Math.min(minX, e.stub.x); maxX = Math.max(maxX, e.stub.x);
    minY = Math.min(minY, e.stub.y); maxY = Math.max(maxY, e.stub.y);
  }
  for (const b of detourBoxes) {
    minX = Math.min(minX, b.minX); maxX = Math.max(maxX, b.maxX);
    minY = Math.min(minY, b.minY); maxY = Math.max(maxY, b.maxY);
  }
  if (Array.isArray(guides)) {
    for (const g of guides) {
      if (Number.isFinite(g?.x) && Number.isFinite(g?.y)) {
        minX = Math.min(minX, Math.round(g.x)); maxX = Math.max(maxX, Math.round(g.x));
        minY = Math.min(minY, Math.round(g.y)); maxY = Math.max(maxY, Math.round(g.y));
      }
    }
  }
  const outerPad = Math.max(24, Math.round(clearance * 2));
  minX = Math.floor(minX - outerPad);
  minY = Math.floor(minY - outerPad);
  maxX = Math.ceil(maxX + outerPad);
  maxY = Math.ceil(maxY + outerPad);

  const importantX = new Set([...starts.map((s) => s.stub.x), ...ends.map((e) => e.stub.x)]);
  const importantY = new Set([...starts.map((s) => s.stub.y), ...ends.map((e) => e.stub.y)]);
  const rawX = new Set([minX, maxX, fromCore.minX - stubDist, fromCore.maxX + stubDist, toCore.minX - stubDist, toCore.maxX + stubDist, ...importantX]);
  const rawY = new Set([minY, maxY, fromCore.minY - stubDist, fromCore.maxY + stubDist, toCore.minY - stubDist, toCore.maxY + stubDist, ...importantY]);

  for (const b of detourBoxes) {
    rawX.add(b.minX - 1); rawX.add(b.maxX + 1);
    rawY.add(b.minY - 1); rawY.add(b.maxY + 1);
  }
  const xs = addSubdivisions(dedupeCoords(rawX, 3, importantX), minX, maxX, 56);
  const ys = addSubdivisions(dedupeCoords(rawY, 3, importantY), minY, maxY, 56);

  // Obstacles + core interiors (except endpoint stubs) form the blocked regions for Hanan edges
  const blockedBoxes = [...detourBoxes, rectCoreBounds(from, 2), rectCoreBounds(to, 2)];

  const aStar = runGridAStar(starts, ends, xs, ys, blockedBoxes, requiredBoxes);
  if (!aStar) {
    return {
      points: preferredPoints,
      routed: false,
      corridor: null,
    };
  }

  const rawMid = keepOrthogonal
    ? removeCollinear(aStar.gridWaypoints)
    : removeCollinear(shortcutClearSegments(aStar.gridWaypoints, allGuardBoxes));
  const cleanedMid = removeCollinear(rawMid);

  let middle = keepOrthogonal
    ? smoothCornerPolyline(cleanedMid, allGuardBoxes, 10)
    : smoothCornerPolyline(cleanedMid, allGuardBoxes, 48);

  let fullPath = removeCollinear([aStar.startMatch.tip, ...middle, aStar.endMatch.tip]);
  if (fullPath.length < 2) fullPath = [aStar.startMatch.tip, aStar.endMatch.tip];

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
      minX: Math.min(minX, pMinX),
      minY: Math.min(minY, pMinY),
      maxX: Math.max(maxX, pMaxX),
      maxY: Math.max(maxY, pMaxY),
    },
  };
}
