import { useLayoutEffect } from 'react';

const MIN_SCALE = 0.2;
const STEPS = 8;

const overflows = (box) => box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1;

/**
 * Shrink the rendered preview until it fits its box (typography overflowMode "auto-fit").
 * Text is never enlarged beyond the object's font size. `zoom` scales layout as well as
 * glyphs, so the measured overflow reflects the fitted result.
 */
export function fitPreviewScale(box, preview) {
  preview.style.zoom = '';
  if (!box.clientHeight || !overflows(box)) return 1;
  let low = MIN_SCALE, high = 1;
  for (let step = 0; step < STEPS; step++) {
    const mid = (low + high) / 2;
    preview.style.zoom = String(mid);
    if (overflows(box)) high = mid; else low = mid;
  }
  preview.style.zoom = String(low);
  return low;
}

export default function useAutoFitText(boxRef, enabled, contentKey) {
  useLayoutEffect(() => {
    const box = boxRef.current;
    const preview = box?.querySelector(':scope > .editing-surface > .editing-surface-preview');
    if (!box || !preview) return undefined;
    if (!enabled) { preview.style.zoom = ''; return undefined; }
    let frame = 0;
    const fit = () => { frame = 0; fitPreviewScale(box, preview); };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(fit); };
    fit();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    observer?.observe(box);
    document.fonts?.ready?.then(schedule);
    return () => {
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      preview.style.zoom = '';
    };
  }, [boxRef, enabled, contentKey]);
}
