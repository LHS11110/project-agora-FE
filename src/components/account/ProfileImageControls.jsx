import { useRef, useState } from 'react';
import { api } from '../../api/client.js';
import UserAvatar from './UserAvatar.jsx';
export default function ProfileImageControls({ user, token, onChange, disabled = false, onBusyChange }) {
  const input = useRef(null), pending = useRef(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const upload = async file => {
    if (!file || pending.current || disabled) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) { setMessage('5MB 이하의 PNG 또는 JPEG를 선택해주세요.'); return; }
    const body = new FormData(); body.append('image', file);
    pending.current = true; setBusy(true); onBusyChange?.(true); setMessage('');
    try {
      const result = await api('/api/users/me/profile-image', { method: 'PUT', token, body });
      onChange(current => ({ ...current, profile_image: result.profile_image, avatar_revision: Date.now() }));
      setMessage('프로필 이미지를 변경했습니다.');
    } catch (error) { setMessage(error.message); }
    finally { pending.current = false; setBusy(false); onBusyChange?.(false); }
  };
  const reset = async () => {
    if (pending.current || disabled) return;
    pending.current = true; setBusy(true); onBusyChange?.(true); setMessage('');
    try {
      await api('/api/users/me/profile-image', { method: 'DELETE', token });
      onChange(current => ({ ...current, profile_image: '', avatar_revision: Date.now() }));
      setMessage('기본 이미지로 변경했습니다.');
    } catch (error) { setMessage(error.message); }
    finally { pending.current = false; setBusy(false); onBusyChange?.(false); }
  };
  return <><UserAvatar user={user} token={token} className="avatar-xl" />
    <div className="profile-image-controls"><button type="button" disabled={busy || disabled} onClick={() => input.current.click()}>{busy ? '변경 중…' : '이미지 변경'}</button><button type="button" disabled={busy || disabled} onClick={reset}>기본 이미지</button></div>
    <input hidden ref={input} type="file" accept="image/png,image/jpeg" aria-label="프로필 이미지 선택" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; upload(file); }} />
    {message && <p className="profile-image-message" role="status">{message}</p>}
  </>;
}
