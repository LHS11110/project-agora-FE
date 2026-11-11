import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { useRef, useState, useMemo } from 'react';
import { api } from '../../api/client.js';
import UserAvatar from '../../components/account/UserAvatar.jsx';
import { groupMember, membersFromGroup, MAX_GROUP_MEMBERS } from './userGroupModel.js';
import './user-group.css';

export default function UserGroupControls({ item, token, user, onChange, canvasParticipants = [], settings }) {
  useUiLocale();
  const [query, setQuery] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const pending = useRef(false), latest = useRef(item); latest.current = item;
  const members = item.members || [];

  const groups = settings?.groups || {};
  const groupNames = Object.keys(groups);
  const [selectedGroupPreset, setSelectedGroupPreset] = useState(() => groupNames[0] || '');

  const availableParticipants = useMemo(() => {
    return canvasParticipants.filter(p => !members.some(m => m.nickname === p.nickname && Number(m.tag_number) === Number(p.tag_number)));
  }, [canvasParticipants, members]);

  const resolveMember = (m) => {
    const isSelf = user && user.nickname === m.nickname && Number(user.tag_number) === Number(m.tag_number);
    if (isSelf) return { ...m, ...user };
    const match = canvasParticipants.find(p => p.nickname === m.nickname && Number(p.tag_number) === Number(m.tag_number));
    return match ? { ...m, ...match } : m;
  };

  const add = profile => {
    const current = latest.current.members || [];
    if (current.some(member => member.nickname === profile.nickname && Number(member.tag_number) === Number(profile.tag_number))) {
      setError('이미 그룹에 있는 사용자입니다.');
      return;
    }
    if (current.length >= MAX_GROUP_MEMBERS) {
      setError('그룹에는 최대 50명까지 추가할 수 있습니다.');
      return;
    }
    onChange({ members: [...current, groupMember(profile, current.length)] });
    setError('');
    setQuery('');
  };

  const applyCanvasGroup = () => {
    if (!selectedGroupPreset || !groups[selectedGroupPreset]) return;
    const loaded = membersFromGroup(groups[selectedGroupPreset], canvasParticipants);
    onChange({
      groupTitle: selectedGroupPreset,
      members: loaded,
    });
    setError('');
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

  return <section className="inspector-section user-group-settings">
    <strong className="inspector-label">{ui("사용자 그룹")}</strong>
    <label className="form-field">
      <span>{ui("그룹 이름")}</span>
      <input className="plain-input" maxLength={80} value={item.groupTitle || ''} onChange={event => onChange({ groupTitle: event.target.value })} />
    </label>

    {groupNames.length > 0 && <div className="user-group-preset-section">
      <label className="form-field">
        <span>{ui("캔버스 그룹으로 설정")}</span>
        <div className="user-group-preset-row">
          <select className="plain-input" value={selectedGroupPreset} onChange={e => setSelectedGroupPreset(e.target.value)}>
            {groupNames.map(name => <option key={name} value={name}>{name} ({groups[name]?.length || 0}{ui("명")})</option>)}
          </select>
          <button type="button" className="button button-outline" onClick={applyCanvasGroup}>
            {ui("적용")}
          </button>
        </div>
      </label>
    </div>}

    {availableParticipants.length > 0 && <div className="user-group-quick-add-section">
      <strong className="user-group-subheading">{ui("캔버스 참가자 직접 추가")}</strong>
      <div className="user-group-quick-add-list">
        {availableParticipants.map(person => <div className="user-group-quick-add-item" key={`${person.nickname}#${person.tag_number}`}>
          <UserAvatar user={person} token={token} />
          <div className="user-group-participant-info">
            <strong>{person.nickname}</strong>
            <small>#{person.tag_number}</small>
          </div>
          <button type="button" className="button button-outline user-group-mini-btn" onClick={() => add(person)}>
            +{ui("추가")}
          </button>
        </div>)}
      </div>
    </div>}

    <form onSubmit={find}><input className="plain-input" aria-label={ui("추가할 사용자 닉네임과 태그")} placeholder={ui("닉네임#태그")} value={query} disabled={busy} onChange={event => setQuery(event.target.value)} /><button className="button button-outline" disabled={busy || members.length >= MAX_GROUP_MEMBERS}>{busy ? ui("찾는 중…") : ui("추가")}</button></form>
    <button type="button" className="button button-outline" disabled={busy || user?.user_id == null || members.some(member => member.nickname === user.nickname && Number(member.tag_number) === Number(user.tag_number)) || members.length >= MAX_GROUP_MEMBERS} onClick={() => add(user)}>{ui("내 프로필 추가")}</button>
    {error && <p className="inline-notice error" role="alert">{error}</p>}
    <div className="user-group-members-setting-list">
      {members.map((member, index) => {
        const resolved = resolveMember(member);
        return <div className="user-group-setting-member" key={member.user_id ?? `${member.nickname}#${member.tag_number}`}>
          <div className="user-group-member-main">
            <UserAvatar user={resolved} token={token} color={member.borderColor} />
            <div className="user-group-member-info">
              <strong>{member.nickname}</strong>
              <small>#{member.tag_number}</small>
            </div>
            <button type="button" className="user-group-remove-btn" aria-label={ui("{v0} 그룹에서 제거", { v0: member.nickname })} onClick={() => onChange({ members: members.filter((_, position) => position !== index) })}>
              ×
            </button>
          </div>
          <div className="user-group-member-custom">
            <label className="user-group-color-label">
              <span>{ui("테두리")}</span>
              <input type="color" aria-label={ui("{v0} 테두리 색상", { v0: member.nickname })} value={member.borderColor || '#5d8bba'} onChange={event => modify(index, 'borderColor', event.target.value)} />
            </label>
            <label className="user-group-color-label">
              <span>{ui("이름")}</span>
              <input type="color" aria-label={ui("{v0} 닉네임 색상", { v0: member.nickname })} value={member.nameColor || '#5d8bba'} onChange={event => modify(index, 'nameColor', event.target.value)} />
            </label>
          </div>
        </div>;
      })}
    </div>
    <small className="inspector-hint">{ui("프로필을 모아 보여주는 객체입니다. 캔버스의 접속 권한은 변경하지 않습니다.")}</small>
  </section>;
}
