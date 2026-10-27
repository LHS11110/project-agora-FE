import { useEffect, useState } from 'react';
import { isPenStyle } from './penStyles.js';
const KEY = 'frelog_pen_style';
const DEFAULT_SETTINGS = { brush: 'pen', opacity: 1 };
export function readPenStyle(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(KEY));
    if (isPenStyle(saved?.brush) && Number.isFinite(saved.opacity) && saved.opacity >= 0 && saved.opacity <= 1) return saved;
  } catch { /* Use defaults without browser storage. */ }
  return { ...DEFAULT_SETTINGS };
}
export function usePenStyle() {
  const [settings, setSettings] = useState(() => {
    try { return readPenStyle(localStorage); }
    catch { return { ...DEFAULT_SETTINGS }; }
  });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* Drawing still works. */ } }, [settings]);
  return {
    penBrush: settings.brush, penOpacity: settings.opacity,
    changePenBrush: brush => { if (isPenStyle(brush)) setSettings(current => ({ ...current, brush })); },
    changePenOpacity: opacity => { if (Number.isFinite(opacity)) setSettings(current => ({ ...current, opacity: Math.max(0, Math.min(1, opacity)) })); },
  };
}
