import { inkPointAtPointer } from './inkStroke.js';

/** Use the browser's high-frequency samples, including the latest dispatch. */
export function inkPointerSamples(event) {
  const native = event.nativeEvent || event;
  let coalesced = [];
  try { coalesced = native.getCoalescedEvents?.() || []; } catch { /* Some browsers cannot expose coalesced events. */ }
  return coalesced.length ? [...coalesced, event] : [event];
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
