import {useLatestMessages} from '../../canvas/comments/useLatestMessages.js';
import { useRef,useId } from 'react';
import CanvasVoicePanel from '../../canvas/voice/CanvasVoicePanel.jsx';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import Icon from '../Icon.jsx';
import MarkdownText from '../MarkdownText.jsx';
import MentionComposer from '../../canvas/comments/MentionComposer.jsx';
import './canvas-chat.css';

export default function CanvasChatPanel({ voice, tab='chat', onTabChange, canWrite = true, chatHistoryLoading, connection, hasOlderMessages, loadOlderMessages, message, messages, setMessage, submitMessage, participants, highlight, onHighlightVisible, onHighlightExpired, chatMessageTotal = messages.length }) {
  const locale = useUiLocale(), list = useRef(null), tabId=useId();
  useLatestMessages(list,messages,'chat',highlight,onHighlightVisible,{followNearBottom:true,totalCount:chatMessageTotal,onHighlightExpired});
  const loadingOlder=useRef(false),touchY=useRef(null);
  if(!chatHistoryLoading)loadingOlder.current=false;
  const loadAtTop=()=>{if(list.current?.clientHeight&&list.current.scrollTop<=1&&hasOlderMessages&&!chatHistoryLoading&&!loadingOlder.current){loadingOlder.current=true;loadOlderMessages();}};
  return <section className="canvas-chat-panel communication-panel" id="canvas-communication-panel" aria-label={ui('채팅 · 통화')}>
    <div className="communication-header"><div className="communication-tabs" role="tablist" aria-label={ui('대화 방식')} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();const next=event.key==='Home'?'chat':event.key==='End'?'voice':tab==='chat'?'voice':'chat';onTabChange(next);event.currentTarget.querySelector(`[data-tab="${next}"]`)?.focus();}}>
     <button id={`${tabId}-chat-tab`} role="tab" data-tab="chat" aria-selected={tab==='chat'} aria-controls={`${tabId}-chat`} tabIndex={tab==='chat'?0:-1} onClick={()=>onTabChange('chat')}><Icon name="chat" size={14}/>{ui('채팅')}</button>
     <button id={`${tabId}-voice-tab`} role="tab" data-tab="voice" aria-selected={tab==='voice'} aria-controls={`${tabId}-voice`} tabIndex={tab==='voice'?0:-1} onClick={()=>onTabChange('voice')}><Icon name="microphone" size={14}/>{ui('통화')}{voice?.state.active&&<i className="communication-live-dot" aria-hidden="true"/>}</button>
    </div><div className="chat-dock-heading" hidden={tab!=='chat'}><span className="chat-message-count">{messages.length}{ui('개 표시')}</span>{hasOlderMessages && <button type="button" className="chat-load-more" onClick={loadOlderMessages} disabled={chatHistoryLoading} aria-busy={chatHistoryLoading} title={ui('이전 메시지 10개 불러오기')}><Icon name={chatHistoryLoading?'reset':'chevron'} size={13} className={chatHistoryLoading?'chat-history-spinner':'chat-history-arrow'}/><span>{chatHistoryLoading ? ui('불러오는 중') : ui('이전 메시지')}</span></button>}</div></div>
    <div className="communication-chat" role="tabpanel" id={`${tabId}-chat`} aria-labelledby={`${tabId}-chat-tab`} hidden={tab!=='chat'}>
    <div className="message-list" ref={list} onScroll={loadAtTop} onWheel={event=>{if(event.deltaY<0)loadAtTop();}} onTouchStart={event=>{touchY.current=event.touches[0]?.clientY??null;}} onTouchMove={event=>{if(touchY.current!==null&&event.touches[0]?.clientY>touchY.current)loadAtTop();}}>{messages.length ? messages.map(entry => <div className={`chat-entry${entry.own ? ' own' : ''}${highlight === entry.id ? ' mention-target' : ''}`} data-message-id={entry.id} key={entry.id}><div className="chat-entry-avatar">{entry.sender.slice(0, 1)}</div><div className="chat-entry-content"><div><strong>{entry.sender}</strong><time>{entry.time.toLocaleTimeString(locale === 'en' ? 'en-US' : 'ko-KR', { hour: '2-digit', minute: '2-digit' })}</time></div><div className="chat-message-bubble"><MarkdownText source={entry.text} /></div></div></div>) : <div className="chat-empty"><span>✳</span><strong>{ui('첫 대화를 시작해보세요.')}</strong><small>{ui('캔버스에 대한 생각을 멤버들과 나눠요.')}</small></div>}</div>
    <div className="chat-compose"><MentionComposer label={ui("채팅 메시지 입력")} placeholder={ui("Markdown 메시지를 남겨보세요...")} value={message} onChange={setMessage} onSubmit={submitMessage} participants={participants} disabled={!canWrite || connection !== 'connected'} /></div>
    </div>
    <div className="communication-call" role="tabpanel" id={`${tabId}-voice`} aria-labelledby={`${tabId}-voice-tab`} hidden={tab!=='voice'}>{voice&&<CanvasVoicePanel voice={voice}/>}</div>
  </section>;
}
