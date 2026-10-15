import { encodeDocument,loadEncodedDocument,cachedItemDocument,rememberItemDocument } from './documentCache.js';
import * as Automerge from '@automerge/automerge/slim';
import { CANVAS_ITEM_FIELDS, exportManifest, planManifest, stable } from '../asCode/manifest.js';
import { canPeerAccessItem, collaborativeField, createActorId, decodeBase64, encodeBase64, isCollaborativeItem } from '../collaborativeSync.js';

export const HOST_PROTOCOL = 1;
export const HOST_PEER_FPS = 30;
export const HOST_SAVE_FPS = 10;
export const HOST_MOVE_INTERVAL_MS = 100;
export const HOST_TOMBSTONE_KIND = 'host-tombstone';
export const HOST_VERSION_FIELD = '__host_version';
const reservedId = id => typeof id !== 'string' || !id || id.length > 128 || ['__proto__', 'constructor', 'prototype'].includes(id);

export const operationIds = operation => operation?.action === 'translate' ? operation.ids : [operation?.id];
export function validateTranslation(operation) {
  if (!Array.isArray(operation.ids) || !operation.ids.length || operation.ids.length > 10000
    || operation.ids.some(reservedId) || new Set(operation.ids).size !== operation.ids.length
    || !Number.isFinite(operation.dx) || !Number.isFinite(operation.dy)) throw new Error('올바른 이동 벡터와 객체 ID가 필요합니다.');
}
export function translateItem(item, dx, dy) {
  return item.kind === 'stroke'
    ? { ...item, points: item.points.map(point => ({ ...point, x: point.x + dx, y: point.y + dy })) }
    : { ...item, x: (Number(item.x) || 0) + dx, y: (Number(item.y) || 0) + dy };
}

// Bully priority: highest ID among participants who can serve every session group.
// Membership comes from the signaling server, never a local connectivity timeout.
export function electHost(members) {
  const groups = new Set(members.flatMap(peer => peer.groups || []));
  return members.filter(peer => peer.is_admin || [...groups].every(group => peer.groups?.includes(group)))
    .map(peer => peer.peer_id).sort().at(-1) || '';
}

export function loadItemDoc(item) {
  const cached=cachedItemDocument(item);if(cached)return cached;
  let doc = item.automerge_snapshot
    ? loadEncodedDocument(item.automerge_snapshot)
    : Automerge.from({ content: item[collaborativeField(item)] || '' });
  for (const entry of item.automerge_changes || []) doc = Automerge.loadIncremental(doc, decodeBase64(typeof entry === 'string' ? entry : entry.change));
  rememberItemDocument(item,doc);return doc;
}

export function storedHostItem(record) {
  return record.item ? { ...record.item, [HOST_VERSION_FIELD]: record.version }
    : { kind: HOST_TOMBSTONE_KIND, permission: record.permission, [HOST_VERSION_FIELD]: record.version };
}

export function itemOperations(previous, next, docs, changedIds = null) {
  const operations = [];
  for (const id of changedIds || new Set([...Object.keys(previous), ...Object.keys(next)])) {
    const before = previous[id], after = next[id];
    if (before === after) continue;
    if (before?.type === 'chat_room' || after?.type === 'chat_room') continue;
    if (!after) { if (before) operations.push({ id, action: 'delete' }); continue; }
    const patch = {}, unset = [];
    for (const field of CANVAS_ITEM_FIELDS) {
      if (before?.[field] === after[field]) continue;
      if (stable(before?.[field]) === stable(after[field])) continue;
      if (after[field] === undefined) unset.push(field);
      else patch[field] = after[field];
    }
    if (!before || Object.keys(patch).length || unset.length) {
      const operation = { id, action: before ? 'patch' : 'create', patch, unset };
      if (isCollaborativeItem(after)) {
        const doc = docs?.get(String(id)) || loadItemDoc(after);
        operation.doc = encodeDocument(doc);
        if (!before && after.automerge_snapshot && after.automerge_snapshot !== operation.doc) operation.base = after.automerge_snapshot;
      }
      operations.push(operation);
    }
  }
  return operations;
}

