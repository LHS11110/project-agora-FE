// Animated connector dashes repaint on the main thread every step. DOM objects are
// mounted for a render window twice the viewport size, so most mounted flow
// connectors can be off-screen; pause those. One shared observer serves all of
// them, and the attribute is toggled directly so React does not re-render.
const OFFSCREEN_ATTR = 'data-flow-offscreen';
let observer = null;
let observed = 0;

function sharedObserver() {
  if (observer || typeof IntersectionObserver !== 'function') return observer;
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.toggleAttribute(OFFSCREEN_ATTR, !entry.isIntersecting);
  });
  return observer;
}

/** Starts pausing `element`'s flow animation while it is outside the viewport. */
export function observeFlowVisibility(element) {
  const io = element && sharedObserver();
  if (!io) return () => {};
  io.observe(element);
  observed++;
  return () => {
    io.unobserve(element);
    element.removeAttribute(OFFSCREEN_ATTR);
    if (--observed === 0) { io.disconnect(); observer = null; }
  };
}
