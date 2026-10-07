import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import Icon from '../Icon.jsx';
import './canvas-delete.css';

export default function CanvasDeleteDialog({ canvas, token, onClose, onDeleted }) {
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(false), dialog = useRef(null);
  const name = canvas.canvas_name || '이름 없는 캔버스';
  useEffect(() => {
    const previous = document.activeElement;
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  const remove = async event => {
    event.preventDefault();
    if (request.current || confirmation !== name) return;
    request.current = true; setBusy(true); setError('');
    try {
      await api(`/api/canvases/${encodeURIComponent(canvas.canvas_id)}`, { method: 'DELETE', token });
      onDeleted(canvas.canvas_id);
    } catch (failure) {
      if (failure.status === 404) { onDeleted(canvas.canvas_id); return; }
      setError(failure.status === 403 ? '캔버스 소유자 또는 시스템 관리자만 삭제할 수 있습니다.' : failure.code === 'CANVAS_006' || failure.status === 409 ? '캔버스가 아직 활성 상태이거나 접속 중인 사용자가 있습니다. 모든 사용자가 나간 뒤 잠시 기다렸다가 다시 시도해주세요.' : failure.message || '삭제하지 못했습니다. 다시 시도해주세요.');
    } finally { request.current = false; setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="modal-card canvas-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="canvas-delete-title" aria-describedby="canvas-delete-description" aria-busy={busy} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); if (!busy) onClose(); }
      if (event.key === 'Tab') {
        const controls = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
        const first = controls[0], last = controls.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <span className="canvas-delete-symbol"><Icon name="trash" size={23} /></span>
      <h2 id="canvas-delete-title">캔버스를 삭제할까요?</h2>
      <p id="canvas-delete-description"><strong>{name}</strong>의 객체와 자료가 영구 삭제됩니다. 삭제 후에는 복구할 수 없습니다.</p>
      <p className="canvas-delete-permission">소유자 또는 시스템 관리자만 삭제할 수 있습니다. 접속 중인 사용자가 모두 나간 후 진행해주세요.</p>
      <form onSubmit={remove}><label className="form-field"><span>확인을 위해 캔버스 이름을 입력하세요</span><input className="plain-input" autoFocus autoComplete="off" value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} placeholder={name} aria-label="삭제할 캔버스 이름 확인" /></label>
        {error && <p className="canvas-delete-error" role="alert">{error}</p>}
        <div className="canvas-delete-actions"><button type="button" className="button button-outline" disabled={busy} onClick={onClose}>취소</button><button type="submit" className="button canvas-delete-confirm" disabled={busy || confirmation !== name}><Icon name="trash" size={15} />{busy ? '삭제 중…' : '캔버스 삭제'}</button></div>
      </form>
    </section>
  </div>;
}
