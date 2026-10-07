import { useEffect, useRef, useState } from 'react';
import { captureObjects, preparePaste, rememberObjects, rememberedObjects } from './objectClipboard.js';
import { isCollaborativeItem } from '../collaborativeSync.js';

const editable = target => target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), .monaco-editor, .canvas-code-editor, [role="dialog"], dialog, .modal-backdrop, .canvas-as-code-overlay');

export function useObjectClipboard(options) {
  const latest = useRef(options), pointer = useRef(null), pending = useRef(false), generation = useRef(0);
  const lastPaste = useRef({ text: '', repeat: 0 });
  const [busy, setBusy] = useState(false);
  latest.current = options;
  useEffect(() => {
    const move = event => {
      const board = latest.current.boardRef.current;
      const bounds = board?.getBoundingClientRect();
      pointer.current = bounds && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom
        ? { clientX: event.clientX, clientY: event.clientY } : null;
    };
    window.addEventListener('pointermove', move, { passive: true, capture: true });
    window.addEventListener('pointerdown', move, { passive: true, capture: true });
    return () => { generation.current++; window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerdown', move, true); };
  }, [options.canvasId]);
  const disabled = () => latest.current.blocked || latest.current.isInteracting?.() || pending.current;
  const capture = cut => captureObjects(latest.current.itemsRef.current, latest.current.selectedIds, latest.current.canvasId, cut);
  const cutOriginals = (snapshot, localOnly = false) => {
    const c = latest.current;
    if (c.blocked || c.isInteracting?.()) { c.setToast('편집 상태가 변경되어 잘라내기를 취소했습니다. 복사본은 유지됩니다.'); return; }
    if (Object.entries(snapshot.originals).some(([id, item]) => c.itemsRef.current[id] !== item)) { c.setToast('복사 중 객체가 변경되어 잘라내기를 취소했습니다. 복사본은 유지됩니다.'); return; }
    const ids = Object.keys(snapshot.originals).sort((a, b) => Number(snapshot.originals[b].kind === 'connector') - Number(snapshot.originals[a].kind === 'connector'));
    const remaining = [];
    for (const id of ids) if (!c.deleteItem(id)) remaining.push(id);
    c.selectItems(remaining);
    c.setConnectionStartId(null);
    c.setToast(remaining.length ? '일부 객체를 잘라내지 못했습니다. 연결 상태와 권한을 확인해주세요.' : `${ids.length}개 객체를 잘라냈습니다.${localOnly ? ' 브라우저 내부 클립보드를 사용합니다.' : ''}`);
  };
  const pasteText = text => {
    const c = latest.current;
    if (c.blocked || c.isInteracting?.() || !c.canvasSnapshotLoadedRef.current) return;
    const board = c.boardRef.current;
    if (!board) return;
    const bounds = board.getBoundingClientRect();
    const point = c.pointerPosition(pointer.current || { clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2 });
    const repeat = lastPaste.current.text === text ? lastPaste.current.repeat : 0;
    const plan = preparePaste(text, c.itemsRef.current, c.canvasId, c.permission, point, repeat);
    if (!plan) { c.setToast('복사한 FreLog 객체가 없습니다.'); return; }
    const pasted = [];
    for (const { id, item } of plan.creates) {
      if (!c.addItem(id, item)) { c.setToast('일부 객체를 붙여넣지 못했습니다. 연결 상태를 확인해주세요.'); break; }
      if (isCollaborativeItem(item)) c.saveCollaborativeItem(id, { silent: true });
      pasted.push(id);
    }
    c.boardRef.current?.focus({ preventScroll: true });
    c.setActiveTool('select'); c.selectItems(pasted); c.setConnectionStartId(null);
    lastPaste.current = { text, repeat: repeat + 1 };
    if (pasted.length === plan.creates.length) c.setToast(`${pasted.length}개 객체를 붙여넣었습니다.${plan.skipped ? ' 함께 복사되지 않은 연결 대상의 화살표는 제외했습니다.' : ''}`);
  };
  const copy = async (cut = false) => {
    if (disabled()) return;
    const turn = generation.current;
    try {
      const snapshot = capture(cut); if (!snapshot) return;
      pending.current = true; setBusy(true);
      let system = true;
      try { await navigator.clipboard.writeText(snapshot.text); } catch { system = false; }
      if (generation.current !== turn) return;
      rememberObjects(snapshot.text);
      latest.current.boardRef.current?.focus({ preventScroll: true });
      if (cut) cutOriginals(snapshot, !system);
      else latest.current.setToast(`${Object.keys(snapshot.originals).length}개 객체를 복사했습니다.${system ? '' : ' 브라우저 내부 클립보드를 사용합니다.'}`);
    } catch (error) { latest.current.setToast(error.message); }
    finally { pending.current = false; if (generation.current === turn) setBusy(false); }
  };
  const paste = async () => {
    if (disabled()) return;
    const turn = generation.current;
    pending.current = true; setBusy(true);
    try {
      let text;
      try { text = await navigator.clipboard.readText(); } catch { text = rememberedObjects(); }
      if (generation.current === turn) pasteText(text);
    } catch (error) { latest.current.setToast(error.message); }
    finally { pending.current = false; if (generation.current === turn) setBusy(false); }
  };
  const actions = useRef({}); actions.current = { capture, cutOriginals, pasteText, disabled };
  useEffect(() => {
    const handle = event => {
      const c = latest.current, a = actions.current;
      if (a.disabled() || editable(event.target)) return;
      const board = c.boardRef.current;
      if (!board?.contains(event.target) && !event.target?.closest?.('.object-clipboard-controls') && event.target !== document.body) return;
      try {
        if (event.type === 'paste') {
          const text = event.clipboardData?.getData('text/plain');
          if (!text?.includes('"frelog.canvas.objects"')) return;
          event.preventDefault(); event.stopPropagation(); a.pasteText(text);
        } else {
          const snapshot = a.capture(event.type === 'cut'); if (!snapshot || !event.clipboardData) return;
          event.clipboardData.setData('text/plain', snapshot.text);
          event.preventDefault(); event.stopPropagation(); rememberObjects(snapshot.text);
          if (event.type === 'cut') a.cutOriginals(snapshot);
          else c.setToast(`${Object.keys(snapshot.originals).length}개 객체를 복사했습니다.`);
        }
      } catch (error) { event.preventDefault(); c.setToast(error.message); }
    };
    for (const name of ['copy', 'cut', 'paste']) document.addEventListener(name, handle, true);
    return () => { for (const name of ['copy', 'cut', 'paste']) document.removeEventListener(name, handle, true); };
  }, []);
  return { copy: () => copy(false), cut: () => copy(true), paste, busy };
}
