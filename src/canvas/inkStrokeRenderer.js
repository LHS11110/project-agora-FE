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

function cachedStrokeEntries(items) {
  if (!items || typeof items !== 'object') return [];
  let cached = strokeItemsCache.get(items);
  if (!cached) {
    cached = [];
    for (const id of Object.keys(items)) {
      const stroke = items[id];
      if (stroke?.kind === 'stroke') cached.push([id, stroke]);
    }
    strokeItemsCache.set(items, cached);
  }
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
export function createInkStrokeRenderer(host, vectorCanvas) {
  const saved = document.createElement('canvas');
  const live = document.createElement('canvas');
  saved.className = 'ink-saved-surface'; live.className = 'ink-live-surface';
  // Empty transparent canvases still become compositor layers. Show each
  // surface only while it actually contributes saved or in-progress ink, and
  // allocate no backing store until it does.
  saved.style.display = live.style.display = 'none';
  saved.width = saved.height = live.width = live.height = 1;
  saved.style.right = saved.style.bottom = 'auto';
  live.style.right = live.style.bottom = 'auto';
  // Mount completed & live ink above shapes/connectors in the same depth layer
  // while cross-depth ordering remains isolated per .canvas-depth-layer.
  if (vectorCanvas?.nextSibling) {
    host.insertBefore(saved, vectorCanvas.nextSibling);
    host.insertBefore(live, saved.nextSibling);
  } else {
    host.appendChild(saved);
    host.appendChild(live);
  }
  const savedContext = saved.getContext('2d', { alpha: true, desynchronized: true });
  const liveContext = live.getContext('2d', { alpha: true, desynchronized: true });
  let state, savedPainted = false, livePainted = false, savedBuffer = null, liveDirty = null, liveReleaseTimer = null;

  const setStyle = (canvas, key, value) => { if (canvas.style[key] !== value) canvas.style[key] = value; };
  // A hidden canvas keeps its full backing store (GPU memory) until resized.
  const releaseBacking = canvas => { if (canvas.width !== 1 || canvas.height !== 1) { canvas.width = 1; canvas.height = 1; } };

  function sizeSurface(canvas, margin) {
    const ratio = state.pixelRatio || Math.min(window.devicePixelRatio || 1, 2);
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
      const strokeEntries = cachedStrokeEntries(state.items);
      const entries = (hidden.size || state.visibleItemIds)
        ? strokeEntries.filter(([id]) => !hidden.has(id) && (!state.visibleItemIds || state.visibleItemIds.has(id)))
        : strokeEntries;

      if (!entries.length) {
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
        return 0;
      }

      const ratio = state.pixelRatio || Math.min(window.devicePixelRatio || 1, 2);
      const dragIds = state.dragPreview?.ids;
      const dragMatches = Boolean(dragIds?.size && entries.some(([id]) => dragIds.has(String(id))));
      const sameView = Boolean(
        !dragMatches
        && savedBuffer
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
      // In-progress strokes saved at 30 Hz only change hidden ids, and a finished
      // stroke or erase touches a small region: repaint just that damage.
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
        const margin = dragMatches
          ? 0
          : Math.max(0, Math.min(MAX_PAN_MARGIN_CSS, Math.floor((MAX_SAVED_SURFACE_PX / ratio - maxDim) / 2)));
        prepareSurface(saved, savedContext, margin);
        saved.style.transform = margin ? `translate3d(${-margin}px,${-margin}px,0)` : '';
        const invScale = 1 / Math.max(1e-4, state.camera.scale || 1);
        const viewMinX = (-state.camera.x - margin) * invScale;
        const viewMinY = (-state.camera.y - margin) * invScale;
        const viewMaxX = (state.viewportWidth - state.camera.x + margin) * invScale;
        const viewMaxY = (state.viewportHeight - state.camera.y + margin) * invScale;
        const dragDx = dragMatches ? (state.dragPreview.dx || 0) * state.width : 0;
        const dragDy = dragMatches ? (state.dragPreview.dy || 0) * state.height : 0;
        for (let i = 0; i < entries.length; i++) {
          const [id, stroke] = entries[i];
          const dragged = dragMatches && dragIds.has(String(id));
          const b = quickStrokeWorldBounds(stroke, state.width, state.height);
          if (b) {
            const ox = dragged ? dragDx : 0;
            const oy = dragged ? dragDy : 0;
            if (b.maxX + ox < viewMinX || b.minX + ox > viewMaxX || b.maxY + oy < viewMinY || b.minY + oy > viewMaxY) {
              continue;
            }
          }
          if (dragged) {
            savedContext.save();
            savedContext.translate(dragDx, dragDy);
            drawStroke(savedContext, stroke, state.width, state.height);
            savedContext.restore();
          } else {
            drawStroke(savedContext, stroke, state.width, state.height);
          }
        }
        savedBuffer = dragMatches ? null : {
          items: state.items,
          hidden,
          visibleItemIds: state.visibleItemIds,
          width: state.width,
          height: state.height,
          viewportWidth: state.viewportWidth,
          viewportHeight: state.viewportHeight,
          ratio,
          scale: state.camera.scale,
          x: state.camera.x,
          y: state.camera.y,
          margin,
        };
      }
      renderDraft(state.draft);
      return entries.length;
    },
    renderDraft,
    /** Paint only the live draft in the caller's input task. Returns false when no
     * current surface state exists yet and a full render pass is required. */
    paintDraft(draft) {
      if (!state || !draft) return false;
      renderDraft(draft);
      return true;
    },
    destroy() { clearTimeout(liveReleaseTimer); releaseBacking(saved); releaseBacking(live); saved.remove(); live.remove(); state = null; savedBuffer = null; },
  };
}
