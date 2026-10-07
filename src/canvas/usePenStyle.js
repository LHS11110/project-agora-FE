import { useEffect, useState } from 'react';
import { isPenStyle } from './penStyles.js';
const KEY = 'frelog_pen_style';
export function usePenStyle() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (isPenStyle(saved?.brush) && Number.isFinite(saved.opacity) && saved.opacity >= 0 && saved.opacity <= 1) return saved;
    } catch { /* Use defaults without browser storage. */ }
    return { brush: 'ink', opacity: 1 };
  });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* Drawing still works. */ } }, [settings]);
  return {
    penBrush: settings.brush, penOpacity: settings.opacity,
    changePenBrush: brush => { if (isPenStyle(brush)) setSettings(current => ({ ...current, brush })); },
    changePenOpacity: opacity => { if (Number.isFinite(opacity)) setSettings(current => ({ ...current, opacity: Math.max(0, Math.min(1, opacity)) })); },
  };
}
