import { zoomCanvasCamera } from './canvasSpace.js';

export function touchPair(points) {
  if (points.length < 2) return null;
  const [a, b] = points;
  const distance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  if (distance < 8) return null;
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2, distance };
}

export function pinchCamera(camera, previous, next, bounds) {
  const zoomed = zoomCanvasCamera(camera, next.distance / previous.distance,
    { x: previous.x - bounds.left, y: previous.y - bounds.top }, bounds);
  if (zoomed === camera && next.distance !== previous.distance) return camera;
  const x = zoomed.x + next.x - previous.x, y = zoomed.y + next.y - previous.y;
  return Number.isFinite(x) && Number.isFinite(y) ? { ...zoomed, x, y } : camera;
}

/** Capture two-finger navigation before object handlers; ordinary pen/mouse are untouched. */
export function createTouchNavigation({ getStage, onStart, onChange }) {
  const points = new Map();
  let active = false, previous = null;
  const consume = event => { event.preventDefault?.(); event.stopPropagation?.(); return true; };
  const point = event => ({ pointerId: event.pointerId, pointerType: 'touch', clientX: event.clientX, clientY: event.clientY });
  const pair = () => touchPair([...points.values()]);
  const release = id => {
    const stage = getStage();
    if (stage?.hasPointerCapture?.(id)) stage.releasePointerCapture(id);
  };
  return {
    get active() { return active; },
    down(event) {
      if (event.pointerType !== 'touch') return active ? consume(event) : false;
      if (!active && event.target.closest?.('.canvas-minimap, .canvas-code-editor, textarea, input, button, select, [contenteditable="true"]')) return false;
      points.set(event.pointerId, point(event));
      if (points.size < 2 && !active) return false;
      if (!active) {
        active = true;
        onStart?.([...points.values()][0]);
      }
      previous = pair();
      for (const id of points.keys()) getStage()?.setPointerCapture?.(id);
      return consume(event);
    },
    move(event) {
      if (points.has(event.pointerId)) points.set(event.pointerId, point(event));
      if (!active) return false;
      if (points.has(event.pointerId)) {
        const next = pair();
        if (previous && next) onChange(previous, next);
        previous = next;
      }
      return consume(event);
    },
    up(event) {
      if (!points.has(event.pointerId)) return active ? consume(event) : false;
      const consumed = active;
      points.delete(event.pointerId);
      previous = pair();
      // Keep the remaining finger consumed until lifted; do not turn it into a drag.
      if (!points.size) active = false;
      if (consumed) { release(event.pointerId); return consume(event); }
      return false;
    },
    clear() {
      const ids = [...points.keys()];
      points.clear(); active = false; previous = null;
      for (const id of ids) release(id);
    },
  };
}
