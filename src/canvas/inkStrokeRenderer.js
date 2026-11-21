import { objectShadow } from './objectShadow.js';
import { addHighlighterToPath } from './highlighterStroke.js';
import { brushBristlePaths, paintBrush } from './brushStroke.js';
import { addSprayToPath } from './sprayStroke.js';
import { strokeOpacity } from './penStyles.js';
import { INK_BRUSH, inkStrokeOutline, inkStrokeSize, strokePaintSize } from './inkStroke.js';
import { addPenOutline } from './penStroke.js';
import { changedItemIds } from './itemSnapshots.js';

const completedPaths = new WeakMap();
const quickBoundsCache = new WeakMap();
const strokeItemsCache = new WeakMap();
const MAX_SAVED_SURFACE_PX = 6144;
const MAX_PAN_MARGIN_CSS = 128;

// Each erase/draw/drag commit yields a new ink snapshot. Derive its stroke list
// from the previous one using the snapshot's change ids instead of walking every
// key through the snapshot proxy again.
// Depth layers render alternately, so remember a few recent snapshots per lineage.
const recentStrokeItems = [];
function cachedStrokeEntries(items) {
  if (!items || typeof items !== 'object') return [];
  let cached = strokeItemsCache.get(items);
  if (cached) return cached;
  let previous = null, changed = null;
  for (let i = recentStrokeItems.length - 1; i >= 0 && !changed; i--) {
    const candidate = recentStrokeItems[i].deref();
    if (!candidate || !strokeItemsCache.has(candidate)) continue;
    changed = changedItemIds(candidate, items);
    if (changed) previous = candidate;
  }
  if (changed && changed.length <= 512) {
    const set = new Set(changed), base = strokeItemsCache.get(previous), seen = new Set();
    cached = [];
    for (const entry of base) {
      const id = entry[0];
      if (!set.has(id)) { cached.push(entry); continue; }
      seen.add(id);
      const stroke = items[id];
      if (stroke?.kind === 'stroke') cached.push([id, stroke]);
    }
    for (const id of changed) {
      if (seen.has(id)) continue;
      const stroke = items[id];
      if (stroke?.kind === 'stroke') cached.push([id, stroke]);
    }
  } else {
    cached = [];
    for (const id of Object.keys(items)) {
      const stroke = items[id];
      if (stroke?.kind === 'stroke') cached.push([id, stroke]);
    }
  }
  strokeItemsCache.set(items, cached);
  recentStrokeItems.push(new WeakRef(items));
  if (recentStrokeItems.length > 8) recentStrokeItems.shift();
  return cached;
}

export function hasStrokeItems(items) {
  return cachedStrokeEntries(items).length > 0;
}

function fmtCoord(value) {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

class SvgPathBuilder {
  constructor() {
    this.parts = [];
  }
  moveTo(x, y) {
    this.parts.push(`M${fmtCoord(x)},${fmtCoord(y)}`);
  }
  lineTo(x, y) {
    this.parts.push(`L${fmtCoord(x)},${fmtCoord(y)}`);
  }
  quadraticCurveTo(cx, cy, x, y) {
    this.parts.push(`Q${fmtCoord(cx)},${fmtCoord(cy)} ${fmtCoord(x)},${fmtCoord(y)}`);
  }
  closePath() {
    this.parts.push('Z');
  }
  rect(x, y, w, h) {
    this.parts.push(`M${fmtCoord(x)},${fmtCoord(y)}h${fmtCoord(w)}v${fmtCoord(h)}h${fmtCoord(-w)}Z`);
  }
  arc(cx, cy, rad) {
    if (!(rad > 0)) return;
    const r = fmtCoord(rad);
    this.parts.push(`M${fmtCoord(cx + rad)},${fmtCoord(cy)}A${r},${r} 0 1,0 ${fmtCoord(cx - rad)},${fmtCoord(cy)}A${r},${r} 0 1,0 ${fmtCoord(cx + rad)},${fmtCoord(cy)}Z`);
  }
  toString() {
    return this.parts.join('');
  }
}

function computeVisualBounds(minX, minY, maxX, maxY, stroke) {
  const halfStroke = strokePaintSize(stroke) / 2 + 2;
  const shadow = objectShadow(stroke);
  const shadowPad = shadow.enabled && shadow.opacity > 0
    ? shadow.blur * 3 + Math.max(Math.abs(shadow.x), Math.abs(shadow.y))
    : 0;
  const pad = halfStroke + shadowPad + (stroke.__selectionOutline ? 6 : 0);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  if (stroke.rotation) {
    const radius = Math.hypot((maxX - minX) / 2, (maxY - minY) / 2) + pad;
    return {
      minX: centerX - radius,
      minY: centerY - radius,
      maxX: centerX + radius,
      maxY: centerY + radius,
    };
  }
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}

function quickStrokeWorldBounds(stroke, width, height) {
  const key = `${width}:${height}`;
  const cachedPath = stroke.complete !== false ? completedPaths.get(stroke) : null;
  if (cachedPath?.key === key) return cachedPath.bounds;
  const cachedQuick = stroke.complete !== false ? quickBoundsCache.get(stroke) : null;
  if (cachedQuick?.key === key) return cachedQuick.bounds;
  const rawPoints = stroke.points;
  if (!Array.isArray(rawPoints) || !rawPoints.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < rawPoints.length; i++) {
    const p = rawPoints[i];
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) continue;
    const px = p.x * width, py = p.y * height;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  if (!Number.isFinite(minX)) return null;
  const bounds = computeVisualBounds(minX, minY, maxX, maxY, stroke);
  if (stroke.complete !== false) quickBoundsCache.set(stroke, { key, bounds });
  return bounds;
}

function buildStrokeGeometry(stroke, width, height, createPath) {
  const points = (stroke.points || []).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map(p => ({ ...p, x: p.x * width, y: p.y * height }));
  const path = createPath();
  let bristles;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!points.length) {
    return { path, bristles, centerX: 0, centerY: 0, dot: false, rawMinX: 0, rawMinY: 0, rawMaxX: 0, rawMaxY: 0, bounds: null };
  }
  if (stroke.brush === 'spray') {
    addSprayToPath(path, points, Math.max(.5, Number(stroke.strokeWidth) || 3.5));
  } else if (stroke.brush === 'highlighter') {
    addHighlighterToPath(path, points, strokePaintSize(stroke));
  } else if (stroke.brush === INK_BRUSH || stroke.brush === 'pen') {
    const outline = inkStrokeOutline(points, stroke);
    addPenOutline(path, outline);
    if (stroke.brush === INK_BRUSH) bristles = brushBristlePaths(points, stroke, createPath);
  } else if (points.length === 1) {
    path.arc(points[0].x, points[0].y, strokePaintSize(stroke) / 2, 0, Math.PI * 2);
  } else {
    points.forEach((p, i) => i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y));
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const bounds = computeVisualBounds(minX, minY, maxX, maxY, stroke);
  return { path, bristles, centerX, centerY, dot: points.length === 1, rawMinX: minX, rawMinY: minY, rawMaxX: maxX, rawMaxY: maxY, bounds };
}

