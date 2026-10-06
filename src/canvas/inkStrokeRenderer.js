import { INK_BRUSH, inkStrokeOutline } from './inkStroke.js';

const completedPaths = new WeakMap();

function strokePath(stroke, width, height) {
  const key = `${width}:${height}`;
  const cached = stroke.complete !== false ? completedPaths.get(stroke) : null;
  if (cached?.key === key) return cached;
  const points = (stroke.points || []).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map(p => ({ ...p, x: p.x * width, y: p.y * height }));
  const path = new Path2D();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  if (stroke.brush === INK_BRUSH) {
    const outline = inkStrokeOutline(points, stroke);
    outline.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y));
    path.closePath();
  } else if (points.length === 1) {
    path.arc(points[0].x, points[0].y, Math.max(0.5, Number(stroke.strokeWidth) || 3.5) / 2, 0, Math.PI * 2);
  } else {
    points.forEach((p, i) => i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y));
  }
  const result = { key, path, centerX: points.length ? (minX + maxX) / 2 : 0,
    centerY: points.length ? (minY + maxY) / 2 : 0, dot: points.length === 1 };
  if (stroke.complete !== false) completedPaths.set(stroke, result);
  return result;
}

function drawStroke(context, stroke, width, height) {
  if (!stroke?.points?.length) return;
  const { path, centerX, centerY, dot } = strokePath(stroke, width, height);
  context.save();
  if (stroke.rotation) {
    context.translate(centerX, centerY);
    context.rotate(Number(stroke.rotation) * Math.PI / 180);
    context.translate(-centerX, -centerY);
  }
  context.fillStyle = stroke.color || '#263b35';
  context.strokeStyle = stroke.color || '#263b35';
  if (stroke.brush === INK_BRUSH || dot) {
    // Native nonzero fill resolves crossings directly. A hole reveals the ink
    // underneath, so paths belonging to different strokes are never combined.
    context.fill(path, 'nonzero');
  } else {
    context.lineWidth = Math.max(0.5, Number(stroke.strokeWidth) || 3.5);
    context.lineCap = 'round'; context.lineJoin = 'round';
    context.stroke(path);
  }
  context.restore();
}

/** Viewport-sized surfaces preserve world coordinates without huge textures. */
export function createInkStrokeRenderer(host, vectorCanvas) {
  const saved = document.createElement('canvas');
  const live = document.createElement('canvas');
  saved.className = 'ink-saved-surface'; live.className = 'ink-live-surface';
  host.insertBefore(saved, vectorCanvas);
  host.appendChild(live);
  const savedContext = saved.getContext('2d');
  const liveContext = live.getContext('2d');
  let state;
  function prepare(canvas, context) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(state.viewportWidth * ratio));
    const pixelHeight = Math.max(1, Math.round(state.viewportHeight * ratio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth; canvas.height = pixelHeight;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const { camera } = state;
    context.setTransform(ratio * camera.scale, 0, 0, ratio * camera.scale, ratio * camera.x, ratio * camera.y);
  }
  function renderDraft(draft) {
    if (!state) return;
    state.draft = draft;
    prepare(live, liveContext);
    for (const preview of state.previews) drawStroke(liveContext, { ...preview, complete: false }, state.width, state.height);
    if (draft) drawStroke(liveContext, { ...draft, complete: false }, state.width, state.height);
  }
  return {
    render(next) {
      state = next;
      prepare(saved, savedContext);
      const hidden = new Set(state.previews.map(p => String(p.id)));
      if (state.draft?.id) hidden.add(String(state.draft.id));
      for (const [id, stroke] of Object.entries(state.items || {})) {
        if (stroke?.kind !== 'stroke' || hidden.has(id) || (state.visibleItemIds && !state.visibleItemIds.has(id))) continue;
        drawStroke(savedContext, stroke, state.width, state.height);
      }
      renderDraft(state.draft);
    },
    renderDraft,
    destroy() { saved.remove(); live.remove(); state = null; },
  };
}
