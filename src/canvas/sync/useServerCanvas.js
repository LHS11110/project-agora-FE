import { TEXT_COLOR_MARK } from '../content/textColors.js';
import { CanvasUndoHistory } from './CanvasUndoHistory.js';
import { assertAccessOperations } from '../permissions/access.js';
import { assertObjectOperations, isLockOnlyOperation } from '../locks/objectLock.js';
import { changedItemIds, changeItems } from '../itemSnapshots.js';
import { HostCanvasView } from '../host/HostCanvasView.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Automerge from '@automerge/automerge/slim';
import { ServerCanvasSession } from './ServerCanvasSession.js';
import { itemOperations, operationIds, validateTranslation, loadItemDoc } from '../host/hostOperations.js';
import { loadEncodedDocument } from '../host/documentCache.js';
import { collaborativeField, encodeBase64 } from '../collaborativeSync.js';

export function useServerCanvas({ accessRef, itemsRef, wsRef, collaborativeDocsRef, collaborativeBaseDocsRef, setToast, setDirtyItems }) {
  const history=useRef(new CanvasUndoHistory()), undoing=useRef(false);
  const [undoCount,setUndoCount]=useState(0);
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
    if (!session.editable) { itemsRef.current = previous; return false; }
    try {
      const operations = itemOperations(previous, next, collaborativeDocsRef.current, knownIds || changedItemIds(previous, next));
      assertAccessOperations(previous, operations, accessRef?.current);
      assertObjectOperations(previous, operations);
      for (const operation of operations) if (operation.doc && !isLockOnlyOperation(operation)) {
        const doc = loadEncodedDocument(operation.doc);
        const base = previous[operation.id]?.automerge_snapshot || operation.base || operation.doc;
        operation.patch.automerge_snapshot = base;
        operation.patch.automerge_changes = Automerge.getChanges(loadEncodedDocument(base), doc).map(change => ({ field: collaborativeField(next[operation.id]), change: encodeBase64(change) }));
      }
      if (!operations.length || session.submit(operations)) { working.current = next; itemsRef.current = next; if (operations.length) { session.redraw(); if(!undoing.current){ history.current.record(previous,working.current,operations.flatMap(operationIds));setUndoCount(history.current.entries.length); } } }
      else { itemsRef.current = previous; return false; }
    return true;
    } catch (error) { itemsRef.current = previous; callbacks.current.setToast(error.message); return false; }
  }, []);
  const patchItems = useCallback((changes, removed = []) => {
    setItems(previous => changeItems(previous, changes, removed), [...new Set([...(changes instanceof Map ? changes.keys() : Object.keys(changes || {})), ...removed])]);
  }, [setItems]);
  const moveItems = useCallback((ids, dx, dy) => {
    if (!dx && !dy) return true;
    const operation = { action: 'translate', ids, dx, dy }, session = sessionRef.current;
    try { assertAccessOperations(working.current, [operation],accessRef?.current); assertObjectOperations(working.current, [operation]); validateTranslation(operation); const before=working.current; if (!session.submit([operation])) return false; session.redraw(); history.current.record(before,working.current,ids);setUndoCount(history.current.entries.length);return true; }
    catch (error) { callbacks.current.setToast(error.message); return false; }
  }, []);
  const undo=useCallback((options={})=>{
    if(!sessionRef.current.editable)return false;
    const oldDocs=new Map();
    const restoreDocs=()=>{for(const [id,doc] of oldDocs)if(doc)collaborativeDocsRef.current.set(id,doc);else collaborativeDocsRef.current.delete(id);};
    try {
      sessionRef.current.flushMoves();
      const restored=history.current.restore(working.current,options);if(!restored)return false;
      for(const id of restored.ids){
        const item=restored.items[id];if(!item || !['text','note','code'].includes(item.kind))continue;
        const field=collaborativeField(item),current=working.current[id];
        oldDocs.set(id,collaborativeDocsRef.current.get(id));
        if(restored.documents.has(id)){collaborativeDocsRef.current.set(id,restored.documents.get(id));continue;}
        const doc=Automerge.clone(collaborativeDocsRef.current.get(id)||loadItemDoc(current||item));
        collaborativeDocsRef.current.set(id,Automerge.change(doc,draft=>{
          if(draft.content!==(item[field]||''))Automerge.splice(draft,['content'],0,draft.content.length,item[field]||'');
          const ranges=restored.textColors.get(id);
          if(ranges){
            if(draft.content.length)Automerge.unmark(draft,['content'],{start:0,end:draft.content.length,expand:'none'},TEXT_COLOR_MARK);
            for(const range of ranges)Automerge.mark(draft,['content'],{start:range.start,end:range.end,expand:'none'},TEXT_COLOR_MARK,range.color);
          }
        }));
      }
      undoing.current=true;
      const accepted=setItems(restored.items,restored.ids);
      undoing.current=false;
      if(accepted){history.current.pop(restored);setUndoCount(history.current.entries.length);return true;}
      restoreDocs();
      return false;
    }catch(error){undoing.current=false;restoreDocs();callbacks.current.setToast(error.message);return false;}
  },[setItems]);
  useEffect(()=>{
    let endTimer = null;
    const cancelEnd = () => { if (endTimer !== null) { clearTimeout(endTimer); endTimer = null; } };
    const seal = () => { cancelEnd(); history.current.seal(); };
    const begin = () => { cancelEnd(); history.current.begin(); };
    // A microtask from window's capture listener runs before React's pointerup
    // handler. Seal after that handler has committed the final ink/eraser frame.
    // A new gesture cancels this timer so an old pointerup cannot split it.
    const end = () => { cancelEnd(); endTimer = setTimeout(seal, 0); };
    const keyStart=event=>{if(!event.repeat && ['Delete','Backspace','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))begin();};
    const keyEnd=event=>{if(['Delete','Backspace','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))seal();};
    window.addEventListener('keydown',keyStart,true);window.addEventListener('keyup',keyEnd);
    window.addEventListener('pointerdown',begin,true);window.addEventListener('pointerup',end,true);window.addEventListener('pointercancel',end,true);
    return()=>{cancelEnd();window.removeEventListener('keydown',keyStart,true);window.removeEventListener('keyup',keyEnd);window.removeEventListener('pointerdown',begin,true);window.removeEventListener('pointerup',end,true);window.removeEventListener('pointercancel',end,true);};
  },[]);
  const flushMoves = useCallback(() => sessionRef.current.flushMoves(), []);
  const receiveServerItems = useCallback((serverItems, data) => sessionRef.current.seed(serverItems, data), []);
  const receiveServerEvent = useCallback(data => sessionRef.current.receiveServer(data), []);
  const retryRejected = useCallback(() => sessionRef.current.retryRejected(), []);
  useEffect(() => { const timer = setInterval(() => sessionRef.current.tick(), 10); return () => clearInterval(timer); }, []);
  return { undo, undoCount, items, setItems, patchItems, moveItems, flushMoves, committedItemsRef, viewRef: view, status, lastReceipt, retryRejected, sessionRef, receiveServerItems, receiveServerEvent };
}
