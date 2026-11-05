import Icon from '../../components/Icon.jsx';
import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import CanvasVoiceCall from './CanvasVoiceCall.js';
import {ui} from '../../i18n/locale.js';
import './voice.css';
const errors={VOICE_MIC_DENIED:'마이크 접근을 허용해 주세요.',VOICE_MIC_FAILED:'마이크를 사용할 수 없습니다.',VOICE_CONNECTION_FAILED:'음성 연결에 실패했습니다. 통화에서 나간 후 다시 참여해 주세요.',VOICE_PLAY_BLOCKED:'소리를 재생하려면 클릭해 주세요.'};
export function useCanvasVoiceCall(canvasId,send){
 const call=useMemo(()=>{let iceServers;try{iceServers=JSON.parse(import.meta.env.VITE_WEBRTC_ICE_SERVERS||'null')||undefined;}catch{/* Use the default STUN configuration. */}return new CanvasVoiceCall({send,iceServers});},[canvasId,send]);
 const ref=useRef(call);ref.current=call;
 const state=useSyncExternalStore(call.subscribe,call.getSnapshot);
 useEffect(()=>()=>call.close(),[call]);
 return {call,ref,state};
}
export default function CanvasVoicePanel({voice,onClose}){
 const {call,state}=voice,panel=useRef(null);
 useEffect(()=>{
  const node=panel.current,previous=document.activeElement;
  node.querySelector('button')?.focus({preventScroll:true});
  const outside=event=>{if(!node.contains(event.target)&&!event.target.closest?.('.canvas-voice-trigger'))onClose();};
  const escape=event=>{if(event.key==='Escape'){event.stopPropagation();onClose();}};
  document.addEventListener('pointerdown',outside);node.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);node.removeEventListener('keydown',escape);if(node.contains(document.activeElement)||document.activeElement===document.body)previous?.focus?.({preventScroll:true});};
 },[onClose]);
 const count=state.participants.length+(state.active?1:0);
 return <section ref={panel} className={`canvas-voice${state.active?' is-active':''}`} role="dialog" aria-labelledby="canvas-voice-title" onKeyDown={event=>event.stopPropagation()}>
  <header className="voice-heading"><span className="voice-heading-icon"><Icon name="microphone" size={20}/></span><div><h2 id="canvas-voice-title">{ui('음성 통화')}</h2><span className="voice-status" role="status"><i className={state.active?'is-live':''}/>{ui(state.active?'통화 중':state.ready?'참여할 준비가 되었어요':'캔버스에 연결하는 중…')}</span></div><button className="voice-close" aria-label={ui('음성 통화 패널 닫기')} onClick={onClose}>×</button></header>
  <div className="voice-members-heading"><strong>{ui('참가자')}</strong><span>{count}</span></div>
  <ul className="voice-members">
   {state.active&&<li><span className="voice-avatar is-self"><Icon name="microphone" size={17}/></span><div><strong>{ui('나')}</strong><small>{ui(state.muted?'마이크 꺼짐':'마이크 켜짐')}</small></div><span className={`voice-member-state${state.muted?' is-muted':''}`}>{ui(state.muted?'음소거':'참여 중')}</span></li>}
   {state.participants.map(p=><li key={p.peer_id}><span className="voice-avatar">{(p.nickname||'?').slice(0,1)}</span><div><strong>{p.nickname}<small className="voice-tag">#{p.tag_number}</small></strong><small>{ui(!state.active?'참여 중':p.status==='connected'?'연결됨':p.status==='failed'?'연결 실패':'연결 중')}</small></div><span className={`voice-member-state${p.voice_muted?' is-muted':''}`}>{ui(p.voice_muted?'음소거':'참여 중')}</span></li>)}
   {!count&&<li className="voice-empty"><Icon name="microphone" size={28}/><strong>{ui('첫 번째로 통화에 참여해 보세요')}</strong><span>{ui('같은 캔버스의 참여자와 대화할 수 있어요.')}</span></li>}
  </ul>
  {state.error&&<p className="voice-error" role="alert">{ui(errors[state.error]||'마이크를 사용할 수 없습니다.')}{state.error==='VOICE_PLAY_BLOCKED'&&<button onClick={()=>call.resumeAudio()}>{ui('소리 재생')}</button>}</p>}
  <footer className="voice-footer">
  {!state.active?<><button className="voice-join" disabled={!state.ready||state.pending} onClick={()=>call.join()}><Icon name="microphone" size={17}/>{ui(state.pending?'마이크 연결 중…':'통화 참여')}</button>{state.pending&&<button onClick={()=>call.leave()}>{ui('취소')}</button>}<p>{ui('참여하면 마이크 접근 권한을 요청합니다.')}</p></>:<><div className="voice-actions"><button className={state.muted?'is-toggled':''} aria-pressed={state.muted} onClick={()=>call.mute()}><Icon name="microphone" size={18}/>{ui(state.muted?'마이크 켜기':'마이크 끄기')}</button><button className={state.deafened?'is-toggled':''} aria-pressed={state.deafened} onClick={()=>call.deafen()}><Icon name={state.deafened?'volumeOff':'volume'} size={18}/>{ui(state.deafened?'소리 켜기':'소리 끄기')}</button><button className="voice-leave" onClick={()=>call.leave()}><Icon name="logout" size={18}/>{ui('통화 나가기')}</button></div><p>{ui('패널을 닫아도 통화는 계속됩니다.')}</p></>}
  </footer>
 </section>;
}
