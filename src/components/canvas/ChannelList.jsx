import { useEffect, useId, useRef, useState } from 'react';
import { ui } from '../../i18n/locale.js';
import { CHANNEL_NAME_LIMIT, normalizeChannelName } from '../../canvas/channels/channelModel.js';
import Icon from '../Icon.jsx';

function ChannelNameForm({ initial = '', label, submitLabel, onSubmit, onCancel }) {
  const [value, setValue] = useState(initial), [busy, setBusy] = useState(false), input = useRef(null), id = useId();
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  const submit = async event => {
    event.preventDefault();
    const name = normalizeChannelName(value);
    if (!name || busy) return;
    setBusy(true);
    try { if (await onSubmit(name) !== false) onCancel(); } finally { setBusy(false); }
  };
  return <form className="channel-name-form" onSubmit={submit} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') onCancel(); }}>
    <label className="sr-only" htmlFor={id}>{label}</label>
    <input id={id} ref={input} name="channel-name" value={value} maxLength={CHANNEL_NAME_LIMIT} placeholder={label} onChange={event => setValue(event.target.value)} disabled={busy} autoComplete="off" />
    <button type="submit" disabled={busy || !normalizeChannelName(value)}>{submitLabel}</button>
    <button type="button" onClick={onCancel} aria-label={ui('취소')}><Icon name="close" size={12} /></button>
  </form>;
}

/**
 * Channel list for chat (kind="text") or calls (kind="voice"). Text channels
 * show unread counts; call channels show who is connected in each.
 */
export default function ChannelList({ kind, channels, activeId, unread = {}, members = {}, joinedId = null, canManage = false, onSelect, onCreate, onRename, onDelete }) {
  const [editing, setEditing] = useState(null);
  const icon = kind === 'voice' ? 'volume' : 'chat';
  const label = kind === 'voice' ? ui('통화 채널') : ui('채팅 채널');
  return <nav className={`channel-list channel-list-${kind}`} aria-label={label}>
    <div className="channel-list-heading"><span>{label}</span>{canManage && editing !== 'new' && <button type="button" className="channel-add" onClick={() => setEditing('new')} aria-label={kind === 'voice' ? ui('통화 채널 추가') : ui('채팅 채널 추가')} title={kind === 'voice' ? ui('통화 채널 추가') : ui('채팅 채널 추가')}><Icon name="plus" size={13} /></button>}</div>
    <ul>
      {channels.map(channel => {
        const active = channel.id === activeId, count = unread[channel.id] || 0, inCall = members[channel.id] || [];
        if (editing === channel.id) return <li key={channel.id}><ChannelNameForm initial={channel.name} label={ui('채널 이름')} submitLabel={ui('저장')} onSubmit={name => onRename(channel.id, name)} onCancel={() => setEditing(null)} /></li>;
        return <li key={channel.id} className={`channel-row${active ? ' is-active' : ''}${joinedId === channel.id ? ' is-joined' : ''}`}>
          <button type="button" className="channel-select" aria-current={active ? 'true' : undefined} onClick={() => onSelect(channel.id)}>
            <Icon name={icon} size={13} /><span className="channel-name">{channel.name}</span>
            {count > 0 && !active && <span className="channel-unread" aria-label={`${ui('읽지 않은 메시지')} ${count}`}>{count > 99 ? '99+' : count}</span>}
            {kind === 'voice' && inCall.length > 0 && <span className="channel-member-count" aria-label={`${ui('통화 참여자')} ${inCall.length}`}>{inCall.length}</span>}
          </button>
          {canManage && !channel.builtIn && <span className="channel-actions">
            <button type="button" onClick={() => setEditing(channel.id)} aria-label={`${ui('이름 변경')}: ${channel.name}`} title={ui('이름 변경')}><Icon name="pen" size={12} /></button>
            <button type="button" onClick={() => onDelete(channel.id)} aria-label={`${ui('채널 삭제')}: ${channel.name}`} title={ui('채널 삭제')}><Icon name="trash" size={12} /></button>
          </span>}
          {kind === 'voice' && inCall.length > 0 && <ul className="channel-members">{inCall.map(member => <li key={member.peer_id}>{member.self ? ui('나') : `${member.nickname ?? '?'}#${member.tag_number ?? '?'}`}{member.muted && <Icon name="volumeOff" size={10} />}</li>)}</ul>}
        </li>;
      })}
      {editing === 'new' && <li><ChannelNameForm label={ui('새 채널 이름')} submitLabel={ui('추가')} onSubmit={onCreate} onCancel={() => setEditing(null)} /></li>}
    </ul>
  </nav>;
}
