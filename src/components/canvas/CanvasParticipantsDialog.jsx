import { useState } from 'react';
import Icon from '../Icon.jsx';
import UserAvatar from '../account/UserAvatar.jsx';
import CanvasManagementDialog from './CanvasManagementDialog.jsx';

export default function CanvasParticipantsDialog({ settings, participants = [], token, pending, onClose, onAddParticipant, onRemoveParticipant }) {
  const [nickname, setNickname] = useState('');
  const [tag, setTag] = useState('');
  const valid = nickname.trim() && /^\d+$/.test(tag) && Number.isSafeInteger(Number(tag));
  return <CanvasManagementDialog titleId="participants-title" onClose={onClose}>
    <button className="icon-button modal-close" onClick={onClose} aria-label="닫기"><Icon name="close" /></button>
    <span className="section-kicker">CANVAS PARTICIPANTS</span><h2 id="participants-title">참여자 관리</h2>
    <p>닉네임과 태그로 캔버스 참여자를 추가하거나 제외할 수 있습니다.</p>
    <div className="settings-dialog-content">
      <div className="form-field"><span>참여자 · {participants.length}명</span>
        <div className="participant-chips">{participants.map(person => <span className="participant-chip" key={`${person.nickname}-${person.tag_number}`}>
          <UserAvatar user={person} token={token} className="avatar-small" />{person.nickname}#{person.tag_number}
          <button disabled={pending} onClick={() => onRemoveParticipant(person)} aria-label={`${person.nickname} 참여자 제외`} title="참여자 제외">×</button>
        </span>)}</div>
      </div>
      <form className="setting-row participant-add-row" onSubmit={event => { event.preventDefault(); if (pending || !valid) return; onAddParticipant(nickname.trim(), Number(tag)); setNickname(''); setTag(''); }}>
        <input className="plain-input" aria-label="참여자 닉네임" placeholder="닉네임" value={nickname} onChange={event => setNickname(event.target.value)} />
        <input className="plain-input tag-input" aria-label="참여자 태그" inputMode="numeric" placeholder="태그" value={tag} onChange={event => setTag(event.target.value)} />
        <button className="button button-outline" disabled={pending || !valid}>추가</button>
      </form>
    </div>
    {pending && <div className="settings-pending" role="status"><span className="loader" /> 변경 내용을 확인하고 있어요.</div>}
    <div className="settings-dialog-footer"><span>revision {settings?.settings_revision ?? '—'}</span><button className="button button-dark" onClick={onClose}>완료</button></div>
  </CanvasManagementDialog>;
}
