export const CURSOR_INTERVAL_MS = 1000 / 30;
// Keep the 30 Hz deadline anchored to the intended cadence, not to the
// occasionally late animation frame. This avoids falling to 20 Hz at 60 Hz.
export function cursorDeadline(previous, now) {
  return previous > 0 && now - previous < CURSOR_INTERVAL_MS
    ? previous + CURSOR_INTERVAL_MS : now + CURSOR_INTERVAL_MS;
}
export const cursorIsDue = (deadline, now) => now + .5 >= deadline;
