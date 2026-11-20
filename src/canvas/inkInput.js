import { inkPointAtPointer } from './inkStroke.js';

/** Use the browser's high-frequency samples, including the latest dispatch. */
export function inkPointerSamples(event) {
  const native = event.nativeEvent || event;
  let coalesced = [];
  try { coalesced = native.getCoalescedEvents?.() || []; } catch { /* Some browsers cannot expose coalesced events. */ }
  return coalesced.length ? [...coalesced, event] : [event];
}

// Display-only tip prediction hides roughly one refresh of input-to-photon delay.
// Predicted samples are never stored, broadcast or saved.
const PREDICTION_HORIZON_MS = 14;
const PREDICTION_WINDOW_MS = 40;
const MAX_PREDICTION_PX = 36;
const MIN_PREDICTION_SPEED = .08; // CSS px per ms; below this the hand is effectively still.

/** Remember recent client-space samples so the drawing tip can be extrapolated. */
export function recordInkMotion(history, event, limit = 8) {
  for (const sample of inkPointerSamples(event)) {
    if (!Number.isFinite(sample.clientX) || !Number.isFinite(sample.clientY)) continue;
    const t = Number.isFinite(sample.timeStamp) ? sample.timeStamp : (history.at(-1)?.t ?? 0) + 1;
    const last = history.at(-1);
    if (last && last.t === t && last.x === sample.clientX && last.y === sample.clientY) continue;
    history.push({ x: sample.clientX, y: sample.clientY, t });
  }
  if (history.length > limit) history.splice(0, history.length - limit);
  return history;
}

/** Predicted client-space tip positions: native browser predictions first, then a
 * bounded linear extrapolation of the recent velocity. Returns [] when still. */
export function predictInkTip(event, history) {
  const native = event?.nativeEvent || event;
  const last = history.at(-1);
  if (!last) return [];
  const clamp = sample => {
    const dx = sample.clientX - last.x, dy = sample.clientY - last.y, distance = Math.hypot(dx, dy);
    if (!(distance > .5)) return null;
    const k = distance > MAX_PREDICTION_PX ? MAX_PREDICTION_PX / distance : 1;
    return { clientX: last.x + dx * k, clientY: last.y + dy * k, pointerType: sample.pointerType, pressure: sample.pressure };
  };
  let predicted = [];
  try { predicted = native?.getPredictedEvents?.() || []; } catch { predicted = []; }
  if (predicted.length) {
    const result = [];
    for (const sample of predicted) { const point = clamp(sample); if (point) result.push(point); }
    if (result.length) return result.slice(-2);
  }
  let first = null;
  for (let i = history.length - 2; i >= 0; i--) {
    if (last.t - history[i].t > PREDICTION_WINDOW_MS) break;
    first = history[i];
  }
  if (!first || last.t <= first.t) return [];
  const vx = (last.x - first.x) / (last.t - first.t), vy = (last.y - first.y) / (last.t - first.t);
  if (Math.hypot(vx, vy) < MIN_PREDICTION_SPEED) return [];
  const point = clamp({ clientX: last.x + vx * PREDICTION_HORIZON_MS, clientY: last.y + vy * PREDICTION_HORIZON_MS });
  return point ? [point] : [];
}

/** Append samples in drawing order using a screen-pixel threshold at any zoom. */
export function appendInkInput(event, points, { toPoint, size, scale, brush, maxPoints = Infinity, final = false }) {
  const appended = [];
  const samples = final ? [event] : inkPointerSamples(event);
  const zoom = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const threshold = final ? .05 : brush === 'pen' ? .2 : .35;
  for (const sample of samples) {
    if (points.length >= maxPoints) break;
    if (sample.pointerId != null && event.pointerId != null && sample.pointerId !== event.pointerId) continue;
    const position = toPoint(sample);
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) continue;
    const previous = points[points.length - 1];
    // Release pressure is typically zero even when the last contact was firm.
    const point = final ? { ...position, ...(Number.isFinite(previous?.pressure) ? { pressure: previous.pressure } : {}) }
      : inkPointAtPointer({ pointerType: sample.pointerType || event.pointerType, pressure: sample.pressure }, position);
    const distance = previous ? Math.hypot((point.x - previous.x) * size.width, (point.y - previous.y) * size.height) * zoom : Infinity;
    const pressureChange = Math.abs((point.pressure ?? .5) - (previous?.pressure ?? .5));
    if (distance < threshold && (final || pressureChange < .015)) continue;
    points.push(point);
    appended.push(point);
  }
  return appended;
}
