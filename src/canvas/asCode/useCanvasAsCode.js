import { useCallback, useEffect, useRef } from 'react';
import * as Automerge from '@automerge/automerge/slim';
import { collaborativeField, encodeBase64, isCollaborativeItem, nextPeerSyncVersion, canPeerAccessItem } from '../collaborativeSync.js';
import { exportManifest, planManifest, assertPlanCurrent } from './manifest.js';

/** Reuses the same local state, CRDT and server queue as mouse editing. */
export function useCanvasAsCode(options) {
  const latest = useRef(options);
  latest.current = options;
  const read = useCallback(() => exportManifest(latest.current.itemsRef.current), []);
  const plan = useCallback(source => {
    const context = latest.current;
    if (!context.canvasSnapshotLoadedRef.current) throw new Error('캔버스를 불러온 뒤 사용할 수 있습니다.');
    return planManifest(source, context.itemsRef.current, context.permission);
  }, []);
  const apply = useCallback(preview => {
    const c = latest.current;
    if (!c.canvasSnapshotLoadedRef.current) throw new Error('캔버스를 불러온 뒤 사용할 수 있습니다.');
    assertPlanCurrent(preview, c.itemsRef.current);
    // Resolve the final graph once more in case a new connector arrived since review.
    const current = exportManifest(c.itemsRef.current);
    const source = { ...current, mode: 'merge', items: Object.fromEntries([...preview.creates, ...preview.updates].map(({ id, item }) => [id, exportManifest({ [id]: item }).items[id]])), remove: preview.deletes };
    preview = planManifest(source, c.itemsRef.current, c.permission);
    const changed = [];
    const creations = [...preview.creates].sort((a, b) => Number(a.item.kind === 'connector') - Number(b.item.kind === 'connector'));
    for (const { id, item } of creations) {
      if (!c.addItem(id, item)) throw new Error(`${id}: 생성을 처리하지 못했습니다. 일부 변경은 이미 적용되었을 수 있습니다.`);
      if (isCollaborativeItem(item)) c.saveCollaborativeItem(id, { silent: true });
      changed.push(id);
    }
    for (const { id, item } of preview.updates) {
      const previous = c.itemsRef.current[id];
      if (isCollaborativeItem(previous)) {
        const field = collaborativeField(previous);
        c.updateCollaborativeText(id, item[field] || '');
        const next = { ...c.itemsRef.current[id], ...item };
        c.itemsRef.current = { ...c.itemsRef.current, [id]: next };
        c.setItems(currentItems => ({ ...currentItems, [id]: next }));
        c.markItemDirty(id);
        const version = nextPeerSyncVersion(c.syncClockRef, c.syncActorRef);
        c.itemSyncVersionsRef.current.set(id, version);
        // A complete CRDT snapshot also carries metadata not present in geometry messages.
        const shared = { ...next, automerge_snapshot: encodeBase64(Automerge.save(c.getCollaborativeDoc(id, next))), automerge_changes: [] };
        c.peerMeshRef.current?.sendData({ type: 'item_create', item_id: id, item: shared, version }, peer => canPeerAccessItem(next, peer));
        c.saveCollaborativeItem(id, { silent: true });
      } else {
        if (!c.sendItemChange({ type: 'item_update', item_id: id, item: { ...previous, ...item } }, previous)) throw new Error(`${id}: 변경을 처리하지 못했습니다.`);
        c.itemsRef.current = { ...c.itemsRef.current, [id]: { ...previous, ...item } };
        c.setItems(currentItems => ({ ...currentItems, [id]: { ...previous, ...item } }));
      }
      changed.push(id);
    }
    // Remove connectors first, then their objects.
    const deletions = [...preview.deletes].sort((a, b) => Number(c.itemsRef.current[b]?.kind === 'connector') - Number(c.itemsRef.current[a]?.kind === 'connector'));
    for (const id of deletions) if (!c.deleteItem(id)) throw new Error(`${id}: 삭제를 처리하지 못했습니다.`);
    c.refreshSpatialIndex();
    c.selectItems(changed.filter(id => c.itemsRef.current[id]));
    return { created: preview.creates.length, updated: preview.updates.length, deleted: preview.deletes.length, status: 'queued' };
  }, []);
  // Scoped API is available only while this canvas is mounted. No arbitrary code is evaluated.
  useEffect(() => {
    const api = Object.freeze({ canvasId: options.canvasId, read, plan, apply });
    window.frelogCanvas = api;
    return () => { if (window.frelogCanvas === api) delete window.frelogCanvas; };
  }, [options.canvasId, read, plan, apply]);
  return { read, plan, apply };
}
