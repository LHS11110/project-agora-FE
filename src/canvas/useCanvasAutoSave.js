import { useEffect, useRef } from 'react';
import { isCollaborativeItem } from './collaborativeSync.js';

import { CANVAS_SAVE_FPS } from './canvasConstants.js';

export const CANVAS_AUTO_SAVE_FPS = CANVAS_SAVE_FPS;
const FRAME_MS = 1000 / CANVAS_AUTO_SAVE_FPS;

/** Sample changed documents at 30 fps; keep at most one save in flight per item. */
export function useCanvasAutoSave(options) {
  const latestRef = useRef(options);
  latestRef.current = options;
  const attemptsRef = useRef(new Map());

  useEffect(() => {
    let frameId;
    let lastFrame = performance.now();
    const saveDirtyItems = ({ force = false } = {}) => {
      const { canSave, dirtyItemsRef, itemsRef, itemEditRevisionRef, pendingItemChangesRef, saveCollaborativeItem } = latestRef.current;
      if (!force && !canSave) {
        attemptsRef.current.clear();
        return;
      }
      const inFlight = new Map();
      for (const change of pendingItemChangesRef.current) {
        if (change.type === 'item_save') inFlight.set(change.id, change.editRevision);
      }
      for (const rawId of dirtyItemsRef.current) {
        const id = String(rawId);
        if (!isCollaborativeItem(itemsRef.current[id])) continue;
        const revision = itemEditRevisionRef.current.get(id) || 0;
        if (force ? inFlight.get(id) === revision : inFlight.has(id)) continue;
        if (!force && attemptsRef.current.get(id) === revision) continue;
        if (saveCollaborativeItem(id, { silent: true })) attemptsRef.current.set(id, revision);
      }
      for (const id of attemptsRef.current.keys()) {
        if (!dirtyItemsRef.current.has(id)) attemptsRef.current.delete(id);
      }
    };
    const tick = timestamp => {
      const elapsed = timestamp - lastFrame;
      if (elapsed >= FRAME_MS) {
        // Skip missed frames instead of sending a burst after a stalled frame.
        lastFrame = timestamp - elapsed % FRAME_MS;
        saveDirtyItems();
      }
      frameId = window.requestAnimationFrame(tick);
    };
    const flush = () => saveDirtyItems({ force: true });
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
      else lastFrame = performance.now() - FRAME_MS;
    };
    frameId = window.requestAnimationFrame(tick);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      // Flush before the connection hook closes its WebSocket.
      window.cancelAnimationFrame(frameId);
      flush();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      attemptsRef.current.clear();
    };
  }, []);
}
