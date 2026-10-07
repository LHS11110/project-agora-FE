import { useLayoutEffect, useRef } from 'react';

/** Animate only a committed folder move; scrolling and opening folders stay independent. */
export function useFolderReorderMotion(panelRef, folders) {
  const captured = useRef(null);
  const animations = useRef([]);
  const order = JSON.stringify(folders.map(folder => folder.id));
  const capture = () => {
    animations.current.forEach(animation => animation.cancel());
    animations.current = [];
    captured.current = new Map([...(panelRef.current?.querySelectorAll('[data-tool-folder-id]') || [])].map(element => [element.dataset.toolFolderId, element.getBoundingClientRect()]));
  };
  useLayoutEffect(() => {
    const previous = captured.current;
    captured.current = null;
    if (!previous || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    panelRef.current?.querySelectorAll('[data-tool-folder-id]').forEach(element => {
      const before = previous.get(element.dataset.toolFolderId);
      if (!before) return;
      const after = element.getBoundingClientRect();
      const x = before.left - after.left, y = before.top - after.top;
      if (Math.abs(x) + Math.abs(y) < 1) return;
      animations.current.push(element.animate([{ translate: `${x}px ${y}px` }, { translate: '0 0' }], { duration: 240, easing: 'cubic-bezier(.2,.75,.2,1)' }));
    });
    return () => { animations.current.forEach(animation => animation.cancel()); animations.current = []; };
  }, [order, panelRef]);
  return capture;
}
