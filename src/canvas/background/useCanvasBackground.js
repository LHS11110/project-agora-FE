import { useState } from 'react';
import { normalizeCanvasColor } from '../useCanvasPalette.js';

export function useCanvasBackground(canvasId) {
  const key = `frelog_canvas_background_${canvasId}`;
  const [customColor, setCustomColor] = useState(() => {
    try { return normalizeCanvasColor(localStorage.getItem(key)) || ''; } catch { return ''; }
  });
  const setBackgroundColor = value => {
    const next = normalizeCanvasColor(value) || '';
    setCustomColor(next);
    try { if (next) localStorage.setItem(key, next); else localStorage.removeItem(key); } catch { /* Storage unavailable. */ }
  };
  const rgb = customColor ? [1, 3, 5].map(offset => parseInt(customColor.slice(offset, offset + 2), 16)) : null;
  const light = rgb && rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 140;
  return { backgroundColor: customColor, setBackgroundColor,
    backgroundStyle: customColor ? { backgroundColor: customColor, '--stage-dot': light ? '#00000038' : '#ffffff48' } : {} };
}
