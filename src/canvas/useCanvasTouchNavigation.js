import { useEffect, useMemo, useRef } from 'react';
import { createTouchNavigation, pinchCamera } from './touchNavigation.js';

export function useCanvasTouchNavigation(options) {
  const latest = useRef(options);
  latest.current = options;
  const navigation = useMemo(() => createTouchNavigation({
    getStage: () => latest.current.boardRef.current,
    onStart: point => latest.current.onStart(point),
    onChange: (previous, next) => {
      const bounds = latest.current.boardRef.current?.getBoundingClientRect();
      if (bounds) latest.current.setCamera(camera => pinchCamera(camera, previous, next, bounds));
    },
  }), []);
  useEffect(() => {
    const clear = () => navigation.clear();
    window.addEventListener('blur', clear);
    return () => { window.removeEventListener('blur', clear); clear(); };
  }, [navigation]);
  return navigation;
}
