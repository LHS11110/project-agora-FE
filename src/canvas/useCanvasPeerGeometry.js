import { hasIndependentContentSize, objectFontSize } from './objectSize.js';
import { useCallback, useRef } from 'react';

const REALTIME_ITEM_GEOMETRY_INTERVAL_MS = 32;
const CANVAS_SYNC_ITEM_KINDS = new Set([
  'image', 'link', 'code', 'note', 'table', 'shape', 'text', 'math', 'stroke', 'connector',
]);

export function isCanvasSyncItem(item) {
  return CANVAS_SYNC_ITEM_KINDS.has(item?.kind);
}

export function hasItemGeometryChanged(previous, next) {
  if (!previous || !next) return true;
  const fields = ['x', 'y', 'width', 'height', 'rotation', 'bend', 'contentScale', 'contentScaleX', 'contentScaleY', 'fontSize'];
  return fields.some((field) => (Number(previous[field]) || 0) !== (Number(next[field]) || 0))
    || (previous.kind === 'stroke' && previous.points !== next.points);
}

export function useCanvasPeerGeometry({
  peerMeshRef,
  syncClockRef,
  syncActorRef,
  itemSyncVersionsRef,
  canPeerAccessItem,
  nextPeerSyncVersion,
  onLocalGeometryRef,
}) {
  const lastBroadcastAtRef = useRef(new Map());

  const sendPeerItemGeometry = useCallback((id, item, realtime = false) => {
    if (!item || !isCanvasSyncItem(item) || ['connector', 'stroke'].includes(item.kind)) return false;
    const key = String(id);
    const version = nextPeerSyncVersion(syncClockRef, syncActorRef);
    itemSyncVersionsRef.current.set(key, version);
    const payload = {
      type: 'item_geometry', item_id: key,
      x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation,
      fontSize: hasIndependentContentSize(item) ? objectFontSize(item) : undefined, contentScale: item.contentScale, contentScaleX: item.contentScaleX, contentScaleY: item.contentScaleY,
      version,
    };
    const mesh = peerMeshRef.current;
    return realtime
      ? Boolean(mesh?.sendRealtimeData(payload, (peer) => canPeerAccessItem(item, peer)))
      : Boolean(mesh?.sendData(payload, (peer) => canPeerAccessItem(item, peer)));
  }, [canPeerAccessItem, itemSyncVersionsRef, nextPeerSyncVersion, peerMeshRef, syncActorRef, syncClockRef]);

  const sendRealtimePeerItemGeometry = useCallback((id, item) => {
    const key = String(id);
    onLocalGeometryRef?.current?.(key, item);
    const now = globalThis.performance?.now?.() ?? Date.now();
    const lastSentAt = lastBroadcastAtRef.current.get(key);
    if (lastSentAt != null && now - lastSentAt < REALTIME_ITEM_GEOMETRY_INTERVAL_MS) return;
    lastBroadcastAtRef.current.set(key, now);
    sendPeerItemGeometry(key, item, true);
  }, [onLocalGeometryRef, sendPeerItemGeometry]);

  const clearPeerItemGeometryBroadcast = useCallback((id) => {
    lastBroadcastAtRef.current.delete(String(id));
  }, []);

  return { sendPeerItemGeometry, sendRealtimePeerItemGeometry, clearPeerItemGeometryBroadcast };
}
