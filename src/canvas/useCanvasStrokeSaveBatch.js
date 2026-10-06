import { useCallback, useEffect, useRef } from 'react';
import { CANVAS_SAVE_FPS } from './canvasConstants.js';

/** Keep only each stroke's latest state until the next save frame. */
export function useCanvasStrokeSaveBatch({ sendBatch, pendingItemChangesRef, flushRef }) {
  const changesRef = useRef(new Map());
  const latestRef = useRef({ sendBatch, pendingItemChangesRef });
  latestRef.current = { sendBatch, pendingItemChangesRef };
  const enqueue = useCallback((id, item, previous) => {
    const key = String(id);
    const queued = changesRef.current.get(key);
    const basePrevious = queued ? queued.previous : previous;
    if (!item && !basePrevious && queued) {
      changesRef.current.delete(key);
      return;
    }
    changesRef.current.set(key, { id: key, item, previous: basePrevious });
  }, []);
  const flush = useCallback(({ force = false } = {}) => {
    const { sendBatch, pendingItemChangesRef } = latestRef.current;
    const inFlight = new Set(pendingItemChangesRef.current.map(change => change.id));
    const frame = [];
    for (const [id, change] of changesRef.current) {
      if (!force && inFlight.has(id)) continue;
      const item = change.item ? { ...change.item, points: [...change.item.points] } : null;
      frame.push({ id, previous: change.previous, payload: item
        ? { type: 'item_update', item_id: id, item }
        : { type: 'item_delete', item_id: id } });
      changesRef.current.delete(id);
    }
    if (frame.length) sendBatch(frame);
  }, []);
  flushRef.current = flush;
  useEffect(() => {
    let frameId;
    let lastFrame = performance.now();
    const interval = 1000 / CANVAS_SAVE_FPS;
    const tick = now => {
      const elapsed = now - lastFrame;
      if (elapsed >= interval) { lastFrame = now - elapsed % interval; flush(); }
      frameId = requestAnimationFrame(tick);
    };
    const forceFlush = () => flush({ force: true });
    const onVisibilityChange = () => { if (document.hidden) forceFlush(); };
    frameId = requestAnimationFrame(tick);
    window.addEventListener('pagehide', forceFlush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelAnimationFrame(frameId);
      forceFlush();
      window.removeEventListener('pagehide', forceFlush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (flushRef.current === flush) flushRef.current = null;
    };
  }, [flush, flushRef]);
  return { enqueue, flush };
}
