import { useEffect, useRef } from 'react';
import { api } from '../../api/client.js';

export function usePdfUpload({ canvasId, token, permission, addItem, centeredItemPosition, createId, setActiveTool, selectItems, setToast }) {
  const busy = useRef(false), active = useRef(true), generation = useRef(0);
  useEffect(() => { active.current = true;generation.current++; return () => { active.current = false;generation.current++;busy.current=false; }; }, [canvasId]);
  return async (event, options = {}) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if(busy.current){setToast('PDF를 업로드하는 중입니다. 완료 후 다시 선택해주세요.');return;}
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { setToast('PDF 파일을 선택해주세요.'); return; }
    if (file.size > 5 * 1024 * 1024) { setToast('PDF는 5MB 이하로 올려주세요.'); return; }
    const current=generation.current,valid=()=>active.current&&generation.current===current&&options.canInsert?.()!==false;
    busy.current = true; setToast('PDF를 읽고 업로드하는 중입니다…');
    try {
      const { pdfThumbnail } = await import('./pdfRuntime.js');
      const thumbnail = await pdfThumbnail(file);
      if (!valid()) return;
      const body = new FormData(); body.append('file', file); if(thumbnail)body.append('thumbnail', thumbnail, 'thumbnail.png');
      const resource = await api(`/api/canvases/${encodeURIComponent(canvasId)}/pdfs`, { method: 'POST', body, token });
      if (!valid()) return;
      const id = createId();
      if (!addItem(id, { kind: 'pdf', ...resource, filename: file.name, ...(options.position ? {x:options.position.x-.15,y:options.position.y-.24} : centeredItemPosition(.3, .48)), width: .3, height: .48, permission })) {
        setToast('PDF 객체를 추가하지 못했습니다. 연결 상태와 권한을 확인해주세요.'); return;
      }
      setActiveTool('select'); selectItems([id]); setToast('PDF를 추가했습니다. 아래 버튼으로 페이지를 넘길 수 있습니다.'); return id;
    } catch (error) {
      if (valid()) setToast(error?.name === 'PasswordException' ? '암호를 해제한 PDF를 올려주세요.' : error.status===413 ? 'PDF는 5MB 이하로 올려주세요.' : error.message || 'PDF를 업로드하지 못했습니다.');
    } finally { if(generation.current===current)busy.current = false; }
  };
}
