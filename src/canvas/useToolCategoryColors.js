import { useEffect, useState } from 'react';
import { normalizeCanvasColor } from './useCanvasPalette.js';

const STORAGE_KEY = 'frelog_tool_category_colors_v1';
const DEFAULT_COLORS = Object.freeze({
  navigate: '#6484b8', draw: '#c98957', diagram: '#8772b8',
  write: '#63977c', structure: '#589da5', media: '#b67496', color: '#a08b59',
});
function readColors() {
  let stored;
  try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* Fall back to defaults. */ }
  return Object.fromEntries(Object.entries(DEFAULT_COLORS).map(([id, fallback]) => [id, normalizeCanvasColor(stored?.[id]) || fallback]));
}
export function useToolCategoryColors() {
  const [categoryColors, setColors] = useState(readColors);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(categoryColors)); } catch { /* Colors still work without storage. */ }
  }, [categoryColors]);
  const setCategoryColor = (id, value) => {
    const color = normalizeCanvasColor(value);
    if (!Object.hasOwn(DEFAULT_COLORS, id) || !color) return;
    setColors(current => current[id] === color ? current : { ...current, [id]: color });
  };
  return { categoryColors, setCategoryColor, resetCategoryColors: () => setColors({ ...DEFAULT_COLORS }) };
}