function strokePath(stroke, width, height) {
  const key = `${width}:${height}`;
  const cached = stroke.complete !== false ? completedPaths.get(stroke) : null;
  if (cached?.key === key) return cached;
  const result = { key, ...buildStrokeGeometry(stroke, width, height, () => new Path2D()) };
  if (stroke.complete !== false) completedPaths.set(stroke, result);
  return result;
}

/** Pure-vector SVG geometry for resolution-independent DOM/animated stroke rendering. */
export function strokeSvgData(stroke, width, height) {
  if (!stroke?.points?.length) return null;
  const built = buildStrokeGeometry(stroke, width, height, () => new SvgPathBuilder());
  if (!built.bounds) return null;
  const pad = strokePaintSize(stroke) / 2 + 4;
  const left = built.rawMinX - pad;
  const top = built.rawMinY - pad;
  const boxWidth = Math.max(1, built.rawMaxX - built.rawMinX + pad * 2);
  const boxHeight = Math.max(1, built.rawMaxY - built.rawMinY + pad * 2);
  const baseOpacity = strokeOpacity(stroke);
  const isFilled = stroke.brush === INK_BRUSH || stroke.brush === 'pen' || stroke.brush === 'highlighter' || stroke.brush === 'spray' || built.dot;
  return {
    d: built.path.toString(),
    bristles: built.bristles ? built.bristles.map((b) => b.toString()).filter(Boolean) : null,
    bristleWidth: Math.max(.2, inkStrokeSize(stroke.strokeWidth) * .025),
    isBrush: stroke.brush === INK_BRUSH,
    isFilled,
    color: stroke.color || '#263b35',
    strokeWidth: strokePaintSize(stroke),
    opacity: stroke.brush === INK_BRUSH ? baseOpacity * .94 : baseOpacity * (stroke.brush === 'highlighter' ? .35 : 1),
    bristleOpacity: baseOpacity * .05,
    left,
    top,
    width: boxWidth,
    height: boxHeight,
    centerX: built.centerX,
    centerY: built.centerY,
    rotation: Number(stroke.rotation) || 0,
  };
}

export function drawStroke(context, stroke, width, height) {
  if (!stroke?.points?.length) return;
  const { path, bristles, centerX, centerY, dot, rawMinX, rawMinY, rawMaxX, rawMaxY } = strokePath(stroke, width, height);
  context.save();
  const shadow = objectShadow(stroke);
  const transform = context.getTransform();
  const scale = Math.hypot(transform.a, transform.b);
  const scaledBlur = Math.min(64, shadow.blur * scale);
  const scaledOffX = shadow.x * scale;
  const scaledOffY = shadow.y * scale;
  const paintShadow = shadow.enabled && shadow.opacity > 0 && (scaledBlur >= 0.35 || Math.hypot(scaledOffX, scaledOffY) >= 0.35);
  context.shadowColor = paintShadow ? `rgba(24,34,43,${shadow.opacity})` : 'transparent';
  context.shadowBlur = paintShadow ? scaledBlur : 0;
  context.shadowOffsetX = paintShadow ? scaledOffX : 0;
  context.shadowOffsetY = paintShadow ? scaledOffY : 0;
  if (stroke.rotation) {
    context.translate(centerX, centerY);
    context.rotate(Number(stroke.rotation) * Math.PI / 180);
    context.translate(-centerX, -centerY);
  }
  context.globalAlpha = strokeOpacity(stroke) * (stroke.brush === 'highlighter' ? .35 : 1);
  context.fillStyle = stroke.color || '#263b35';
  context.strokeStyle = stroke.color || '#263b35';
  if (stroke.brush === INK_BRUSH) {
    paintBrush(context, path, bristles, stroke, strokeOpacity(stroke));
  } else if (stroke.brush === 'pen' || stroke.brush === 'highlighter' || stroke.brush === 'spray' || dot) {
    // Native nonzero fill resolves crossings directly. A hole reveals the ink
    // underneath, so paths belonging to different strokes are never combined.
    context.fill(path, 'nonzero');
  } else {
    context.lineWidth = strokePaintSize(stroke);
    context.lineCap = 'round'; context.lineJoin = 'round';
    context.stroke(path);
  }
  if (stroke.__selectionOutline) {
    const pad = strokePaintSize(stroke) / 2 + 2.5;
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    context.globalAlpha = 1;
    context.strokeStyle = '#c28b43';
    context.lineWidth = 1 / Math.max(0.01, scale);
    context.strokeRect(rawMinX - pad, rawMinY - pad, (rawMaxX - rawMinX) + pad * 2, (rawMaxY - rawMinY) + pad * 2);
  }
  context.restore();
}

