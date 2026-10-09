import * as Automerge from '@automerge/automerge/slim';
import { CANVAS_ITEM_FIELDS, exportManifest, planManifest, stable } from '../asCode/manifest.js';
import { canPeerAccessItem, collaborativeField, createActorId, decodeBase64, encodeBase64, isCollaborativeItem } from '../collaborativeSync.js';

export const HOST_PROTOCOL = 1;
export const HOST_PEER_FPS = 30;
export const HOST_SAVE_FPS = 10;
export const HOST_TOMBSTONE_KIND = 'host-tombstone';
export const HOST_VERSION_FIELD = '__host_version';
const reservedId = id => typeof id !== 'string' || !id || id.length > 128 || ['__proto__', 'constructor', 'prototype'].includes(id);

// Bully priority: highest ID among participants who can serve every session group.
// Membership comes from the signaling server, never a local connectivity timeout.
export function electHost(members) {
  const groups = new Set(members.flatMap(peer => peer.groups || []));
  return members.filter(peer => peer.is_admin || [...groups].every(group => peer.groups?.includes(group)))
    .map(peer => peer.peer_id).sort().at(-1) || '';
}

export function loadItemDoc(item) {
  let doc = item.automerge_snapshot
    ? Automerge.load(decodeBase64(item.automerge_snapshot), { actor: createActorId() })
    : Automerge.from({ content: item[collaborativeField(item)] || '' });
  for (const entry of item.automerge_changes || []) doc = Automerge.loadIncremental(doc, decodeBase64(typeof entry === 'string' ? entry : entry.change));
  return doc;
}

export function storedHostItem(record) {
  return record.item ? { ...record.item, [HOST_VERSION_FIELD]: record.version }
    : { kind: HOST_TOMBSTONE_KIND, permission: record.permission, [HOST_VERSION_FIELD]: record.version };
}

export function itemOperations(previous, next, docs) {
  const operations = [];
  for (const id of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    const before = previous[id], after = next[id];
    if (before?.type === 'chat_room' || after?.type === 'chat_room') continue;
    if (!after) { if (before) operations.push({ id, action: 'delete' }); continue; }
    const patch = {}, unset = [];
    for (const field of CANVAS_ITEM_FIELDS) {
      if (stable(before?.[field]) === stable(after[field])) continue;
      if (after[field] === undefined) unset.push(field);
      else patch[field] = after[field];
    }
    if (!before || Object.keys(patch).length || unset.length) {
      const operation = { id, action: before ? 'patch' : 'create', patch, unset };
      if (isCollaborativeItem(after)) {
        const doc = docs?.get(String(id)) || loadItemDoc(after);
        operation.doc = encodeBase64(Automerge.save(doc));
        if (!before && after.automerge_snapshot && after.automerge_snapshot !== operation.doc) operation.base = after.automerge_snapshot;
      }
      operations.push(operation);
    }
  }
  return operations;
}

export function reduceHostOperations(items, operations, peer) {
  if (!Array.isArray(operations) || !operations.length || operations.length > 512) throw new Error('올바른 변경 묶음이 필요합니다.');
  const next = { ...items };
  const touched = new Set();
  for (const operation of operations) {
    const { id, action, patch = {}, unset = [] } = operation || {};
    if (reservedId(id) || !['create', 'patch', 'delete'].includes(action)) throw new Error('올바른 객체 변경이 필요합니다.');
    const previous = next[id];
    if (previous?.type === 'chat_room') throw new Error('채팅방은 객체 변경으로 수정할 수 없습니다.');
    if (previous && !canPeerAccessItem(previous, peer)) throw new Error('객체를 수정할 권한이 없습니다.');
    if (action === 'delete') { if (previous) { delete next[id]; touched.add(id); } continue; }
    if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !Array.isArray(unset)
      || [...Object.keys(patch), ...unset].some(field => !CANVAS_ITEM_FIELDS.has(field))) throw new Error('지원하지 않는 객체 필드입니다.');
    if (action === 'create' && previous) throw new Error('이미 사용 중인 객체 ID입니다.');
    if (action === 'patch' && !previous) throw new Error('이미 삭제된 객체입니다.');
    const item = { ...previous, ...patch };
    for (const field of unset) delete item[field];
    if (previous && previous.kind !== item.kind) throw new Error('기존 객체 종류는 변경할 수 없습니다.');
    if (!canPeerAccessItem(item, peer)) throw new Error('객체 권한을 확인해주세요.');
    if (!peer.is_admin && previous && stable(previous.permission) !== stable(item.permission)) throw new Error('객체 권한을 변경할 수 없습니다.');
    if (!peer.is_admin && !previous) {
      const required = typeof item.permission === 'string' ? [item.permission]
        : Array.isArray(item.permission) ? item.permission : Object.keys(item.permission || {});
      if (required.some(group => !peer.groups?.includes(group))) throw new Error('소속되지 않은 그룹에 객체를 생성할 수 없습니다.');
    }
    if (isCollaborativeItem(item)) {
      if (typeof operation.doc !== 'string') throw new Error('텍스트 변경 문서가 필요합니다.');
      const incoming = Automerge.load(decodeBase64(operation.doc), { actor: createActorId() });
      const doc = previous ? Automerge.merge(loadItemDoc(previous), incoming) : incoming;
      if (typeof doc.content !== 'string') throw new Error('올바른 텍스트 문서가 필요합니다.');
      const base = previous?.automerge_snapshot || operation.base || operation.doc;
      const baseDoc = Automerge.load(decodeBase64(base), { actor: createActorId() });
      item[collaborativeField(item)] = doc.content;
      item.automerge_snapshot = base;
      item.automerge_changes = Automerge.getChanges(baseDoc, doc).map(change => ({ field: collaborativeField(item), change: encodeBase64(change) }));
    }
    next[id] = item;
    touched.add(id);
  }
  // Reuse object/graph validation. ACL is checked above; the manifest validator
  // uses a string permission while server objects can also use arrays/maps.
  const manifest = exportManifest(Object.fromEntries([...touched].filter(id => next[id]).map(id => [id, next[id]])));
  for (const item of Object.values(manifest.items)) item.permission = 'host-validation';
  manifest.remove = [...touched].filter(id => !next[id]);
  planManifest(manifest, items, 'host-validation');
  return { items: next, touched: [...touched] };
}
