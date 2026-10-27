import { useCallback, useEffect, useState } from 'react';
import { ERASER_RADIUS, MIN_ERASER_WIDTH, MAX_ERASER_WIDTH } from './canvasConstants.js';

const STORAGE_KEY = 'frelog_canvas_eraser_width';
const MODE_STORAGE_KEY = 'frelog_canvas_eraser_mode';
export function useEraserSize() {
  const [eraserWidth, setEraserWidth] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(stored) && stored >= MIN_ERASER_WIDTH && stored <= MAX_ERASER_WIDTH) return Math.round(stored);
    } catch { /* Keep the default when browser storage is unavailable. */ }
    return ERASER_RADIUS * 2;
  });
  const [eraserMode, setEraserMode] = useState(() => {
    try { return localStorage.getItem(MODE_STORAGE_KEY) === 'stroke' ? 'stroke' : 'partial'; }
    catch { return 'partial'; }
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(eraserWidth)); } catch { /* The tool remains usable without persistence. */ }
  }, [eraserWidth]);
  useEffect(() => {
    try { localStorage.setItem(MODE_STORAGE_KEY, eraserMode); } catch { /* The tool remains usable without persistence. */ }
  }, [eraserMode]);
  const changeEraserWidth = useCallback(value => {
    const width = Number(value);
    if (Number.isFinite(width)) setEraserWidth(Math.max(MIN_ERASER_WIDTH, Math.min(MAX_ERASER_WIDTH, Math.round(width))));
  }, []);
  const changeEraserMode = useCallback(value => {
    if (value === 'partial' || value === 'stroke') setEraserMode(value);
  }, []);
  return { eraserWidth, changeEraserWidth, eraserMode, changeEraserMode };
}
