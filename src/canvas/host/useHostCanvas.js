import { useCallback, useEffect, useRef, useState } from 'react';
import * as Automerge from '@automerge/automerge/slim';
import { HostCanvasSession } from './HostCanvasSession.js';
import { itemOperations, loadItemDoc, storedHostItem } from './hostOperations.js';
import { collaborativeField, createActorId, decodeBase64, isCollaborativeItem } from '../collaborativeSync.js';
import { createId } from '../canvasIds.js';

/** Local previews include queued drafts; committedItemsRef stays host-authoritative. */
export function useHostCanvas({ itemsRef, peerMeshRef, wsRef, rtcWsRef, collaborativeDocsRef, collaborativeBaseDocsRef, setToast, setDirtyItems }) {
  const [items, publishItems] = useState({});
  const [status, setStatus] = useState({ ready: false, editable: false, queued: 0, blocked: false, isHost: false, hostId: '', message: '호스트와 최신 상태를 동기화하고 있습니다.' });
  const [lastReceipt, setLastReceipt] = useState(null);
  const working = useRef({});
  const committedItemsRef = useRef({});
  const sessionRef = useRef(null);
  const pendingSaves = useRef(new Map());
  const rebasing = useRef(false);
  const callbacks = useRef({ setToast, setDirtyItems });
  callbacks.current = { setToast, setDirtyItems };
  if (!sessionRef.current) sessionRef.current = new HostCanvasSession({
    available: () => {
      if (wsRef.current?.readyState !== 1 || rtcWsRef.current?.readyState !== 1) return false;
      const session = sessionRef.current;
      if (!session?.hostId) return true;
      return session.isHost ? session.members.filter(peer => peer.peer_id !== session.selfId).every(peer => peerMeshRef.current?.isPeerConnected(peer.peer_id))
        : Boolean(peerMeshRef.current?.isPeerConnected(session.hostId));
    },
    send: (peerId, message) => Boolean(peerMeshRef.current?.sendHostData(peerId, message)),
    reject: message => callbacks.current.setToast(message),
    status: next => setStatus(next),
    receipt: result => setLastReceipt(result),
    publish: (committed, touched) => {
      rebasing.current = true;
      const draft = { ...committed };
      const docs = new Map();
      const bases = new Map();
      for (const [id, item] of Object.entries(committed)) if (isCollaborativeItem(item)) {
        try {
          docs.set(id, loadItemDoc(item));
          if (item.automerge_snapshot) bases.set(id, Automerge.load(decodeBase64(item.automerge_snapshot), { actor: createActorId() }));
        } catch { /* A malformed server document retains its plain-text fallback. */ }
      }
      for (const operation of sessionRef.current.pendingOperations) {
        if (operation.action === 'delete') { delete draft[operation.id]; docs.delete(operation.id); bases.delete(operation.id); continue; }
        // A remote deletion/ACL revocation must not be locally resurrected by
        // a pending patch. The host still responds to that queued request.
        if (operation.action === 'patch' && !draft[operation.id]) continue;
        const item = { ...draft[operation.id], ...operation.patch };
        for (const field of operation.unset || []) delete item[field];
        if (operation.doc) {
          try {
            const incoming = Automerge.load(decodeBase64(operation.doc), { actor: createActorId() });
            const doc = docs.has(operation.id) ? Automerge.merge(docs.get(operation.id), incoming) : incoming;
            docs.set(operation.id, doc);
            item[collaborativeField(item)] = doc.content;
            if (!bases.has(operation.id)) bases.set(operation.id, Automerge.load(decodeBase64(operation.base || operation.doc), { actor: createActorId() }));
          } catch { /* The host will reject an invalid proposal. */ }
        }
        draft[operation.id] = item;
      }
      collaborativeDocsRef.current = docs;
      collaborativeBaseDocsRef.current = bases;
      working.current = draft; itemsRef.current = draft;
      committedItemsRef.current = committed;
      const pendingIds = new Set(sessionRef.current.pendingOperations.map(operation => operation.id));
      callbacks.current.setDirtyItems?.(current => {
        const next = new Set(pendingIds);
        if (next.size === current.size && [...next].every(id => current.has(id))) return current;
        return next;
      });
      publishItems(draft);
      rebasing.current = false;
    },
    persist: (changes, term) => {
      const socket = wsRef.current;
      if (!sessionRef.current.isHost || !sessionRef.current.ready || socket?.readyState !== 1) return false;
      const inFlight = new Set([...pendingSaves.current.values()].filter(entry => entry.term === term).flatMap(entry => entry.changes.map(change => change.id)));
      const batch = [], selected = []; let bytes = 0;
      for (const change of changes) {
        const { id, record } = change;
        if (inFlight.has(id)) continue;
        const payload = { type: isCollaborativeItem(record.item) ? 'item_save' : 'item_update',
          item_id: id, request_id: createId(), host_term: term };
        // Persist deletion versions under the original ACL across full restarts.
        payload.item = storedHostItem(record);
        const size = new TextEncoder().encode(JSON.stringify(payload)).length;
        if (size > 12 * 1024 * 1024) { sessionRef.current.abort('객체 저장 데이터가 서버 한도를 초과했습니다.'); return false; }
        if (bytes && bytes + size > 12 * 1024 * 1024) break;
        batch.push(payload); selected.push(change); bytes += size;
      }
      if (!batch.length) return false;
      const requestId = createId();
      try {
        socket.send(JSON.stringify({ type: 'host_item_batch', request_id: requestId, host_term: term, changes: batch }));
        pendingSaves.current.set(requestId, { term, changes: selected });
        return selected.map(change => change.id);
      } catch { return false; }
    },
  });
  const setItems = useCallback(update => {
    if (rebasing.current) return;
    const session = sessionRef.current;
    const previous = working.current;
    const next = typeof update === 'function' ? update(previous) : update;
    if (!session.editable) { itemsRef.current = previous; return; }
    try {
      const operations = itemOperations(previous, next, collaborativeDocsRef.current);
      if (!operations.length || session.submit(operations)) {
        working.current = next; itemsRef.current = next;
        if (operations.length) session.publish(session.items, []);
      }
      else itemsRef.current = previous;
    } catch (error) { itemsRef.current = previous; callbacks.current.setToast(error.message); }
  }, []);
  const receiveServerItems = useCallback(serverItems => {
    pendingSaves.current.clear();
    sessionRef.current.seed(serverItems);
  }, []);
  const retryRejected = useCallback(() => sessionRef.current.retryRejected(), []);
  const receiveServerEvent = useCallback(data => {
    const session = sessionRef.current;
    if (data.type === 'host_batch_result') {
      const entry = pendingSaves.current.get(data.request_id);
      if (!entry) return;
      pendingSaves.current.delete(data.request_id);
      if (!data.ok && entry.term === session.term) {
        const message = `호스트 저장을 확인하지 못해 편집을 중단했습니다: ${data.code || '저장 오류'}. 새로고침해주세요.`;
        session.abort(message); callbacks.current.setToast(message);
      }
    }
    if (data.type === 'error' && (pendingSaves.current.has(data.request_id)
      || ['HOST_TERM_REQUIRED', 'HOST_FENCED', 'HOST_PROTOCOL_REQUIRED', 'HOST_BATCH_INVALID'].includes(data.code))) {
      pendingSaves.current.delete(data.request_id);
      session.abort('호스트 상태를 확인하지 못했습니다. 최신 서버로 연결했는지 확인한 뒤 새로고침해주세요.');
    }
  }, []);
  useEffect(() => {
    // Wake more frequently than the 30 FPS boundary; the session samples with
    // drift correction instead of accidentally halving the rate at 33 ms.
    const timer = setInterval(() => sessionRef.current.tick(), 10);
    return () => clearInterval(timer);
  }, []);
  return { items, setItems, committedItemsRef, status, lastReceipt, retryRejected, sessionRef, receiveServerItems, receiveServerEvent };
}
