import { useEffect } from 'react';

export function usePointerParallax(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let x = 0, y = 0;
    const paint = () => {
      frame = 0;
      root.style.setProperty('--motion-x', `${x * 18}px`);
      root.style.setProperty('--motion-y', `${y * 14}px`);
      root.style.setProperty('--motion-tilt-x', `${-y * 4}deg`);
      root.style.setProperty('--motion-tilt-y', `${x * 4}deg`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const move = (event) => {
      if (preference.matches || event.pointerType === 'touch' || event.buttons) return;
      const bounds = root.getBoundingClientRect();
      x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
      schedule();
    };
    const reset = () => { x = 0; y = 0; schedule(); };
    root.addEventListener('pointermove', move, { passive: true });
    root.addEventListener('pointerleave', reset);
    preference.addEventListener('change', reset);
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerleave', reset);
      preference.removeEventListener('change', reset);
    };
  }, [rootRef]);
}
