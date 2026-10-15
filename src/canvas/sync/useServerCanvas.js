import { changedItemIds, changeItems } from '../itemSnapshots.js';
import { HostCanvasView } from '../host/HostCanvasView.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Automerge from '@automerge/automerge/slim';
import { ServerCanvasSession } from './ServerCanvasSession.js';
import { itemOperations, operationIds, validateTranslation } from '../host/hostOperations.js';
import { loadEncodedDocument } from '../host/documentCache.js';
import { collaborativeField, encodeBase64 } from '../collaborativeSync.js';

export function useServerCanvas({ itemsRef, wsRef, collaborativeDocsRef, collaborativeBaseDocsRef, setToast, setDirtyItems }) {
  const [items, publishItems] = useState({});
  const [status, setStatus] = useState({ ready: false, editable: false, queued: 0, blocked: false, message: '서버에서 최신 캔버스를 불러오고 있습니다.' });
  const [lastReceipt, setLastReceipt] = useState(null);
  const view = useRef(null); if (!view.current) view.current = new HostCanvasView();
  const working = useRef(view.current.items), committedItemsRef = useRef({}), sessionRef = useRef(null);
  const callbacks = useRef({ setToast, setDirtyItems }); callbacks.current = { setToast, setDirtyItems };
  if (!sessionRef.current) sessionRef.current = new ServerCanvasSession({
    available: () => wsRef.current?.readyState === 1,
    send: message => {
      const socket = wsRef.current;
      if (socket?.readyState !== 1 || socket.bufferedAmount >= 256 * 1024) return false;
      try { socket.send(JSON.stringify(message.type === 'canvas_ops' ? { ...message, operations: message.operations.map(({ doc, base, ...operation }) => operation) } : message)); return true; } catch { return false; }
    },
    reject: message => callbacks.current.setToast(message), status: setStatus, receipt: setLastReceipt,
    publish: (committed, touched) => {
      const draft = view.current.rebase(committed, touched, sessionRef.current.pendingOperations);
      collaborativeDocsRef.current = view.current.docs; collaborativeBaseDocsRef.current = view.current.bases;
      working.current = draft; itemsRef.current = draft; committedItemsRef.current = committed;
      const pendingIds = new Set(sessionRef.current.pendingOperations.flatMap(operationIds));
      callbacks.current.setDirtyItems?.(current => current.size === pendingIds.size && [...pendingIds].every(id => current.has(id)) ? current : pendingIds);
      publishItems(draft);
    },
  });
  const setItems = useCallback((update, knownIds = null) => {
    const session = sessionRef.current, previous = working.current;
    const next = typeof update === 'function' ? update(previous) : update;
    if (!session.editable) { itemsRef.current = previous; return; }
    try {
      const operations = itemOperations(previous, next, collaborativeDocsRef.current, knownIds || changedItemIds(previous, next));
      for (const operation of operations) if (operation.doc) {
        const doc = loadEncodedDocument(operation.doc);
        const base = previous[operation.id]?.automerge_snapshot || operation.base || operation.doc;
        operation.patch.automerge_snapshot = base;
        operation.patch.automerge_changes = Automerge.getChanges(loadEncodedDocument(base), doc).map(change => ({ field: collaborativeField(next[operation.id]), change: encodeBase64(change) }));
      }
      if (!operations.length || session.submit(operations)) { working.current = next; itemsRef.current = next; if (operations.length) session.redraw(); }
      else itemsRef.current = previous;
    } catch (error) { itemsRef.current = previous; callbacks.current.setToast(error.message); }
  }, []);
  const patchItems = useCallback((changes, removed = []) => {
    setItems(previous => changeItems(previous, changes, removed), [...new Set([...(changes instanceof Map ? changes.keys() : Object.keys(changes || {})), ...removed])]);
  }, [setItems]);
  const moveItems = useCallback((ids, dx, dy) => {
    if (!dx && !dy) return true;
    const operation = { action: 'translate', ids, dx, dy }, session = sessionRef.current;
    try { validateTranslation(operation); if (!session.submit([operation])) return false; session.redraw(); return true; }
    catch (error) { callbacks.current.setToast(error.message); return false; }
  }, []);
  const flushMoves = useCallback(() => sessionRef.current.flushMoves(), []);
  const receiveServerItems = useCallback((serverItems, data) => sessionRef.current.seed(serverItems, data), []);
  const receiveServerEvent = useCallback(data => sessionRef.current.receiveServer(data), []);
  const retryRejected = useCallback(() => sessionRef.current.retryRejected(), []);
  useEffect(() => { const timer = setInterval(() => sessionRef.current.tick(), 10); return () => clearInterval(timer); }, []);
  return { items, setItems, patchItems, moveItems, flushMoves, committedItemsRef, viewRef: view, status, lastReceipt, retryRejected, sessionRef, receiveServerItems, receiveServerEvent };
}
