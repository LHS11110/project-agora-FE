import * as Automerge from '@automerge/automerge/slim';
import { REALTIME_STROKE_BATCH_SIZE } from './canvasConstants.js';

export { REALTIME_STROKE_BATCH_SIZE } from './canvasConstants.js';

export function encodeBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function decodeBase64(encoded) {
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function collaborativeField(item) {
  return item.kind === 'code' ? 'code' : 'text';
}

export function collaborativeContent(item) {
  return item?.[collaborativeField(item)] || '';
}

export function createActorId() {
  return globalThis.crypto?.randomUUID?.().replaceAll('-', '') || `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

export function makeCollaborativeItem(item) {
  if (!['text', 'note', 'code'].includes(item.kind)) return item;
  const doc = Automerge.from({ content: collaborativeContent(item) });
  return {
    ...item,
    automerge_snapshot: encodeBase64(Automerge.save(doc)),
    automerge_changes: [],
  };
}

export function mergeCollaborativeHistory(...histories) {
  const seen = new Set();
  const merged = [];
  for (const history of histories) {
    for (const entry of history || []) {
      const change = typeof entry === 'string' ? entry : entry?.change;
      if (!change || seen.has(change)) continue;
      seen.add(change);
      merged.push(typeof entry === 'string' ? { change } : entry);
    }
  }
  return merged;
}

export function isCollaborativeItem(item) {
  return ['text', 'note', 'code'].includes(item?.kind);
}

export const INITIAL_SYNC_VERSION = Object.freeze({ clock: 0, actor: 'server' });
export const MAX_PENDING_PEER_EVENT_SIZE = 2 * 1024 * 1024;
export const MAX_PENDING_PEER_EVENTS_SIZE = 16 * 1024 * 1024;
export const MAX_PENDING_PEER_EVENTS_PER_ITEM = 128;

export function normalizeSyncVersion(version) {
  if (!version || !Number.isSafeInteger(version.clock) || version.clock < 0
    || version.clock > Date.now() + 30 * 24 * 60 * 60 * 1000
    || typeof version.actor !== 'string' || !version.actor || version.actor.length > 128) return null;
  return { clock: version.clock, actor: version.actor };
}

export function compareSyncVersions(left, right) {
  const a = normalizeSyncVersion(left) || INITIAL_SYNC_VERSION;
  const b = normalizeSyncVersion(right) || INITIAL_SYNC_VERSION;
  if (a.clock !== b.clock) return a.clock < b.clock ? -1 : 1;
  return a.actor === b.actor ? 0 : a.actor < b.actor ? -1 : 1;
}

export function nextPeerSyncVersion(clockRef, actorRef) {
  const clock = Math.max(Date.now(), clockRef.current + 1);
  clockRef.current = clock;
  return { clock, actor: actorRef.current };
}

export function queuePendingPeerEvent(eventsRef, sizeRef, itemId, peer, data, channelName) {
  const size = typeof data.change === 'string' ? data.change.length : JSON.stringify(data).length;
  if (size > MAX_PENDING_PEER_EVENT_SIZE || sizeRef.current + size > MAX_PENDING_PEER_EVENTS_SIZE) return false;
  let events = eventsRef.current.get(itemId);
  if (!events) {
    events = [];
    eventsRef.current.set(itemId, events);
  }
  if (events.length >= MAX_PENDING_PEER_EVENTS_PER_ITEM) return false;
  events.push({ peer, data, channelName, size });
  sizeRef.current += size;
  return true;
}

export function takePendingPeerEvents(eventsRef, sizeRef, itemId) {
  const events = eventsRef.current.get(itemId) || [];
  eventsRef.current.delete(itemId);
  for (const event of events) sizeRef.current = Math.max(0, sizeRef.current - event.size);
  return events.sort((left, right) => compareSyncVersions(left.data.version, right.data.version));
}

export function canPeerAccessItem(item, peer) {
  if (peer?.is_admin) return true;
  const allowedGroups = new Set(Array.isArray(peer?.groups) ? peer.groups : []);
  const permission = item?.permission;
  const required = typeof permission === 'string' ? [permission]
    : Array.isArray(permission) ? permission
      : permission && typeof permission === 'object'
        ? Object.entries(permission).filter(([, level]) => Number(level) > 0).map(([group]) => group)
        : [];
  return required.some((group) => allowedGroups.has(String(group)));
}

export function sendStrokePreviewPoints(mesh, session, points) {
  if (!mesh || !session || !points?.length) return;
  for (let offset = 0; offset < points.length; offset += REALTIME_STROKE_BATCH_SIZE) {
    session.sequence += 1;
    mesh.sendData({
      type: 'stroke_preview',
      phase: 'points',
      stroke_id: session.id,
      sequence: session.sequence,
      points: points.slice(offset, offset + REALTIME_STROKE_BATCH_SIZE),
    }, (peer) => canPeerAccessItem(session.aclItem, peer));
  }
}

export function sendStrokePreviewStart(mesh, session, firstPoint) {
  if (!mesh || !session || !firstPoint) return;
  mesh.sendData({
    type: 'stroke_preview',
    phase: 'start',
    stroke_id: session.id,
    sequence: 0,
    points: [firstPoint],
    color: session.color,
    stroke_width: session.strokeWidth,
    brush: session.brush,
    opacity: session.opacity,
    simulate_pressure: session.simulatePressure,
    permission: session.permission,
  }, (peer) => canPeerAccessItem(session.aclItem, peer));
}

export function sendStrokePreviewSnapshot(mesh, peer, session, points) {
  if (!mesh || !peer?.peer_id || !session || !points?.length || !canPeerAccessItem(session.aclItem, peer)) return;
  mesh.sendToPeer(peer.peer_id, {
    type: 'stroke_preview',
    phase: 'start',
    stroke_id: session.id,
    sequence: 0,
    points: [points[0]],
    color: session.color,
    stroke_width: session.strokeWidth,
    brush: session.brush,
    opacity: session.opacity,
    simulate_pressure: session.simulatePressure,
    permission: session.permission,
  });
  let sequence = 0;
  for (let offset = 1; offset < points.length; offset += REALTIME_STROKE_BATCH_SIZE) {
    sequence += 1;
    mesh.sendToPeer(peer.peer_id, {
      type: 'stroke_preview',
      phase: 'points',
      stroke_id: session.id,
      sequence,
      points: points.slice(offset, offset + REALTIME_STROKE_BATCH_SIZE),
    });
  }
  session.sequence = Math.max(session.sequence, sequence);
}
