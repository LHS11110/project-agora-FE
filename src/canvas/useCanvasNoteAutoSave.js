import { useEffect, useRef } from 'react';

export function useCanvasNoteAutoSave({
  canSave = false,
  dirtyItems,
  itemsRef,
  itemEditRevisionRef,
  saveCollaborativeItem,
}) {
  const saveAttemptsRef = useRef(new Map());
  const saveTimersRef = useRef(new Map());

  useEffect(() => {
    if (!canSave) {
      for (const rawId of dirtyItems) saveAttemptsRef.current.delete(String(rawId));
      for (const [id, pending] of saveTimersRef.current) {
        window.clearTimeout(pending.timer);
        saveTimersRef.current.delete(id);
      }
      return;
    }

    const dirtyNotes = new Set();

    for (const rawId of dirtyItems) {
      const id = String(rawId);
      if (itemsRef.current[id]?.kind !== 'note') continue;
      dirtyNotes.add(id);
      const revision = itemEditRevisionRef.current.get(id) || 0;
      const attemptKey = String(revision);
      if (saveAttemptsRef.current.get(id) === attemptKey) continue;
      const pending = saveTimersRef.current.get(id);
      if (pending?.attemptKey === attemptKey) continue;
      if (pending) window.clearTimeout(pending.timer);

      const timer = window.setTimeout(() => {
        saveTimersRef.current.delete(id);
        if ((itemEditRevisionRef.current.get(id) || 0) !== revision) return;
        if (itemsRef.current[id]?.kind !== 'note') return;
        saveAttemptsRef.current.set(id, attemptKey);
        saveCollaborativeItem(id, { silent: true });
      }, 500);
      saveTimersRef.current.set(id, { attemptKey, timer });
    }

    for (const [id, pending] of saveTimersRef.current) {
      if (dirtyNotes.has(id)) continue;
      window.clearTimeout(pending.timer);
      saveTimersRef.current.delete(id);
    }
  }, [canSave, dirtyItems, itemEditRevisionRef, itemsRef, saveCollaborativeItem]);

  useEffect(() => () => {
    for (const { timer } of saveTimersRef.current.values()) window.clearTimeout(timer);
    saveTimersRef.current.clear();
  }, []);
}