/** Viewport-sized vector surfaces render strokes crisply at any object size and zoom without huge textures. */
export function createInkStrokeRenderer(host, vectorCanvas, { requestRender = () => {} } = {}) {
  const saved = document.createElement('canvas');
  const live = document.createElement('canvas');
  const drag = document.createElement('canvas');
  // Low-resolution copy of every stroke in this layer, painted while idle. A camera
  // gesture never repaints ink: the retained surface is scaled and this overview
  // fills what zooming out exposes, until the settled frame repaints crisply.
  const overview = document.createElement('canvas');
  overview.className = 'ink-saved-surface ink-overview-surface';
  overview.style.display = 'none'; overview.width = overview.height = 1;
  overview.style.right = overview.style.bottom = 'auto'; overview.style.transformOrigin = '0 0';
  saved.className = 'ink-saved-surface'; live.className = 'ink-live-surface'; drag.className = 'ink-drag-surface';
  // Empty transparent canvases still become compositor layers. Show each
  // surface only while it actually contributes saved or in-progress ink, and
  // allocate no backing store until it does.
  saved.style.display = live.style.display = drag.style.display = 'none';
  saved.width = saved.height = live.width = live.height = drag.width = drag.height = 1;
  saved.style.right = saved.style.bottom = 'auto';
  live.style.right = live.style.bottom = 'auto';
  drag.style.right = drag.style.bottom = 'auto';
  // Zoom reuse scales the retained surface; keep transforms anchored top-left.
  saved.style.transformOrigin = '0 0';
  // Mount completed & live ink above shapes/connectors in the same depth layer
  // while cross-depth ordering remains isolated per .canvas-depth-layer.
  if (vectorCanvas?.nextSibling) {
    host.insertBefore(overview, vectorCanvas.nextSibling);
    host.insertBefore(saved, overview.nextSibling);
    host.insertBefore(drag, saved.nextSibling);
    host.insertBefore(live, drag.nextSibling);
  } else {
    host.appendChild(overview);
    host.appendChild(saved);
    host.appendChild(drag);
    host.appendChild(live);
  }
  const savedContext = saved.getContext('2d', { alpha: true, desynchronized: true });
  const liveContext = live.getContext('2d', { alpha: true, desynchronized: true });
  const dragContext = drag.getContext('2d', { alpha: true });
  const overviewContext = overview.getContext('2d', { alpha: true });
  const OVERVIEW_MAX_PX = 1536, OVERVIEW_IDLE_MS = 250;
  let overviewView = null, overviewTimer = null;
  const overviewFresh = (hidden) => Boolean(overviewView && overviewView.items === state.items && overviewView.visible === state.visibleItemIds
    && overviewView.width === state.width && overviewView.height === state.height && overviewView.hiddenKey === [...hidden].join('|'));
  function paintOverview(entries, hidden) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [, stroke] of entries) {
      const b = quickStrokeWorldBounds(stroke, state.width, state.height);
      if (!b) continue;
      minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY); maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
    }
    if (!(maxX > minX && maxY > minY)) { overviewView = null; releaseBacking(overview); return; }
    const scale = Math.min(1, OVERVIEW_MAX_PX / Math.max(maxX - minX, maxY - minY));
    const width = Math.max(1, Math.ceil((maxX - minX) * scale)), height = Math.max(1, Math.ceil((maxY - minY) * scale));
    if (overview.width !== width || overview.height !== height) { overview.width = width; overview.height = height; }
    overviewContext.setTransform(1, 0, 0, 1, 0, 0);
    overviewContext.clearRect(0, 0, width, height);
    overviewContext.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);
    overview.style.width = `${width}px`; overview.style.height = `${height}px`;
    // Painted in slices across idle tasks; it only becomes usable once complete.
    const job = { items: state.items, visible: state.visibleItemIds, width: state.width, height: state.height, hiddenKey: [...hidden].join('|'), minX, minY, scale, index: 0 };
    overviewView = null;
    const step = () => {
      overviewTimer = null;
      if (!state || state.items !== job.items || state.interactive) return;
      const start = performance.now();
      let points = 0;
      while (job.index < entries.length && !sliceDone(start, points)) { const stroke = entries[job.index++][1]; points += stroke.points?.length || 1; drawStroke(overviewContext, stroke, job.width, job.height); }
      flushCanvas(overview);
      if (job.index < entries.length) { overviewTimer = setTimeout(step, 16); return; }
      overviewView = job;
    };
    step();
  }
  // Retained surface (and the overview under any area it no longer covers) shown
  // at the current camera without repainting. False when it cannot stand in.
  function showRetained(hidden, ratio) {
    if (!savedBuffer || saved.width <= 1 || savedBuffer.width !== state.width || savedBuffer.height !== state.height
      || savedBuffer.viewportWidth !== state.viewportWidth || savedBuffer.viewportHeight !== state.viewportHeight || savedBuffer.ratio > ratio) return false;
    const k = state.camera.scale / savedBuffer.scale;
    const tx = state.camera.x - k * (savedBuffer.margin + savedBuffer.x), ty = state.camera.y - k * (savedBuffer.margin + savedBuffer.y);
    const covers = tx <= 0 && ty <= 0 && tx + (state.viewportWidth + savedBuffer.margin * 2) * k >= state.viewportWidth
      && ty + (state.viewportHeight + savedBuffer.margin * 2) * k >= state.viewportHeight;
    const fresh = overviewFresh(hidden);
    if (!covers && !fresh) return false;
    if (fresh) {
      const view = overviewView;
      setStyle(overview, 'transform', `translate3d(${state.camera.x + view.minX * state.camera.scale}px,${state.camera.y + view.minY * state.camera.scale}px,0) scale(${state.camera.scale / view.scale})`);
    }
    setStyle(overview, 'display', covers ? 'none' : '');
    setStyle(saved, 'transform', `translate3d(${tx}px,${ty}px,0) scale(${k})`);
    saved.style.display = '';
    return true;
  }
  // The settled repaint after a gesture is painted into a back buffer a few ms per
  // frame while the retained surface stays on screen, then swapped in at once:
  // a single full-resolution repaint of every stroke stalled the GPU for ~100ms.
  let settleJob = null, settleCanvas = null, flushContext = null;
  // Canvas 2D records draw calls and rasterizes them when the canvas is next used.
  // Sampling one pixel into a 1x1 canvas makes each slice rasterize in its own
  // frame instead of the whole hidden repaint landing in a single GPU flush.
  function flushCanvas(canvas) {
    if (!flushContext) { const sink = document.createElement('canvas'); sink.width = sink.height = 1; flushContext = sink.getContext('2d'); }
    flushContext.drawImage(canvas, 0, 0, 1, 1, 0, 0, 1, 1);
  }
  // Recording draw calls is cheap; the GPU raster is what a slice must bound, so a
  // slice is limited by the stroke points it submits as well as by main-thread time.
  const SETTLE_SLICE_MS = 4, SETTLE_SLICE_POINTS = 1500;
  const sliceDone = (start, points) => performance.now() - start >= SETTLE_SLICE_MS || points >= SETTLE_SLICE_POINTS;
  function progressiveSettle(entries, hidden, ratio, margin) {
    const camera = state.camera, hiddenKey = [...hidden].join('|');
    const key = `${camera.x}:${camera.y}:${camera.scale}:${ratio}:${state.viewportWidth}:${state.viewportHeight}:${margin}`;
    if (settleJob && (settleJob.key !== key || settleJob.items !== state.items || settleJob.hiddenKey !== hiddenKey || settleJob.visible !== state.visibleItemIds)) settleJob = null;
    if (!settleJob) {
      if (!showRetained(hidden, ratio)) return false;
      if (!settleCanvas) settleCanvas = document.createElement('canvas');
      const width = Math.max(1, Math.round((state.viewportWidth + margin * 2) * ratio)), height = Math.max(1, Math.round((state.viewportHeight + margin * 2) * ratio));
      if (settleCanvas.width !== width || settleCanvas.height !== height) { settleCanvas.width = width; settleCanvas.height = height; }
      const context = settleCanvas.getContext('2d', { alpha: true });
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, width, height);
      context.setTransform(ratio * camera.scale, 0, 0, ratio * camera.scale, ratio * (camera.x + margin), ratio * (camera.y + margin));
      const inv = 1 / Math.max(1e-4, camera.scale || 1);
      const minX = (-camera.x - margin) * inv, minY = (-camera.y - margin) * inv;
      const maxX = (state.viewportWidth - camera.x + margin) * inv, maxY = (state.viewportHeight - camera.y + margin) * inv;
      const list = entries.filter(([, stroke]) => { const b = quickStrokeWorldBounds(stroke, state.width, state.height); return !b || !(b.maxX < minX || b.minX > maxX || b.maxY < minY || b.minY > maxY); });
      settleJob = { key, items: state.items, hiddenKey, visible: state.visibleItemIds, context, list, index: 0, margin, ratio, hidden };
    } else if (!showRetained(hidden, ratio)) { settleJob = null; return false; }
    const job = settleJob;
    if (job.frame) return true;
    const start = performance.now();
    let points = 0;
    while (job.index < job.list.length && !sliceDone(start, points)) { const stroke = job.list[job.index++][1]; points += stroke.points?.length || 1; drawStroke(job.context, stroke, state.width, state.height); }
    flushCanvas(settleCanvas);
    if (job.index < job.list.length) {
      // One slice per displayed frame: render scheduling is a message-channel hop,
      // which would run every slice inside the same frame.
      if (!job.frame) job.frame = (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout)(() => { job.frame = 0; requestRender(); });
      return true;
    }
    settleJob = null;
    if (saved.width !== settleCanvas.width || saved.height !== settleCanvas.height) { saved.width = settleCanvas.width; saved.height = settleCanvas.height; }
    setStyle(saved, 'width', `${saved.width / job.ratio}px`);
    setStyle(saved, 'height', `${saved.height / job.ratio}px`);
    savedContext.setTransform(1, 0, 0, 1, 0, 0);
    savedContext.clearRect(0, 0, saved.width, saved.height);
    savedContext.drawImage(settleCanvas, 0, 0);
    setStyle(saved, 'transform', job.margin ? `translate3d(${-job.margin}px,${-job.margin}px,0)` : '');
    setStyle(overview, 'display', 'none');
    // The back buffer and gesture copy are full-surface canvases; free them until
    // the next gesture instead of holding two extra surfaces per depth layer.
    releaseBacking(settleCanvas); settleCanvas = null;
    if (gestureScratch) { releaseBacking(gestureScratch); gestureScratch = null; }
    savedPainted = true;
    savedBuffer = { items: state.items, hidden: job.hidden, visibleItemIds: state.visibleItemIds, width: state.width, height: state.height,
      viewportWidth: state.viewportWidth, viewportHeight: state.viewportHeight, ratio: job.ratio, scale: camera.scale, x: camera.x, y: camera.y, margin: job.margin };
    return true;
  }
  function scheduleOverview(entries, hidden) {
    clearTimeout(overviewTimer);
    overviewTimer = setTimeout(() => { overviewTimer = null; if (state && !state.interactive && !overviewFresh(hidden)) paintOverview(entries, hidden); }, OVERVIEW_IDLE_MS);
    overviewTimer?.unref?.();
  }
  let state, savedPainted = false, livePainted = false, savedBuffer = null, liveDirty = null, liveReleaseTimer = null;
  // Dragged strokes are painted once into a bounded overlay and moved by CSS.
  // `settling` keeps them there after release until the moved items arrive.
  let dragPaint = null, settling = null;
  const DRAG_OVERSCAN_CSS = 256, SETTLE_MS = 300;

  const setStyle = (canvas, key, value) => { if (canvas.style[key] !== value) canvas.style[key] = value; };
  // A hidden canvas keeps its full backing store (GPU memory) until resized.
  const releaseBacking = canvas => { if (canvas.width !== 1 || canvas.height !== 1) { canvas.width = 1; canvas.height = 1; } };

  // A camera gesture repaints the saved surface at half resolution (a quarter of
  // the raster work); the settled frame repaints it at full resolution.
  let surfaceRatioScale = 1, gestureScratch = null;
  function sizeSurface(canvas, margin) {
    const ratio = (state.pixelRatio || Math.min(window.devicePixelRatio || 1, 2)) * surfaceRatioScale;
    const pixelWidth = Math.max(1, Math.round((state.viewportWidth + margin * 2) * ratio));
    const pixelHeight = Math.max(1, Math.round((state.viewportHeight + margin * 2) * ratio));
    const resized = canvas.width !== pixelWidth || canvas.height !== pixelHeight;
    if (resized) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    setStyle(canvas, 'width', `${pixelWidth / ratio}px`);
    setStyle(canvas, 'height', `${pixelHeight / ratio}px`);
    return { ratio, resized };
  }

  function prepareSurface(canvas, context, margin = 0) {
    const { ratio } = sizeSurface(canvas, margin);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const { camera } = state;
    context.setTransform(ratio * camera.scale, 0, 0, ratio * camera.scale, ratio * (camera.x + margin), ratio * (camera.y + margin));
  }

  // Device-pixel rectangle covered by a stroke on a surface painted with `view`.
  function deviceRect(bounds, view, canvas) {
    if (!bounds) return null;
    const k = view.ratio * view.scale, ox = view.ratio * (view.x + view.margin), oy = view.ratio * (view.y + view.margin);
    const left = Math.max(0, Math.floor(bounds.minX * k + ox) - 2);
    const top = Math.max(0, Math.floor(bounds.minY * k + oy) - 2);
    const right = Math.min(canvas.width, Math.ceil(bounds.maxX * k + ox) + 2);
    const bottom = Math.min(canvas.height, Math.ceil(bounds.maxY * k + oy) + 2);
    return right > left && bottom > top ? { left, top, right, bottom } : null;
  }
  const unionRect = (a, b) => !a ? b : !b ? a : { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };

  function renderDraft(draft) {
    if (!state) return;
    state.draft = draft;
    if (!state.previews.length && !draft) {
      if (livePainted) {
        // The previous stroke leaves a world/camera transform on this context.
        // Clear in surface pixels so zoom/pan cannot leave stationary remnants.
        liveContext.setTransform(1, 0, 0, 1, 0, 0);
        liveContext.clearRect(0, 0, live.width, live.height);
      }
      live.style.display = 'none'; livePainted = false; liveDirty = null;
      // Keep the surface warm between nearby strokes; release it once idle.
      clearTimeout(liveReleaseTimer);
      liveReleaseTimer = setTimeout(() => { liveReleaseTimer = null; if (!livePainted) releaseBacking(live); }, 3000);
      liveReleaseTimer?.unref?.();
      return;
    }
    clearTimeout(liveReleaseTimer); liveReleaseTimer = null;
    setStyle(live, 'display', '');
    const { ratio, resized } = sizeSurface(live, 0);
    // Only the pixels painted by the previous frame need clearing. A long stroke
    // costs one outline fill per input sample instead of a full-surface clear.
    liveContext.setTransform(1, 0, 0, 1, 0, 0);
    if (!livePainted || resized || !liveDirty) liveContext.clearRect(0, 0, live.width, live.height);
    else liveContext.clearRect(liveDirty.left, liveDirty.top, liveDirty.right - liveDirty.left, liveDirty.bottom - liveDirty.top);
    livePainted = true;
    const { camera } = state;
    liveContext.setTransform(ratio * camera.scale, 0, 0, ratio * camera.scale, ratio * camera.x, ratio * camera.y);
    const view = { ratio, scale: camera.scale, x: camera.x, y: camera.y, margin: 0 };
    let dirty = null;
    const paint = stroke => {
      drawStroke(liveContext, stroke, state.width, state.height);
      dirty = unionRect(dirty, deviceRect(quickStrokeWorldBounds(stroke, state.width, state.height), view, live));
    };
    for (const preview of state.previews) paint({ ...preview, complete: false });
    if (draft) paint({ ...draft, points: draft.predicted?.length ? draft.points.concat(draft.predicted) : draft.points, predicted: undefined, complete: false });
    liveDirty = dirty;
  }

  /** Stroke ids whose painted pixels differ from the retained buffer, or null when
   * the change history is unknown and the whole buffer must be repainted. */
  function savedDamage(previous, items, hidden, visibleItemIds) {
    if (previous.visibleItemIds !== visibleItemIds) return null;
    const changed = previous.items === items ? [] : changedItemIds(previous.items, items);
    if (changed === null) return null;
    const candidates = new Set(changed);
    for (const id of previous.hidden) if (!hidden.has(id)) candidates.add(id);
    for (const id of hidden) if (!previous.hidden.has(id)) candidates.add(id);
    const damaged = [];
    for (const id of candidates) {
      const before = previous.items?.[id], after = items?.[id];
      const drawnBefore = before?.kind === 'stroke' && !previous.hidden.has(id) && (!visibleItemIds || visibleItemIds.has(id));
      const drawnAfter = after?.kind === 'stroke' && !hidden.has(id) && (!visibleItemIds || visibleItemIds.has(id));
      if ((drawnBefore || drawnAfter) && (before !== after || drawnBefore !== drawnAfter)) damaged.push([id, drawnBefore ? before : null, drawnAfter ? after : null]);
    }
    return damaged;
  }

  function hideDrag() {
    if (drag.style.display !== 'none') drag.style.display = 'none';
    dragPaint = null;
    releaseBacking(drag);
  }

  /** Paint (or just reposition) the dragged strokes. Painting happens when the
   * drag starts, the zoom changes, or a clipped edge would come into view. */
  function renderDragOverlay(preview, dragEntries) {
    if (!dragEntries.length) { hideDrag(); return; }
    const ratio = state.pixelRatio || Math.min(window.devicePixelRatio || 1, 2);
    const { camera, viewportWidth: W, viewportHeight: H } = state;
    const scale = camera.scale;
    const dx = (preview.dx || 0) * state.width, dy = (preview.dy || 0) * state.height;
    if (dragPaint) {
      const shiftX = camera.x - dragPaint.cx + (dx - dragPaint.dx) * scale;
      const shiftY = camera.y - dragPaint.cy + (dy - dragPaint.dy) * scale;
      const exposed = (dragPaint.clipL && dragPaint.left + shiftX > 0) || (dragPaint.clipR && dragPaint.right + shiftX < W)
        || (dragPaint.clipT && dragPaint.top + shiftY > 0) || (dragPaint.clipB && dragPaint.bottom + shiftY < H);
      const same = dragPaint.items === state.items && dragPaint.ids === preview.ids && dragPaint.ratio === ratio
        && dragPaint.scale === scale && dragPaint.width === state.width && dragPaint.height === state.height;
      if (same && !exposed) {
        setStyle(drag, 'transform', `translate3d(${dragPaint.left + shiftX}px,${dragPaint.top + shiftY}px,0)`);
        return;
      }
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [, stroke] of dragEntries) {
      const b = quickStrokeWorldBounds(stroke, state.width, state.height);
      if (!b) continue;
      if (b.minX < minX) minX = b.minX; if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX; if (b.maxY > maxY) maxY = b.maxY;
    }
    if (!Number.isFinite(minX)) { hideDrag(); return; }
    const sx0 = (minX + dx) * scale + camera.x, sx1 = (maxX + dx) * scale + camera.x;
    const sy0 = (minY + dy) * scale + camera.y, sy1 = (maxY + dy) * scale + camera.y;
    const M = DRAG_OVERSCAN_CSS;
    const left = Math.floor(Math.max(sx0, -M)), right = Math.ceil(Math.min(sx1, W + M));
    const top = Math.floor(Math.max(sy0, -M)), bottom = Math.ceil(Math.min(sy1, H + M));
    if (right <= left || bottom <= top) { hideDrag(); return; }
    const pixelWidth = Math.max(1, Math.round((right - left) * ratio)), pixelHeight = Math.max(1, Math.round((bottom - top) * ratio));
    if (drag.width !== pixelWidth || drag.height !== pixelHeight) { drag.width = pixelWidth; drag.height = pixelHeight; }
    else { dragContext.setTransform(1, 0, 0, 1, 0, 0); dragContext.clearRect(0, 0, drag.width, drag.height); }
    setStyle(drag, 'width', `${pixelWidth / ratio}px`);
    setStyle(drag, 'height', `${pixelHeight / ratio}px`);
    dragContext.setTransform(ratio * scale, 0, 0, ratio * scale, (dx * scale + camera.x - left) * ratio, (dy * scale + camera.y - top) * ratio);
    for (const [, stroke] of dragEntries) drawStroke(dragContext, stroke, state.width, state.height);
    dragPaint = { items: state.items, ids: preview.ids, ratio, scale, width: state.width, height: state.height,
      cx: camera.x, cy: camera.y, dx, dy, left, right, top, bottom,
      clipL: sx0 < -M, clipR: sx1 > W + M, clipT: sy0 < -M, clipB: sy1 > H + M };
    setStyle(drag, 'transform', `translate3d(${left}px,${top}px,0)`);
    setStyle(drag, 'display', '');
  }

  return {
    render(next) {
      state = next;
      const hidden = new Set();
      for (let i = 0; i < state.previews.length; i++) {
        const pid = String(state.previews[i].id);
        if (state.items?.[pid]) hidden.add(pid);
      }
      if (state.draft?.id) {
        const did = String(state.draft.id);
        if (state.items?.[did]) hidden.add(did);
      }
      // A live drag, or a released drag whose moved items have not arrived yet.
      const liveDrag = state.dragPreview?.ids?.size ? state.dragPreview : null;
      if (liveDrag) {
        if (settling) { clearTimeout(settling.timer); settling = null; }
      } else if (dragPaint?.preview && !settling) {
        settling = { preview: dragPaint.preview, items: state.items, timer: setTimeout(() => { if (settling) { settling.expired = true; requestRender(); } }, SETTLE_MS) };
        settling.timer?.unref?.();
      }
      if (settling && !liveDrag && (settling.expired || settling.items !== state.items)) { clearTimeout(settling.timer); settling = null; }
      const activeDrag = liveDrag || settling?.preview || null;
      const dragIds = activeDrag?.ids;
      const strokeEntries = cachedStrokeEntries(state.items);
      const dragEntries = dragIds ? strokeEntries.filter(([id]) => dragIds.has(String(id)) && !hidden.has(id) && (!state.visibleItemIds || state.visibleItemIds.has(id))) : [];
      // Dragged strokes leave the retained surface once (a clipped repaint) and
      // are drawn on the overlay, instead of repainting every stroke per frame.
      for (const [id] of dragEntries) hidden.add(id);
      if (dragEntries.length) { renderDragOverlay(activeDrag, dragEntries); if (dragPaint) dragPaint.preview = activeDrag; }
      else hideDrag();
      const entries = (hidden.size || state.visibleItemIds)
        ? strokeEntries.filter(([id]) => !hidden.has(id) && (!state.visibleItemIds || state.visibleItemIds.has(id)))
        : strokeEntries;

      if (!entries.length) {
        setStyle(overview, 'display', 'none');
        if (savedPainted) {
          savedContext.setTransform(1, 0, 0, 1, 0, 0);
          savedContext.clearRect(0, 0, saved.width, saved.height);
        }
        savedPainted = false;
        savedBuffer = null;
        saved.style.display = 'none';
        saved.style.transform = '';
        releaseBacking(saved);
        renderDraft(state.draft);
        return dragEntries.length;
      }

      const ratio = state.pixelRatio || Math.min(window.devicePixelRatio || 1, 2);
      const sameView = Boolean(
        savedBuffer
        && savedBuffer.width === state.width
        && savedBuffer.height === state.height
        && savedBuffer.viewportWidth === state.viewportWidth
        && savedBuffer.viewportHeight === state.viewportHeight
        && savedBuffer.ratio === ratio
        && savedBuffer.scale === state.camera.scale
        && saved.width > 1
        && Math.abs(state.camera.x - savedBuffer.x) <= savedBuffer.margin
        && Math.abs(state.camera.y - savedBuffer.y) <= savedBuffer.margin
      );
      // While the camera is zooming, scale the retained pixels instead of
      // repainting every visible stroke each frame (GPU raster bound). The
      // surface is repainted crisply once the camera settles (interactive off).
      if (!sameView && state.interactive && savedBuffer && saved.width > 1
        && savedBuffer.width === state.width && savedBuffer.height === state.height
        && savedBuffer.viewportWidth === state.viewportWidth && savedBuffer.viewportHeight === state.viewportHeight
        && savedBuffer.ratio <= ratio) {
        const k = state.camera.scale / savedBuffer.scale;
        const tx = state.camera.x - k * (savedBuffer.margin + savedBuffer.x), ty = state.camera.y - k * (savedBuffer.margin + savedBuffer.y);
        const coverW = (state.viewportWidth + savedBuffer.margin * 2) * k, coverH = (state.viewportHeight + savedBuffer.margin * 2) * k;
        const covers = tx <= 0 && ty <= 0 && tx + coverW >= state.viewportWidth && ty + coverH >= state.viewportHeight;
        const unchanged = savedDamage(savedBuffer, state.items, hidden, state.visibleItemIds)?.length === 0;
        if (unchanged && overviewFresh(hidden)) {
          const view = overviewView, zoom = state.camera.scale / view.scale;
          setStyle(overview, 'transform', `translate3d(${state.camera.x + view.minX * state.camera.scale}px,${state.camera.y + view.minY * state.camera.scale}px,0) scale(${zoom})`);
          setStyle(overview, 'display', covers ? 'none' : '');
          setStyle(saved, 'transform', `translate3d(${tx}px,${ty}px,0) scale(${k})`);
          saved.style.display = '';
          renderDraft(state.draft);
          return entries.length + dragEntries.length;
        }
        if (k >= .5 && k <= 2 && covers && unchanged) {
          setStyle(saved, 'transform', `translate3d(${tx}px,${ty}px,0) scale(${k})`);
          saved.style.display = '';
          renderDraft(state.draft);
          return entries.length + dragEntries.length;
        }
      }
      if (!sameView && !state.interactive && savedBuffer && savedDamage(savedBuffer, state.items, hidden, state.visibleItemIds)?.length === 0) {
        const maxDim = Math.max(state.viewportWidth, state.viewportHeight);
        const margin = Math.max(0, Math.min(MAX_PAN_MARGIN_CSS, Math.floor((MAX_SAVED_SURFACE_PX / ratio - maxDim) / 2)));
        if (progressiveSettle(entries, hidden, ratio, margin)) { renderDraft(state.draft); return entries.length + dragEntries.length; }
      } else settleJob = null;
      setStyle(overview, 'display', 'none');
      if (!state.interactive && !overviewFresh(hidden)) scheduleOverview(entries, hidden);
      // In-progress strokes saved at 30 Hz only change hidden ids, and a finished
      // stroke, erase or drag start/end touches a small region: repaint just that.
      let damage = sameView ? savedDamage(savedBuffer, state.items, hidden, state.visibleItemIds) : null;
      let damageRect = null;
      if (damage?.length) {
        if (damage.length > 64) damage = null;
        else {
          for (const [, before, after] of damage) {
            if (before) damageRect = unionRect(damageRect, deviceRect(quickStrokeWorldBounds(before, state.width, state.height), savedBuffer, saved));
            if (after) damageRect = unionRect(damageRect, deviceRect(quickStrokeWorldBounds(after, state.width, state.height), savedBuffer, saved));
          }
          if (damageRect && (damageRect.right - damageRect.left) * (damageRect.bottom - damageRect.top) > saved.width * saved.height * .5) damage = null;
        }
      }

      saved.style.display = '';
      savedPainted = true;
      if (damage) {
        if (damageRect) {
          const view = savedBuffer, k = view.ratio * view.scale;
          const ox = view.ratio * (view.x + view.margin), oy = view.ratio * (view.y + view.margin);
          const region = {
            minX: (damageRect.left - ox) / k, minY: (damageRect.top - oy) / k,
            maxX: (damageRect.right - ox) / k, maxY: (damageRect.bottom - oy) / k,
          };
          savedContext.save();
          savedContext.setTransform(1, 0, 0, 1, 0, 0);
          savedContext.beginPath();
          savedContext.rect(damageRect.left, damageRect.top, damageRect.right - damageRect.left, damageRect.bottom - damageRect.top);
          savedContext.clip();
          savedContext.clearRect(damageRect.left, damageRect.top, damageRect.right - damageRect.left, damageRect.bottom - damageRect.top);
          savedContext.setTransform(k, 0, 0, k, ox, oy);
          for (let i = 0; i < entries.length; i++) {
            const stroke = entries[i][1];
            const b = quickStrokeWorldBounds(stroke, state.width, state.height);
            if (b && (b.maxX < region.minX || b.minX > region.maxX || b.maxY < region.minY || b.minY > region.maxY)) continue;
            drawStroke(savedContext, stroke, state.width, state.height);
          }
          savedContext.restore();
        }
        savedBuffer.items = state.items;
        savedBuffer.hidden = hidden;
        const tx = state.camera.x - savedBuffer.x - savedBuffer.margin;
        const ty = state.camera.y - savedBuffer.y - savedBuffer.margin;
        setStyle(saved, 'transform', `translate3d(${tx}px,${ty}px,0)`);
      } else {
        const maxDim = Math.max(state.viewportWidth, state.viewportHeight);
        const margin = Math.max(0, Math.min(MAX_PAN_MARGIN_CSS, Math.floor((MAX_SAVED_SURFACE_PX / ratio - maxDim) / 2)));
        // During a camera gesture the previous surface is still correct for every
        // stroke it covered: copy it once at the new scale (one textured draw) and
        // rasterize only strokes reaching the newly exposed area. Path fills are
        // the GPU-process cost; the settled frame repaints everything crisply.
        const previous = state.interactive && savedBuffer && saved.width > 1
          && savedBuffer.width === state.width && savedBuffer.height === state.height
          && savedDamage(savedBuffer, state.items, hidden, state.visibleItemIds)?.length === 0 ? savedBuffer : null;
        if (previous) {
          if (!gestureScratch) gestureScratch = document.createElement('canvas');
          if (gestureScratch.width !== saved.width || gestureScratch.height !== saved.height) { gestureScratch.width = saved.width; gestureScratch.height = saved.height; }
          const scratchContext = gestureScratch.getContext('2d');
          scratchContext.clearRect(0, 0, gestureScratch.width, gestureScratch.height);
          scratchContext.drawImage(saved, 0, 0);
        } else if (!state.interactive && gestureScratch) { releaseBacking(gestureScratch); gestureScratch = null; }
        surfaceRatioScale = state.interactive ? .5 : 1;
        try { prepareSurface(saved, savedContext, margin); } finally { surfaceRatioScale = 1; }
        const paintedRatio = ratio * (state.interactive ? .5 : 1);
        saved.style.transform = margin ? `translate3d(${-margin}px,${-margin}px,0)` : '';
        const invScale = 1 / Math.max(1e-4, state.camera.scale || 1);
        const viewMinX = (-state.camera.x - margin) * invScale;
        const viewMinY = (-state.camera.y - margin) * invScale;
        const viewMaxX = (state.viewportWidth - state.camera.x + margin) * invScale;
        const viewMaxY = (state.viewportHeight - state.camera.y + margin) * invScale;
        let kept = null;
        if (previous) {
          const s = previous.scale;
          kept = { minX: (-previous.x - previous.margin) / s, minY: (-previous.y - previous.margin) / s };
          kept.maxX = kept.minX + gestureScratch.width / previous.ratio / s;
          kept.maxY = kept.minY + gestureScratch.height / previous.ratio / s;
          savedContext.drawImage(gestureScratch, kept.minX, kept.minY, kept.maxX - kept.minX, kept.maxY - kept.minY);
          savedContext.save();
          const exposed = new Path2D();
          exposed.rect(viewMinX, viewMinY, viewMaxX - viewMinX, viewMaxY - viewMinY);
          exposed.rect(kept.minX, kept.minY, kept.maxX - kept.minX, kept.maxY - kept.minY);
          savedContext.clip(exposed, 'evenodd');
        }
        for (let i = 0; i < entries.length; i++) {
          const stroke = entries[i][1];
          const b = quickStrokeWorldBounds(stroke, state.width, state.height);
          if (b && (b.maxX < viewMinX || b.minX > viewMaxX || b.maxY < viewMinY || b.minY > viewMaxY)) continue;
          if (kept && b && b.minX >= kept.minX && b.minY >= kept.minY && b.maxX <= kept.maxX && b.maxY <= kept.maxY) continue;
          drawStroke(savedContext, stroke, state.width, state.height);
        }
        if (previous) savedContext.restore();
        savedBuffer = {
          items: state.items,
          hidden,
          visibleItemIds: state.visibleItemIds,
          width: state.width,
          height: state.height,
          viewportWidth: state.viewportWidth,
          viewportHeight: state.viewportHeight,
          ratio: paintedRatio,
          scale: state.camera.scale,
          x: state.camera.x,
          y: state.camera.y,
          margin,
        };
      }
      renderDraft(state.draft);
      return entries.length + dragEntries.length;
    },
    renderDraft,
    /** Paint only the live draft in the caller's input task. Returns false when no
     * current surface state exists yet and a full render pass is required. */
    paintDraft(draft) {
      if (!state || !draft) return false;
      renderDraft(draft);
      return true;
    },
    destroy() { flushContext = null; settleJob = null; if (settleCanvas) releaseBacking(settleCanvas); settleCanvas = null; clearTimeout(overviewTimer); releaseBacking(overview); overview.remove(); overviewView = null; clearTimeout(liveReleaseTimer); clearTimeout(settling?.timer); settling = null; hideDrag(); if (gestureScratch) releaseBacking(gestureScratch); gestureScratch = null; releaseBacking(saved); releaseBacking(live); saved.remove(); live.remove(); drag.remove(); state = null; savedBuffer = null; },
  };
}
