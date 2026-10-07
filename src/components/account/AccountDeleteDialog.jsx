import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import Icon from '../Icon.jsx';
import './account-delete.css';

export default function AccountDeleteDialog({ user, token, onClose, onDeleted }) {
  const dialog = useRef(null), request = useRef(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const identity = `${user.nickname}#${user.tag_number}`;
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();
    return () => { element.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const remove = async event => {
    event.preventDefault();
    if (request.current || confirmation !== identity) return;
    request.current = true; setBusy(true); setError('');
    try {
      await api(`/api/users/${encodeURIComponent(user.nickname)}/${encodeURIComponent(user.tag_number)}`, { method: 'DELETE', token });
      onDeleted();
    } catch (failure) {
      setError(failure.code === 'USER_003' || failure.status === 409
        ? '아직 캔버스에 연결되어 있습니다. 다른 탭이나 기기의 캔버스도 닫은 뒤 잠시 기다렸다가 다시 시도해주세요.'
        : failure.status === 403 ? '본인 계정만 삭제할 수 있습니다.'
          : failure.message || '계정을 삭제하지 못했습니다. 다시 시도해주세요.');
    } finally { request.current = false; setBusy(false); }
  };
  return <dialog ref={dialog} className="account-delete-dialog" aria-labelledby="account-delete-title" aria-describedby="account-delete-description" aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!request.current) onClose(); }}>
    <span className="account-delete-symbol"><Icon name="trash" size={24} /></span>
    <h2 id="account-delete-title">계정을 삭제할까요?</h2>
    <p id="account-delete-description"><strong>{identity}</strong> 계정이 탈퇴 처리되어 더 이상 로그인할 수 없습니다. 닉네임은 익명화됩니다.</p>
    <p className="account-delete-note">계정 삭제는 캔버스를 자동으로 삭제하지 않습니다. 소유한 캔버스를 삭제하려면 탈퇴 전에 캔버스 목록에서 정리해주세요.</p>
    <form onSubmit={remove}>
      <label className="form-field"><span>확인을 위해 닉네임과 태그를 입력하세요</span><input className="plain-input" autoFocus autoComplete="off" spellCheck={false} placeholder={identity} value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} /></label>
      {error && <p className="account-delete-error" role="alert">{error}</p>}
      <div className="account-delete-actions"><button type="button" className="button button-outline" disabled={busy} onClick={onClose}>취소</button><button type="submit" className="button account-delete-button" disabled={busy || confirmation !== identity}><Icon name="trash" size={16} />{busy ? '삭제 중…' : '계정 삭제'}</button></div>
    </form>
  </dialog>;
}
