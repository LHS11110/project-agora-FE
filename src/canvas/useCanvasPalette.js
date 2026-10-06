import { useCallback, useEffect, useState } from 'react';
import { inkColors } from './canvasConstants.js';

const STORAGE_KEY = 'frelog_canvas_palette_v1';
export function normalizeCanvasColor(value) {
  const text = String(value || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(text)) return `#${text.split('').map(char => char + char).join('').toLowerCase()}`;
  return /^[0-9a-f]{6}$/i.test(text) ? `#${text.toLowerCase()}` : null;
}
function readPalette() {
  let stored;
  try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* Use defaults when storage is unavailable. */ }
  return {
    color: normalizeCanvasColor(stored?.color) || inkColors[0],
    favorites: inkColors.map((fallback, index) => normalizeCanvasColor(stored?.favorites?.[index]) || fallback),
  };
}

export function useCanvasPalette() {
  const [palette, setPalette] = useState(readPalette);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(palette)); } catch { /* Editing remains available without browser storage. */ }
  }, [palette]);
  const setColor = useCallback(value => {
    const color = normalizeCanvasColor(value);
    if (color) setPalette(current => ({ ...current, color }));
  }, []);
  const saveFavoriteColor = useCallback((index, value) => {
    const color = normalizeCanvasColor(value);
    if (!color || !Number.isInteger(index) || index < 0 || index >= 5) return;
    setPalette(current => ({ ...current, favorites: current.favorites.map((saved, slot) => slot === index ? color : saved) }));
  }, []);
  return { color: palette.color, setColor, favoriteColors: palette.favorites, saveFavoriteColor };
}
