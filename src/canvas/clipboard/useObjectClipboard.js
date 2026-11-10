import {CopyJob,quickCopy,sameCopy,cacheCopy,writeCopyPromise} from './copyJob.js';
import {pasteBatches,yieldPasteFrame} from './pasteJob.js';
import { ui } from '../../i18n/locale.js';
import { useEffect, useRef, useState } from 'react';
import { collectCopyObjects, serializeCopyObjects, rememberObjects, rememberedObjects, hasLocalOnlyObjects } from './objectClipboard.js';
import { createId } from '../canvasIds.js';
import { clipboardTextObject, externalClipboardObjects } from './externalClipboard.js';
import { isCollaborativeItem } from '../collaborativeSync.js';

const editable = target => target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), .monaco-editor, .canvas-code-editor, [role="dialog"], dialog, .modal-backdrop, .canvas-as-code-overlay');

export function useObjectClipboard(options) {
  const latest = useRef(options), pointer = useRef(null), pending = useRef(false), generation = useRef(0);
  const copyJob=useRef(null),copyCache=useRef(null);if(!copyJob.current)copyJob.current=new CopyJob();
  const lastPaste = useRef({ text: '', repeat: 0 });
  const [busy, setBusy] = useState(false);
  latest.current = options;
  useEffect(() => {
    pending.current = false; pointer.current = null; copyCache.current=null;setBusy(false);
    const move = event => {
      const board = latest.current.boardRef.current;
      const bounds = board?.getBoundingClientRect();
      pointer.current = bounds && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom
        ? { clientX: event.clientX, clientY: event.clientY } : null;
    };
    window.addEventListener('pointermove', move, { passive: true, capture: true });
    window.addEventListener('pointerdown', move, { passive: true, capture: true });
    return () => { generation.current++;copyJob.current.dispose();copyCache.current=null;window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerdown', move, true); };
  }, [options.canvasId]);
  const disabled = () => latest.current.blocked || latest.current.isInteracting?.() || pending.current;
  const capture = cut => collectCopyObjects(latest.current.itemsRef.current,latest.current.selectedIds,latest.current.canvasId,cut,latest.current.spatialIndex?.connectionIndex);
  const cutOriginals = (snapshot, localOnly = false) => {
    const c = latest.current;
    if (c.blocked || c.isInteracting?.()) { c.setToast('편집 상태가 변경되어 잘라내기를 취소했습니다. 복사본은 유지됩니다.'); return; }
    if (Object.entries(snapshot.originals).some(([id, item]) => c.itemsRef.current[id] !== item)) { c.setToast('복사 중 객체가 변경되어 잘라내기를 취소했습니다. 복사본은 유지됩니다.'); return; }
    const ids = Object.keys(snapshot.originals).sort((a, b) => Number(snapshot.originals[b].kind === 'connector') - Number(snapshot.originals[a].kind === 'connector'));
    const remaining = [];
    for (const id of ids) if (!c.deleteItem(id)) remaining.push(id);
    c.selectItems(remaining);
    c.setConnectionStartId(null);
    c.setToast(remaining.length ? '일부 객체를 잘라내지 못했습니다. 연결 상태와 권한을 확인해주세요.' : `${ids.length}개 객체를 잘라냈습니다.${localOnly ? ' 브라우저 내부 클립보드를 사용합니다. 붙여넣기 버튼을 눌러주세요.' : ''}`);
  };
  const pasteText = async text => {
    const c=latest.current;if(c.blocked||c.isInteracting?.()||!c.canvasSnapshotLoadedRef.current||pending.current)return;
    const board=c.boardRef.current;if(!board)return;
    const bounds=board.getBoundingClientRect(),point=c.pointerPosition(pointer.current||{clientX:bounds.left+bounds.width/2,clientY:bounds.top+bounds.height/2});
    const repeat=lastPaste.current.text===text?lastPaste.current.repeat:0,turn=generation.current,canvasId=c.canvasId,pasted=[];
    const canInsert=()=>generation.current===turn&&latest.current.canvasId===canvasId&&!latest.current.blocked&&latest.current.canPaste!==false&&!latest.current.isInteracting?.()&&latest.current.canvasSnapshotLoadedRef.current;
    pending.current=true;setBusy(true);
    try{
      for await(const batch of pasteBatches(text,{canvasId,permission:c.permission,point,repeat},()=>latest.current.itemsRef.current)){
        if(!canInsert())break;
        while(canInsert()&&latest.current.pasteBackpressure?.())await yieldPasteFrame();
        if(!canInsert())break;
        const accepted=latest.current.addItems(batch.creates);if(!accepted)throw Error('일부 객체를 붙여넣지 못했습니다. 연결 상태를 확인해주세요.');
        pasted.push(...batch.creates.map(entry=>entry.id));
        latest.current.setToast(ui('객체 붙여넣기 {count}/{total}',{count:pasted.length,total:batch.total}));
        await yieldPasteFrame();
        if(batch.done){lastPaste.current={text,repeat:repeat+1};latest.current.setToast(ui('객체 {count}개를 붙여넣었습니다.',{count:pasted.length})+(batch.skipped?' '+ui('함께 복사되지 않은 연결 대상의 화살표는 제외했습니다.') : ''));}
      }
      if(canInsert()&&pasted.length){board.focus({preventScroll:true});latest.current.setActiveTool('select');latest.current.selectItems(pasted);latest.current.setConnectionStartId(null);}
    }catch(error){if(generation.current===turn)latest.current.setToast(error.message);}
    finally{if(generation.current===turn){pending.current=false;setBusy(false);}}
  };
  const pasteContent = async content => {
    const c = latest.current;
    if (disabled() || c.canPaste === false || !c.canvasSnapshotLoadedRef.current) return;
    if (content.text?.includes('"frelog.canvas.objects"') && !content.files?.length) { await pasteText(content.text); return; }
    const board = c.boardRef.current;
    if (!board) return;
    const bounds = board.getBoundingClientRect();
    const point = c.pointerPosition(pointer.current || {clientX:bounds.left+bounds.width/2,clientY:bounds.top+bounds.height/2});
    const turn = generation.current, canvasId = c.canvasId;
    const canInsert = () => generation.current === turn && latest.current.canvasId === canvasId && !latest.current.blocked && latest.current.canPaste !== false && !latest.current.isInteracting?.() && latest.current.canvasSnapshotLoadedRef.current;
    pending.current = true; setBusy(true);
    try {
      const objects = externalClipboardObjects(content);
      if (objects.length > 32) throw new Error('한 번에 최대 32개 자료를 붙여넣을 수 있습니다.');
      const ids = []; let skipped = 0;
      for (const [index, definition] of objects.entries()) {
        if (!canInsert()) break;
        const position = {x:point.x+index*.025,y:point.y+index*.04};
        try {
          let id;
          if (definition.file && ['media','image','pdf','sheet'].includes(definition.fileType)) {
            id = await (definition.fileType === 'media' ? c.uploadMedia : definition.fileType === 'image' ? c.uploadImage : definition.fileType === 'sheet' ? c.uploadSheet : c.uploadPdf)?.({target:{files:[definition.file],value:''}}, {position,canInsert});
          } else {
            let item = definition;
            if (definition.file) {
              if (definition.fileType !== 'text' || definition.file.size > 65536) { skipped++; continue; }
              item = clipboardTextObject(await definition.file.text(),definition.file.name);
              if (!canInsert()) break;
            }
            id = createId();
            const value = {...item,x:position.x-item.width/2,y:position.y-(item.height||.2)/2,permission:c.permission};
            if (!c.addItem(id,value)) { skipped++; continue; }
            if (isCollaborativeItem(value)) c.saveCollaborativeItem(id,{silent:true});
          }
          if (id) ids.push(id); else skipped++;
        } catch (error) { skipped++; if(canInsert())c.setToast(error.message); }
      }
      if (!canInsert()) return;
      if (ids.length) { c.setActiveTool('select'); c.selectItems(ids); c.setConnectionStartId(null); board.focus({preventScroll:true}); }
      c.setToast(ids.length ? ui('자료 {count}개를 객체로 붙여넣었습니다.',{count:ids.length}) + (skipped ? ' '+ui('일부 자료는 형식이나 크기 제한으로 제외했습니다.') : '') : '붙여넣을 자료가 없거나 지원하지 않는 형식입니다. 이미지·PDF·CSV·XLSX·텍스트·HTTPS 링크를 사용해주세요.');
    } catch (error) { if(canInsert())c.setToast(error.message); }
    finally { if(generation.current === turn){pending.current = false;setBusy(false);} }
  };
  const copy = async (cut=false,captured=null) => {
    if(disabled())return;
    const turn=generation.current;
    pending.current=true;setBusy(true);
    try{
      const snapshot=captured||capture(cut);if(!snapshot)return;
      const isCurrent=()=>generation.current===turn;
      const prepared=sameCopy(copyCache.current,snapshot)?Promise.resolve({...snapshot,text:copyCache.current.text}):copyJob.current.run(snapshot,latest.current.spatialIndex,isCurrent);
      const written=writeCopyPromise(prepared);
      const result=await prepared,system=await written;
      if(!isCurrent())return;
      copyCache.current=cacheCopy(result);rememberObjects(result.text,!system);
      latest.current.boardRef.current?.focus({preventScroll:true});
      if(cut)cutOriginals(result,!system);
      else latest.current.setToast(`${Object.keys(result.originals).length}개 객체를 복사했습니다.${system?'':' 브라우저 내부 클립보드를 사용합니다. 붙여넣기 버튼을 눌러주세요.'}`);
    }catch(error){if(generation.current===turn)latest.current.setToast(error.message);}
    finally{if(generation.current===turn){pending.current=false;setBusy(false);}}
  };
  const paste = async () => {
    if (disabled() || latest.current.canPaste === false) return;
    const turn = generation.current;
    try {
      let content=hasLocalOnlyObjects()?{text:rememberedObjects()}:null;
      if (!content && navigator.clipboard?.read) {
        try {
          const entries = await navigator.clipboard.read();
          content = {files:[],text:'',html:'',uriList:''};
          for (const entry of entries) {
            const binary = entry.types.includes('image/gif')?'image/gif':entry.types.find(type=>type.startsWith('image/')||type.startsWith('video/')||type==='application/pdf');
            if (binary) { const blob = await entry.getType(binary); content.files.push(new File([blob],binary==='application/pdf'?'clipboard.pdf':binary==='image/gif'?'clipboard.gif':binary.startsWith('video/')?'clipboard.'+binary.split('/')[1]:'clipboard.png',{type:binary})); }
            for (const [type,key] of [['text/plain','text'],['text/html','html'],['text/uri-list','uriList']]) if(entry.types.includes(type))content[key] += await (await entry.getType(type)).text();
          }
        } catch { /* Fall back to text/local objects when rich clipboard access is unavailable. */ }
      }
      if (!content) {
        let text;
        try { text = await navigator.clipboard.readText(); } catch { text = rememberedObjects(); }
        content = {text};
      }
      if (generation.current === turn) await pasteContent(content);
    } catch (error) { if(generation.current === turn)latest.current.setToast(error.message); }
  };
  const actions = useRef({}); actions.current = { capture, copy, cutOriginals, pasteContent, disabled };
  useEffect(() => {
    const handle = event => {
      const c = latest.current, a = actions.current;
      if (a.disabled() || editable(event.target)) return;
      const board = c.boardRef.current;
      const canvasPaste = event.type === 'paste' && board?.closest('.canvas-app-page')?.contains(event.target);
      if (!canvasPaste && !board?.contains(event.target) && !event.target?.closest?.('.object-clipboard-controls') && event.target !== document.body) return;
      try {
        if (event.type === 'paste') {
          if (c.canPaste === false || !event.clipboardData) return;
          const data = event.clipboardData;
          const content = {text:data.getData('text/plain'),html:data.getData('text/html'),uriList:data.getData('text/uri-list'),files:[...data.files]};
          if (!content.text && !content.html && !content.uriList && !content.files.length) return;
          event.preventDefault(); event.stopPropagation(); void a.pasteContent(content);
        } else {
          const cut=event.type==='cut',snapshot=a.capture(cut);if(!snapshot)return;
          event.preventDefault();event.stopPropagation();
          const cached=sameCopy(copyCache.current,snapshot)?copyCache.current:null;
          if(event.clipboardData&&(cached||quickCopy(snapshot))){
            const result=cached?{...snapshot,text:cached.text}:serializeCopyObjects(snapshot);
            event.clipboardData.setData('text/plain',result.text);copyCache.current=cacheCopy(result);rememberObjects(result.text);
            if(cut)a.cutOriginals(result);else c.setToast(`${Object.keys(result.originals).length}개 객체를 복사했습니다.`);
          }else void a.copy(cut,snapshot);
        }
      } catch (error) { event.preventDefault(); c.setToast(error.message); }
    };
    for (const name of ['copy', 'cut', 'paste']) document.addEventListener(name, handle, true);
    return () => { for (const name of ['copy', 'cut', 'paste']) document.removeEventListener(name, handle, true); };
  }, []);
  return { copy: () => copy(false), cut: () => copy(true), paste, busy };
}
