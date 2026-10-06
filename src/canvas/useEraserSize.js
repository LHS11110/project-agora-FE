import { useCallback, useEffect, useState } from 'react';
import { ERASER_RADIUS, MIN_ERASER_WIDTH, MAX_ERASER_WIDTH } from './canvasConstants.js';

const STORAGE_KEY = 'frelog_canvas_eraser_width';
export function useEraserSize() {
  const [eraserWidth, setEraserWidth] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(stored) && stored >= MIN_ERASER_WIDTH && stored <= MAX_ERASER_WIDTH) return Math.round(stored);
    } catch { /* Keep the default when browser storage is unavailable. */ }
    return ERASER_RADIUS * 2;
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(eraserWidth)); } catch { /* The tool remains usable without persistence. */ }
  }, [eraserWidth]);
  const changeEraserWidth = useCallback(value => {
    const width = Number(value);
    if (Number.isFinite(width)) setEraserWidth(Math.max(MIN_ERASER_WIDTH, Math.min(MAX_ERASER_WIDTH, Math.round(width))));
  }, []);
  return { eraserWidth, changeEraserWidth };
}
