import { useCallback, useRef } from 'react';

export function rebaseCanvasItems({ serverItems, localItems, dirtyItemIds, queuedChanges, mergeDirtyItem }) {
  const next = { ...(serverItems || {}) };

  for (const change of queuedChanges || []) {
    if (change.type === 'item_delete') delete next[change.id];
    else if (change.payload?.item) next[change.id] = change.payload.item;
  }

  for (const rawId of dirtyItemIds || []) {
    const id = String(rawId);
    if ((queuedChanges || []).some((change) => change.id === id && change.type === 'item_delete')) continue;
    const localItem = localItems[id];
    if (!localItem) continue;
    const serverItem = next[id];
    next[id] = serverItem ? mergeDirtyItem(serverItem, localItem, id) : localItem;
  }

  return next;
}

export function useCanvasServerChangeQueue() {
  const changesRef = useRef(new Map());
  const persistedItemIdsRef = useRef(new Set());
  const revisionRef = useRef(0);

  const enqueue = useCallback((change) => {
    const id = String(change.id);
    const previous = changesRef.current.get(id);
    const baseWasAbsent = previous?.baseWasAbsent
      ?? (!persistedItemIdsRef.current.has(id) && (change.previous == null || change.wasNewCollaborative));
    const wasSent = Boolean(previous?.sentAtLeastOnce);
    const entry = {
      ...change,
      id,
      queueRevision: ++revisionRef.current,
      baseWasAbsent,
      sentAtLeastOnce: wasSent,
    };

    if (change.type === 'item_delete' && baseWasAbsent && !wasSent && !persistedItemIdsRef.current.has(id)) {
      changesRef.current.delete(id);
      return { ...entry, canceled: true };
    }

    changesRef.current.set(id, entry);
    return entry;
  }, []);

  const markSent = useCallback((entry) => {
    const current = changesRef.current.get(String(entry.id));
    if (current?.queueRevision === entry.queueRevision) {
      changesRef.current.set(current.id, { ...current, sentAtLeastOnce: true });
    }
  }, []);

  const acknowledge = useCallback((entry) => {
    if (!entry) return;
    const id = String(entry.id);
    const current = changesRef.current.get(id);
    if (current?.queueRevision === entry.queueRevision) changesRef.current.delete(id);
    if (entry.type === 'item_delete') persistedItemIdsRef.current.delete(id);
    else if (entry.type === 'item_update' || entry.type === 'item_save') persistedItemIdsRef.current.add(id);
  }, []);

  const reject = useCallback((entry) => {
    if (!entry) return;
    const id = String(entry.id);
    const current = changesRef.current.get(id);
    if (current?.queueRevision === entry.queueRevision) changesRef.current.delete(id);
  }, []);

  const pending = useCallback(() => [...changesRef.current.values()], []);

  const replacePersistedItems = useCallback((items) => {
    persistedItemIdsRef.current = new Set(Object.keys(items || {}).map(String));
  }, []);

  const discard = useCallback((id) => {
    changesRef.current.delete(String(id));
  }, []);

  return { enqueue, markSent, acknowledge, reject, pending, replacePersistedItems, discard };
}