export function reduceHostOperations(items, operations, peer, connectorDependencies = null) {
  if (!Array.isArray(operations) || !operations.length || operations.length > 512) throw new Error('올바른 변경 묶음이 필요합니다.');
  const next = Object.create(items);
  const touched = new Set();
  for (const operation of operations) {
    if (operation?.action === 'translate') {
      validateTranslation(operation);
      for (const id of operation.ids) {
        const previous = next[id];
        if (!previous || previous.kind === 'connector' || previous.type === 'chat_room') throw new Error('이동할 객체를 확인해주세요.');
        if (!canPeerAccessItem(previous, peer)) throw new Error('객체를 수정할 권한이 없습니다.');
        next[id] = translateItem(previous, operation.dx, operation.dy); touched.add(id);
      }
      continue;
    }
    const { id, action, patch = {}, unset = [] } = operation || {};
    if (reservedId(id) || !['create', 'patch', 'delete'].includes(action)) throw new Error('올바른 객체 변경이 필요합니다.');
    const previous = next[id];
    if (previous?.type === 'chat_room') throw new Error('채팅방은 객체 변경으로 수정할 수 없습니다.');
    if (previous && !canPeerAccessItem(previous, peer)) throw new Error('객체를 수정할 권한이 없습니다.');
    if (action === 'delete') { if (previous) { Object.defineProperty(next,id,{value:undefined,enumerable:true,configurable:true,writable:true}); touched.add(id); } continue; }
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
      const incoming = loadEncodedDocument(operation.doc);
      const doc = previous ? Automerge.merge(loadItemDoc(previous), incoming) : incoming;
      if (typeof doc.content !== 'string') throw new Error('올바른 텍스트 문서가 필요합니다.');
      const base = previous?.automerge_snapshot || operation.base || operation.doc;
      const baseDoc = loadEncodedDocument(base);
      item[collaborativeField(item)] = doc.content;
      item.automerge_snapshot = base;
      item.automerge_changes = Automerge.getChanges(baseDoc, doc).map(change => ({ field: collaborativeField(item), change: encodeBase64(change) }));
      rememberItemDocument(item,doc);
    }
    next[id] = item;
    touched.add(id);
  }
  // Reuse object/graph validation. ACL is checked above; the manifest validator
  // uses a string permission while server objects can also use arrays/maps.
  const manifest = exportManifest(Object.fromEntries([...touched].filter(id => next[id]).map(id => [id, next[id]])));
  for (const item of Object.values(manifest.items)) item.permission = 'host-validation';
  manifest.remove = [...touched].filter(id => !next[id]);
  // Validate the touched objects and affected connector graph, without exporting
  // or serializing every unrelated item on each keystroke/stroke frame.
  const contextIds=new Set(touched);
  const dependants=connectorDependencies || (()=>{
    const index=new Map(),seen=new Set();
    for(let table=items;table && table!==Object.prototype;table=Object.getPrototypeOf(table))for(const [id] of Object.entries(table)){
      if(seen.has(id))continue;seen.add(id);const item=items[id];
      if(item?.kind==='connector')for(const target of [item.from,item.to]){if(!index.has(target))index.set(target,new Set());index.get(target).add(id);}
    }return index;
  })();
  for(const id of touched)if(!next[id])for(const connector of dependants.get(id)||[])if(next[connector])contextIds.add(connector);
  for(const id of [...contextIds]){
    const item=next[id];if(item?.kind==='connector'){contextIds.add(item.from);contextIds.add(item.to);}
  }
  // Manifest merge semantics must not restore fields explicitly removed by an
  // operation. Validate touched objects against their finalized state, keeping
  // original entries only for deletion/dependency checks.
  const context=Object.fromEntries([...contextIds].filter(id=>items[id]).map(id=>[id,touched.has(id) && next[id] ? next[id] : items[id]]));
  planManifest(manifest, context, 'host-validation');
  return { items: next, touched: [...touched] };
}
