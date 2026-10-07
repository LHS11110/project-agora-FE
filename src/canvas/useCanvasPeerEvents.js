import { isPenStyle } from './penStyles.js';
import { isObjectFontSize, hasIndependentContentSize } from './objectSize.js';
import { MIN_CONTENT_SCALE, MAX_CONTENT_SCALE } from './objectContentScale.js';
import { isCodeLanguage } from './codeLanguages.js';
import { useCallback } from 'react';
import * as Automerge from '@automerge/automerge/slim';
import {
  canPeerAccessItem,
  collaborativeField,
  compareSyncVersions,
  createActorId,
  decodeBase64,
  INITIAL_SYNC_VERSION,
  isCollaborativeItem,
  normalizeSyncVersion,
  queuePendingPeerEvent,
  takePendingPeerEvents,
} from './collaborativeSync.js';
import { isCanvasSyncItem } from './useCanvasPeerGeometry.js';
import { LASER_COLOR, MAX_REALTIME_STROKE_POINTS, MAX_STROKE_WIDTH, REALTIME_STROKE_BATCH_SIZE } from './canvasConstants.js';

export function useCanvasPeerEvents(options) {
  const {
    collaborativeBaseDocsRef,
    collaborativeDocsRef,
    deletedItemSyncVersionsRef,
    getCollaborativeDoc,
    groupsRef,
    itemEditRevisionRef,
    itemSyncVersionsRef,
    itemsRef,
    markItemDirty,
    newCollaborativeItemsRef,
    pendingPeerItemEventsRef,
    pendingPeerItemEventsSizeRef,
    refreshSpatialIndex,
    remoteDrawingStrokesRef,
    setDirtyItems,
    setItems,
    setLaserStrokes,
    setRemoteDrawingStrokes,
    setRemoteEditors,
    setToast,
    syncClockRef,
  } = options;

  const receivePeerData = useCallback((peer, data, channelName) => {
    if (!data || typeof data !== 'object') return;
    const localPeer = { groups: groupsRef.current, is_admin: groupsRef.current.includes('admin-group') };
    const replayPendingPeerEvents = (itemId) => {
      const queued = takePendingPeerEvents(pendingPeerItemEventsRef, pendingPeerItemEventsSizeRef, itemId);
      for (const entry of queued) receivePeerData(entry.peer, entry.data, entry.channelName);
    };
    if (data.type === 'item_sync_state') {
      if (!['agora-sync', 'agora-bulk'].includes(channelName) || !peer?.peer_id || typeof data.item_id !== 'string'
        || !data.item_id || data.item_id.length > 128) return;
      const key = data.item_id;
      const version = normalizeSyncVersion(data.version);
      if (!version) return;
      const currentVersion = itemSyncVersionsRef.current.get(key)
        || deletedItemSyncVersionsRef.current.get(key)?.version
        || INITIAL_SYNC_VERSION;
      if (compareSyncVersions(version, currentVersion) <= 0) return;
      if (data.action === 'upsert') {
        const item = data.item;
        const previous = itemsRef.current[key];
        if (!isCanvasSyncItem(item) || isCollaborativeItem(item)
          || !canPeerAccessItem(item, localPeer) || !canPeerAccessItem(item, peer)
          || (previous && previous.kind !== item.kind)
          || (previous && (!canPeerAccessItem(previous, localPeer) || !canPeerAccessItem(previous, peer)))) return;
        syncClockRef.current = Math.max(syncClockRef.current, version.clock);
        const next = { ...itemsRef.current, [key]: item };
        itemsRef.current = next;
        itemSyncVersionsRef.current.set(key, version);
        deletedItemSyncVersionsRef.current.delete(key);
        setItems(next);
        if (!previous || previous.x !== item.x || previous.y !== item.y || previous.width !== item.width
          || previous.height !== item.height || previous.rotation !== item.rotation
          || previous.kind !== item.kind || previous.points !== item.points) refreshSpatialIndex();
        return;
      }
      if (data.action === 'delete') {
        const accessItem = { permission: data.permission };
        const previous = itemsRef.current[key];
        if (!canPeerAccessItem(accessItem, localPeer) || !canPeerAccessItem(accessItem, peer)
          || (previous && (!canPeerAccessItem(previous, localPeer) || !canPeerAccessItem(previous, peer)))) return;
        syncClockRef.current = Math.max(syncClockRef.current, version.clock);
        const next = { ...itemsRef.current };
        delete next[key];
        itemsRef.current = next;
        itemSyncVersionsRef.current.set(key, version);
        deletedItemSyncVersionsRef.current.set(key, { version, permission: data.permission });
        if (previous) {
          collaborativeDocsRef.current.delete(key);
          collaborativeBaseDocsRef.current.delete(key);
          newCollaborativeItemsRef.current.delete(key);
          itemEditRevisionRef.current.delete(key);
          setItems(next);
          refreshSpatialIndex();
          setDirtyItems((current) => { const dirty = new Set(current); dirty.delete(key); return dirty; });
          setRemoteEditors((current) => Object.fromEntries(Object.entries(current).filter(([, editor]) => editor.itemId !== key)));
        }
        takePendingPeerEvents(pendingPeerItemEventsRef, pendingPeerItemEventsSizeRef, key);
      }
      return;
    }
    if (data.type === 'stroke_preview') {
      if (channelName !== 'agora-sync') return;
      const strokeId = String(data.stroke_id || '');
      const phase = data.phase;
      const sequence = Number(data.sequence);
      const points = data.points;
      if (!peer?.peer_id || !strokeId || strokeId.length > 100
        || !['start', 'points', 'end', 'cancel'].includes(phase)
        || !Number.isSafeInteger(sequence) || sequence < 0 || sequence > 1000000
        || !Array.isArray(points) || points.length > REALTIME_STROKE_BATCH_SIZE
        || points.some((point) => !point || typeof point.x !== 'number' || typeof point.y !== 'number'
          || !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > 1e6 || Math.abs(point.y) > 1e6
          || (point.pressure !== undefined && (!Number.isFinite(point.pressure) || point.pressure < 0 || point.pressure > 1)))) return;

      const key = `${peer.peer_id}:${strokeId}`;
      const remoteStrokes = remoteDrawingStrokesRef.current;
      if (phase === 'start') {
        if (sequence !== 0 || points.length !== 1 || typeof data.permission !== 'string'
          || !data.permission || data.permission.length > 128
          || typeof data.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(data.color)
          || typeof data.stroke_width !== 'number' || !Number.isFinite(data.stroke_width)) return;
        const strokeItem = { kind: 'stroke', permission: data.permission };
        if (!canPeerAccessItem(strokeItem, localPeer) || !canPeerAccessItem(strokeItem, peer)) return;
        if (remoteStrokes.get(key)?.sequence >= sequence) return;
        remoteStrokes.set(key, {
          id: strokeId,
          peerId: peer.peer_id,
          sequence,
          points,
          color: data.color,
          strokeWidth: Math.max(1, Math.min(MAX_STROKE_WIDTH, data.stroke_width)),
          brush: isPenStyle(data.brush) ? data.brush : undefined,
          opacity: Number.isFinite(data.opacity) ? Math.max(0, Math.min(1, data.opacity)) : 1,
          simulatePressure: data.simulate_pressure !== false,
          complete: false,
          permission: data.permission,
        });
        setRemoteDrawingStrokes([...remoteStrokes.values()]);
        return;
      }

      const previous = remoteStrokes.get(key);
      if (!previous || sequence <= previous.sequence
        || previous.points.length + points.length > MAX_REALTIME_STROKE_POINTS) return;
      if (phase === 'cancel') {
        remoteStrokes.delete(key);
        setRemoteDrawingStrokes([...remoteStrokes.values()]);
        return;
      }
      const nextPoints = [...previous.points, ...points];
      if (phase === 'points') {
        remoteStrokes.set(key, { ...previous, sequence, points: nextPoints });
        setRemoteDrawingStrokes([...remoteStrokes.values()]);
        return;
      }

      remoteStrokes.delete(key);
      setRemoteDrawingStrokes([...remoteStrokes.values()]);
      const item = {
        kind: 'stroke',
        points: nextPoints,
        color: previous.color,
        strokeWidth: previous.strokeWidth,
        brush: previous.brush,
        opacity: previous.opacity,
        simulatePressure: previous.simulatePressure,
        complete: true,
        permission: previous.permission,
      };
      if (!itemsRef.current[strokeId]) {
        itemsRef.current = { ...itemsRef.current, [strokeId]: item };
        setItems((current) => ({ ...current, [strokeId]: item }));
        refreshSpatialIndex();
      }
      return;
    }
    if (data.type === 'editor_presence' && data.item_id && typeof data.editing === 'boolean' && peer?.peer_id) {
      const key = String(data.item_id);
      const item = itemsRef.current[key];
      if (!isCollaborativeItem(item) || !canPeerAccessItem(item, localPeer) || !canPeerAccessItem(item, peer)) return;
      setRemoteEditors((current) => {
        const next = { ...current };
        if (data.editing) {
          next[peer.peer_id] = {
            peerId: peer.peer_id,
            itemId: key,
            nickname: String(peer.nickname || '참여자'),
            tag_number: peer.tag_number ?? '?',
          };
        } else if (next[peer.peer_id]?.itemId === key) {
          delete next[peer.peer_id];
        }
        return next;
      });
      return;
    }
    if (data.type === 'item_create' && data.item_id && isCollaborativeItem(data.item)) {
      const key = String(data.item_id);
      const existing = itemsRef.current[key];
      if (!canPeerAccessItem(data.item, localPeer) || !canPeerAccessItem(data.item, peer)
        || (existing && existing.kind !== data.item.kind)
        || (existing && (!canPeerAccessItem(existing, localPeer) || !canPeerAccessItem(existing, peer)))) return;
      const version = normalizeSyncVersion(data.version) || INITIAL_SYNC_VERSION;
      const tombstone = deletedItemSyncVersionsRef.current.get(key);
      if (tombstone && compareSyncVersions(version, tombstone.version) <= 0) return;
      syncClockRef.current = Math.max(syncClockRef.current, version.clock);
      const localVersion = itemSyncVersionsRef.current.get(key) || INITIAL_SYNC_VERSION;
      const incomingIsNewer = compareSyncVersions(version, localVersion) > 0;
      let item = data.item;
      if (existing && isCollaborativeItem(existing)) {
        try {
          const localDoc = getCollaborativeDoc(key, existing);
          const incomingDoc = Automerge.load(decodeBase64(data.item.automerge_snapshot), { actor: createActorId() });
          const mergedDoc = Automerge.merge(localDoc, incomingDoc);
          collaborativeDocsRef.current.set(key, mergedDoc);
          item = incomingIsNewer
            ? { ...existing, ...data.item, [collaborativeField(data.item)]: mergedDoc.content }
            : { ...data.item, ...existing, [collaborativeField(data.item)]: mergedDoc.content };
        } catch { return; }
      } else {
        try {
          const baseDoc = Automerge.load(decodeBase64(item.automerge_snapshot), { actor: createActorId() });
          collaborativeBaseDocsRef.current.set(key, baseDoc);
          collaborativeDocsRef.current.set(key, baseDoc);
        }
        catch { return; }
      }
      itemsRef.current = { ...itemsRef.current, [key]: item };
      itemSyncVersionsRef.current.set(key, incomingIsNewer ? version : localVersion);
      if (tombstone && compareSyncVersions(version, tombstone.version) > 0) deletedItemSyncVersionsRef.current.delete(key);
      newCollaborativeItemsRef.current.add(key);
      setItems((current) => ({ ...current, [key]: item }));
      if (!existing || existing.x !== item.x || existing.y !== item.y || existing.width !== item.width
        || existing.height !== item.height || existing.rotation !== item.rotation) refreshSpatialIndex();
      markItemDirty(key);
      replayPendingPeerEvents(key);
      return;
    }
    if (data.type === 'doc_snapshot' && data.item_id && data.snapshot) {
      const key = String(data.item_id);
      const item = data.item || itemsRef.current[key];
      const currentItem = itemsRef.current[key];
      if (!isCollaborativeItem(item) || !canPeerAccessItem(item, localPeer) || !canPeerAccessItem(item, peer)
        || (currentItem && currentItem.kind !== item.kind)
        || (currentItem && (!canPeerAccessItem(currentItem, localPeer) || !canPeerAccessItem(currentItem, peer)))) return;
      const version = normalizeSyncVersion(data.version) || INITIAL_SYNC_VERSION;
      const tombstone = deletedItemSyncVersionsRef.current.get(key);
      if (tombstone && compareSyncVersions(version, tombstone.version) <= 0) return;
      syncClockRef.current = Math.max(syncClockRef.current, version.clock);
      try {
        const incomingDoc = Automerge.load(decodeBase64(data.snapshot), { actor: createActorId() });
        const localItem = currentItem;
        const localVersion = itemSyncVersionsRef.current.get(key) || INITIAL_SYNC_VERSION;
        const incomingIsNewer = compareSyncVersions(version, localVersion) > 0;
        const localDoc = localItem ? getCollaborativeDoc(key, localItem) : incomingDoc;
        const mergedDoc = localItem ? Automerge.merge(localDoc, incomingDoc) : incomingDoc;
        if (!localItem && item.automerge_snapshot) {
          collaborativeBaseDocsRef.current.set(key, Automerge.load(decodeBase64(item.automerge_snapshot), { actor: createActorId() }));
        }
        const field = collaborativeField(item);
        const mergedItem = incomingIsNewer
          ? { ...localItem, ...item, [field]: mergedDoc.content }
          : { ...item, ...localItem, [field]: mergedDoc.content };
        collaborativeDocsRef.current.set(key, mergedDoc);
        itemsRef.current = { ...itemsRef.current, [key]: mergedItem };
        itemSyncVersionsRef.current.set(key, incomingIsNewer ? version : localVersion);
        if (tombstone && compareSyncVersions(version, tombstone.version) > 0) deletedItemSyncVersionsRef.current.delete(key);
        setItems((current) => ({ ...current, [key]: mergedItem }));
        if (!localItem) {
          newCollaborativeItemsRef.current.add(key);
        }
        if (!localItem || localItem.x !== mergedItem.x || localItem.y !== mergedItem.y
          || localItem.width !== mergedItem.width || localItem.height !== mergedItem.height
          || localItem.rotation !== mergedItem.rotation) refreshSpatialIndex();
        if (data.dirty) markItemDirty(key);
        replayPendingPeerEvents(key);
      } catch { /* Ignore an invalid/stale Automerge snapshot. */ }
      return;
    }
    if (data.type === 'doc_change' && data.item_id && data.change) {
      const key = String(data.item_id);
      const item = itemsRef.current[key];
      if (!item) {
        const tombstone = deletedItemSyncVersionsRef.current.get(key);
        const version = normalizeSyncVersion(data.version);
        if (!tombstone || (version && compareSyncVersions(version, tombstone.version) > 0)) {
          if (!queuePendingPeerEvent(pendingPeerItemEventsRef, pendingPeerItemEventsSizeRef, key, peer, data, channelName)) {
            setToast('새 객체의 WebRTC 동기화가 지연되고 있습니다. 연결을 유지해 다시 동기화해주세요.');
          }
        }
        return;
      }
      if (!isCollaborativeItem(item) || !canPeerAccessItem(item, localPeer) || !canPeerAccessItem(item, peer)) return;
      const version = normalizeSyncVersion(data.version);
      const tombstone = deletedItemSyncVersionsRef.current.get(key);
      if (tombstone && (!version || compareSyncVersions(version, tombstone.version) <= 0)) return;
      const expectedField = collaborativeField(item);
      if (data.field !== expectedField) return;
      try {
        const doc = Automerge.loadIncremental(getCollaborativeDoc(key, item), decodeBase64(data.change));
        collaborativeDocsRef.current.set(key, doc);
        if (version) {
          syncClockRef.current = Math.max(syncClockRef.current, version.clock);
          const currentVersion = itemSyncVersionsRef.current.get(key) || INITIAL_SYNC_VERSION;
          if (compareSyncVersions(version, currentVersion) > 0) itemSyncVersionsRef.current.set(key, version);
        }
        const nextItem = { ...item, [expectedField]: doc.content };
        itemsRef.current = { ...itemsRef.current, [key]: nextItem };
        setItems((current) => ({ ...current, [key]: nextItem }));
        markItemDirty(key);
      } catch { /* A later snapshot can recover an interrupted peer sync. */ }
      return;
    }
    if (data.type === 'item_metadata' && data.item_id && ['filename', 'language', 'color', 'groupId', 'fontSize'].includes(data.field)) {
      const key = String(data.item_id);
      const item = itemsRef.current[key];
      if (!item) {
        const tombstone = deletedItemSyncVersionsRef.current.get(key);
        const version = normalizeSyncVersion(data.version);
        if (!tombstone || (version && compareSyncVersions(version, tombstone.version) > 0)) {
          if (!queuePendingPeerEvent(pendingPeerItemEventsRef, pendingPeerItemEventsSizeRef, key, peer, data, channelName)) {
            setToast('새 객체의 WebRTC 동기화가 지연되고 있습니다. 연결을 유지해 다시 동기화해주세요.');
          }
        }
        return;
      }
      if (!isCollaborativeItem(item) || !canPeerAccessItem(item, localPeer) || !canPeerAccessItem(item, peer)) return;
      const version = normalizeSyncVersion(data.version);
      const tombstone = deletedItemSyncVersionsRef.current.get(key);
      if (tombstone && (!version || compareSyncVersions(version, tombstone.version) <= 0)) return;
      if (version && compareSyncVersions(version, itemSyncVersionsRef.current.get(key) || INITIAL_SYNC_VERSION) <= 0) return;
      if (typeof data.value !== 'string') return;
      const value = data.value;
      const validMetadata = data.field === 'fontSize' ? item.kind === 'text' && isObjectFontSize(value) : data.field === 'groupId'
        ? value.length <= 128
        : data.field === 'color' ? item.kind === 'note' && /^#[0-9a-f]{6}$/i.test(value)
          : item.kind === 'code' && (data.field === 'filename'
            ? value.length <= 80
            : isCodeLanguage(value));
      if (!validMetadata) return;
      if (version) {
        syncClockRef.current = Math.max(syncClockRef.current, version.clock);
        itemSyncVersionsRef.current.set(key, version);
      }
      const nextValue = data.field === 'fontSize' ? Number(value) : data.field === 'groupId' ? value || null : value;
      if (item[data.field] === nextValue) return;
      const nextItem = { ...item, [data.field]: nextValue };
      itemsRef.current = { ...itemsRef.current, [key]: nextItem };
      setItems((current) => ({ ...current, [key]: nextItem }));
      refreshSpatialIndex();
      markItemDirty(key);
      return;
    }
    if (data.type === 'item_geometry' && data.item_id) {
      if (!['agora-sync', 'agora-bulk', 'agora-cursor'].includes(channelName)) return;
      const key = String(data.item_id);
      const item = itemsRef.current[key];
      if (!item) {
        if (channelName === 'agora-cursor') return;
        const tombstone = deletedItemSyncVersionsRef.current.get(key);
        const version = normalizeSyncVersion(data.version);
        if (!tombstone || (version && compareSyncVersions(version, tombstone.version) > 0)) {
          if (!queuePendingPeerEvent(pendingPeerItemEventsRef, pendingPeerItemEventsSizeRef, key, peer, data, channelName)) {
            setToast('새 객체의 WebRTC 동기화가 지연되고 있습니다. 연결을 유지해 다시 동기화해주세요.');
          }
        }
        return;
      }
      if (!isCanvasSyncItem(item) || ['connector', 'stroke'].includes(item.kind)
        || !canPeerAccessItem(item, localPeer) || !canPeerAccessItem(item, peer)) return;
      const version = normalizeSyncVersion(data.version);
      const tombstone = deletedItemSyncVersionsRef.current.get(key);
      if (tombstone && (!version || compareSyncVersions(version, tombstone.version) <= 0)) return;
      if (version && compareSyncVersions(version, itemSyncVersionsRef.current.get(key) || INITIAL_SYNC_VERSION) <= 0) return;
      const x = Number(data.x);
      const y = Number(data.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e9 || Math.abs(y) > 1e9) return;
      const rotation = data.rotation == null ? item.rotation : Number(data.rotation);
      const safeRotation = Number.isFinite(rotation) ? Math.max(-180, Math.min(180, rotation)) : item.rotation;
      const width = data.width == null ? item.width : Number(data.width);
      const height = data.height == null ? item.height : Number(data.height);
      if (data.fontSize != null && (!hasIndependentContentSize(item) || !isObjectFontSize(data.fontSize))) return;
      const contentScale = data.contentScale == null ? item.contentScale : Number(data.contentScale);
      if (data.contentScale != null && (!Number.isFinite(contentScale) || contentScale < MIN_CONTENT_SCALE || contentScale > MAX_CONTENT_SCALE)) return;
      const axisScales = {};
      for (const field of ['contentScaleX', 'contentScaleY']) {
        if (data[field] == null) continue;
        const value = Number(data[field]);
        if (!Number.isFinite(value) || value < MIN_CONTENT_SCALE || value > MAX_CONTENT_SCALE) return;
        axisScales[field] = value;
      }
      if ((data.width != null && (!Number.isFinite(width) || width <= 0))
        || (data.height != null && (!Number.isFinite(height) || height <= 0))) return;
      const nextItem = {
        ...item,
        x,
        y,
        rotation: safeRotation,
        ...(Number.isFinite(width) && width > 0 ? { width } : {}),
        ...(Number.isFinite(height) && height > 0 ? { height } : {}),
        ...(Number.isFinite(contentScale) && contentScale > 0 ? { contentScale } : {}),
        ...axisScales,
        ...(data.fontSize != null ? { fontSize: Number(data.fontSize) } : {}),
      };
      if (version) {
        syncClockRef.current = Math.max(syncClockRef.current, version.clock);
        itemSyncVersionsRef.current.set(key, version);
      }
      itemsRef.current = { ...itemsRef.current, [key]: nextItem };
      setItems((current) => ({ ...current, [key]: nextItem }));
      if (item.x !== nextItem.x || item.y !== nextItem.y || item.width !== nextItem.width || item.height !== nextItem.height || item.rotation !== nextItem.rotation || item.contentScale !== nextItem.contentScale || item.contentScaleX !== nextItem.contentScaleX || item.contentScaleY !== nextItem.contentScaleY || item.fontSize !== nextItem.fontSize) refreshSpatialIndex();
      if (isCollaborativeItem(item)) markItemDirty(key);
      return;
    }
    if (data.type === 'item_delete' && data.item_id) {
      const key = String(data.item_id);
      const item = itemsRef.current[key];
      const permission = data.permission ?? item?.permission;
      const accessItem = { permission };
      const version = normalizeSyncVersion(data.version);
      const currentVersion = itemSyncVersionsRef.current.get(key) || INITIAL_SYNC_VERSION;
      if (!version || !canPeerAccessItem(accessItem, localPeer) || !canPeerAccessItem(accessItem, peer)
        || (item && (!isCollaborativeItem(item) || !canPeerAccessItem(item, localPeer) || !canPeerAccessItem(item, peer)))
        || compareSyncVersions(version, currentVersion) <= 0) return;
      syncClockRef.current = Math.max(syncClockRef.current, version.clock);
      itemSyncVersionsRef.current.set(key, version);
      deletedItemSyncVersionsRef.current.set(key, { version, permission });
      takePendingPeerEvents(pendingPeerItemEventsRef, pendingPeerItemEventsSizeRef, key);
      if (!item) return;
      const next = { ...itemsRef.current };
      delete next[key];
      itemsRef.current = next;
      collaborativeDocsRef.current.delete(key);
      collaborativeBaseDocsRef.current.delete(key);
      newCollaborativeItemsRef.current.delete(key);
      setItems(next);
      refreshSpatialIndex();
      setDirtyItems((current) => { const dirty = new Set(current); dirty.delete(key); return dirty; });
      setRemoteEditors((current) => Object.fromEntries(Object.entries(current).filter(([, editor]) => editor.itemId !== key)));
    }
  }, [getCollaborativeDoc, markItemDirty, refreshSpatialIndex]);

  const receiveLaser = useCallback((peer, data) => {
    const strokeId = String(data?.stroke_id || '');
    const phase = data?.phase;
    const sequence = Number(data?.sequence);
    const x = Number(data?.x);
    const y = Number(data?.y);
    if (!peer?.peer_id || !strokeId || strokeId.length > 100
      || !['start', 'point', 'end'].includes(phase)
      || !Number.isSafeInteger(sequence) || sequence < 0 || sequence > 10000
      || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) return;

    const key = `remote-${peer.peer_id}-${strokeId}`;
    const now = Date.now();
    setLaserStrokes((current) => {
      const index = current.findIndex((stroke) => stroke.id === key);
      const previous = index >= 0 ? current[index] : null;
      const pointBySequence = { ...(previous?.pointBySequence || {}), [sequence]: { x, y } };
      const points = Object.keys(pointBySequence)
        .sort((a, b) => Number(a) - Number(b))
        .map((pointSequence) => pointBySequence[pointSequence]);
      const next = {
        id: key,
        peerId: peer.peer_id,
        color: LASER_COLOR,
        pointBySequence,
        points,
        active: previous?.endedAt ? false : phase !== 'end',
        updatedAt: now,
        endedAt: phase === 'end' ? previous?.endedAt || now : previous?.endedAt || null,
      };
      if (index < 0) return [...current, next];
      return current.map((stroke, strokeIndex) => strokeIndex === index ? next : stroke);
    });
  }, []);

  return { receivePeerData, receiveLaser };
}
