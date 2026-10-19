import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { useRef, useState } from 'react';
import { api } from '../../api/client.js';
import UserAvatar from '../../components/account/UserAvatar.jsx';
import { groupMember, MAX_GROUP_MEMBERS } from './userGroupModel.js';
import './user-group.css';
export default function UserGroupControls({ item, token, user, onChange }) {
  useUiLocale();
  const [query, setQuery] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const pending = useRef(false), latest = useRef(item); latest.current = item;
  const members = item.members || [];
  const add = profile => {
    const current = latest.current.members || [];
    if (current.some(member => String(member.user_id) === String(profile.user_id))) { setError('이미 그룹에 있는 사용자입니다.'); return; }
    if (current.length >= MAX_GROUP_MEMBERS) { setError('그룹에는 최대 50명까지 추가할 수 있습니다.'); return; }
    onChange({ members: [...current, groupMember(profile, current.length)] }); setError(''); setQuery('');
  };
  const find = async event => {
    event.preventDefault(); if (pending.current) return;
    const index = query.lastIndexOf('#'), nickname = query.slice(0, index).trim(), tag = query.slice(index + 1).trim();
    if (index < 1 || !/^\d+$/.test(tag)) { setError('닉네임#태그 형식으로 입력해주세요.'); return; }
    pending.current = true; setBusy(true); setError('');
    try { add(await api(`/api/users/profiles/${encodeURIComponent(nickname)}/${encodeURIComponent(tag)}`, { token })); }
    catch (failure) { setError(failure.status === 404 ? '사용자를 찾을 수 없습니다.' : failure.message); }
    finally { pending.current = false; setBusy(false); }
  };
  const modify = (index, field, value) => onChange({ members: members.map((member, position) => position === index ? { ...member, [field]: value } : member) });
  return <section className="inspector-section user-group-settings"><strong className="inspector-label">{ui("사용자 그룹")}</strong>
    <label className="form-field"><span>{ui("그룹 이름")}</span><input className="plain-input" maxLength={80} value={item.groupTitle || ''} onChange={event => onChange({ groupTitle: event.target.value })} /></label>
    <form onSubmit={find}><input className="plain-input" aria-label={ui("추가할 사용자 닉네임과 태그")} placeholder={ui("닉네임#태그")} value={query} disabled={busy} onChange={event => setQuery(event.target.value)} /><button className="button button-outline" disabled={busy || members.length >= MAX_GROUP_MEMBERS}>{busy ? ui("찾는 중…") : ui("추가")}</button></form>
    <button type="button" className="button button-outline" disabled={busy || user?.user_id == null || members.some(member => String(member.user_id) === String(user.user_id)) || members.length >= MAX_GROUP_MEMBERS} onClick={() => add(user)}>{ui("내 프로필 추가")}</button>
    {error && <p className="inline-notice error" role="alert">{error}</p>}
    {members.map((member, index) => <div className="user-group-setting-member" key={member.user_id}><UserAvatar user={member} token={token} color={member.borderColor} /><strong>{member.nickname}#{member.tag_number}</strong><label>{ui("테두리")}<input type="color" aria-label={ui("{v0} 테두리 색상", {
  v0: member.nickname
})} value={member.borderColor || '#5d8bba'} onChange={event => modify(index, 'borderColor', event.target.value)} /></label><label>{ui("이름")}<input type="color" aria-label={ui("{v0} 닉네임 색상", {
  v0: member.nickname
})} value={member.nameColor || '#5d8bba'} onChange={event => modify(index, 'nameColor', event.target.value)} /></label><button type="button" aria-label={ui("{v0} 그룹에서 제거", {
  v0: member.nickname
})} onClick={() => onChange({ members: members.filter((_, position) => position !== index) })}>×</button></div>)}
    <small className="inspector-hint">{ui("프로필을 모아 보여주는 객체입니다. 캔버스의 접속 권한은 변경하지 않습니다.")}</small>
  </section>;
}
