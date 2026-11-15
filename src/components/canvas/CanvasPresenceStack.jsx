import { useEffect, useId, useRef, useState } from 'react';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import UserAvatar from '../account/UserAvatar.jsx';
import Icon from '../Icon.jsx';
import './canvas-presence-stack.css';

export default function CanvasPresenceStack({ participants, token, onManage, watch }) {
  useUiLocale();
  const root = useRef(null), id = useId();
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false), [pinned, setPinned] = useState(false);
  const open = hovered || focused || pinned;
  const close = () => { setHovered(false); setFocused(false); setPinned(false); };
  useEffect(() => {
    if (!pinned) return undefined;
    const outside = event => { if (!root.current?.contains(event.target)) close(); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [pinned]);
  return <div ref={root} className="canvas-presence-stack" data-open={open}
    onPointerEnter={event => { if (event.pointerType !== 'touch') setHovered(true); }} onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setFocused(false); setPinned(false); } }}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
    <button type="button" className="presence-stack-trigger" aria-label={ui('현재 접속 중인 사용자 {count}', {count:participants.length})}
      aria-expanded={open} aria-controls={id} onClick={() => { if (pinned) close(); else setPinned(true); }}>
      <span className="presence-overlapping-avatars" aria-hidden="true">{participants.slice(0,4).map((person,index) =>
        <span className="presence-avatar-card" style={{zIndex:4-index}} key={`${person.nickname}#${person.tag_number}`}><UserAvatar user={person} token={token} /></span>)}
        {!participants.length && <Icon name="user" size={20} />}
      </span>
      {participants.length>4 && <span className="presence-overflow">+{participants.length-4}</span>}
    </button>
    <section id={id} className="presence-fanout" aria-label={ui('현재 접속 중인 사용자')} aria-hidden={!open} inert={open ? undefined : ''}>
      <ul>{participants.map((person,index) => <li className="presence-person-card" style={{'--presence-order':Math.min(index,6)}} key={`${person.nickname}#${person.tag_number}`}>
        <UserAvatar user={person} token={token} /><span className="presence-person-name"><strong>{person.nickname}{person.isSelf && <small>{ui('나')}</small>}</strong><span>#{person.tag_number}</span></span><i aria-hidden="true" />{!person.isSelf&&watch&&(()=>{const target=watch.state.users.find(value=>value.nickname===person.nickname&&Number(value.tag_number)===Number(person.tag_number)&&!value.watching_id);return target?<button type="button" className="presence-watch-button" disabled={Boolean(watch.state.users.find(value=>value.id===watch.state.self_id)?.presenting)} onClick={()=>{watch.follow(target.id,'manual');close();}}>{ui(watch.state.watching_id===target.id?'관전 중':'관전하기')}</button>:null;})()}
      </li>)}</ul>
      {watch&&<div className="presence-watch-actions"><span>{ui(watch.state.watching_id?'다른 사용자의 시점을 보고 있습니다.':'참가자에게 내 시점을 공유합니다.')}</span><button type="button" onClick={()=>{watch.state.watching_id?watch.leave():watch.state.users.find(value=>value.id===watch.state.self_id)?.presenting?watch.stop():watch.start();close();}}>{ui(watch.state.watching_id?'관전 종료':watch.state.users.find(value=>value.id===watch.state.self_id)?.presenting?'발표 종료':'발표 시작')}</button></div>}
      <button type="button" className="presence-manage-button" onClick={() => { close(); onManage(); }}><Icon name="user" size={14} />{ui('참여자 관리')}</button>
    </section>
  </div>;
}
