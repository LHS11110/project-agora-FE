import { useLayoutEffect, useRef, useState } from 'react';
import { fitCanvasCamera } from './canvasSpace.js';

/** Resizing changes only the visible region; keep its world center and zoom stable. */
export function useCanvasViewport({ boardRef, setCamera, refreshKey }) {
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const previousRef = useRef(null);
  useLayoutEffect(() => {
    const host = boardRef.current;
    if (!host) return undefined;
    const measure = () => {
      const next = { width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) };
      const previous = previousRef.current;
      if (previous?.width === next.width && previous?.height === next.height) return;
      previousRef.current = next;
      setViewportSize(next);
      setCamera(current => previous ? {
        ...current,
        x: current.x + (next.width - previous.width) / 2,
        y: current.y + (next.height - previous.height) / 2,
      } : fitCanvasCamera(next));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    measure();
    return () => observer.disconnect();
  }, [boardRef, refreshKey, setCamera]);
  return viewportSize;
}
