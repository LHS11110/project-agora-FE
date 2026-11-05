import Icon from '../../components/Icon.jsx';
import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import CanvasVoiceCall from './CanvasVoiceCall.js';
import {ui} from '../../i18n/locale.js';
import './voice.css';
const errors={VOICE_MIC_DENIED:'마이크 접근을 허용해 주세요.',VOICE_MIC_FAILED:'마이크를 사용할 수 없습니다.',VOICE_CONNECTION_FAILED:'음성 연결을 복구하지 못했습니다. 다시 시도해 주세요.',VOICE_RECONNECT_TIMEOUT:'연결 복구 시간이 초과되어 통화를 종료했습니다. 다시 참여해 주세요.',VOICE_PLAY_BLOCKED:'소리를 재생하려면 클릭해 주세요.'};
export function useCanvasVoiceCall(canvasId,send,identity){
 const call=useMemo(()=>{let iceServers;try{iceServers=JSON.parse(import.meta.env.VITE_WEBRTC_ICE_SERVERS||'null')||undefined;}catch{/* Use the default STUN configuration. */}return new CanvasVoiceCall({send,iceServers});},[canvasId,send,identity]);
 const ref=useRef(call);ref.current=call;
 const state=useSyncExternalStore(call.subscribe,call.getSnapshot);
 useEffect(()=>{call.resume();const online=()=>call.retry();window.addEventListener('online',online);return()=>{window.removeEventListener('online',online);call.close();};},[call]);
 return {call,ref,state};
}
export default function CanvasVoicePanel({voice}){
 const {call,state}=voice,count=state.participants.length+(state.active?1:0);
 return <section className={`canvas-voice${state.active?' is-active':''}`} aria-label={ui('음성 통화')} onKeyDown={event=>event.stopPropagation()}>
  <header className="voice-heading"><span className="voice-status" role="status"><i className={state.reconnecting?'is-reconnecting':state.active?'is-live':''}/>{ui(state.reconnecting?'통화 다시 연결 중…':state.active?'통화 중':state.ready?'참여할 준비가 되었어요':'캔버스에 연결하는 중…')}</span><span className="voice-participant-count">{ui('참가자')} {count}</span></header>
  <div className="voice-controls">
   {!state.active?<><button className="voice-join" disabled={!state.ready||state.pending} onClick={()=>call.join()}><Icon name="microphone" size={16}/>{ui(state.pending?'마이크 연결 중…':'통화 참여')}</button>{state.pending&&<button onClick={()=>call.leave()}>{ui('취소')}</button>}</>:<div className="voice-actions"><button className={state.muted?'is-toggled':''} aria-pressed={state.muted} onClick={()=>call.mute()}><Icon name="microphone" size={16}/>{ui(state.muted?'마이크 켜기':'마이크 끄기')}</button><button className={state.deafened?'is-toggled':''} aria-pressed={state.deafened} onClick={()=>call.deafen()}><Icon name={state.deafened?'volumeOff':'volume'} size={16}/>{ui(state.deafened?'소리 켜기':'소리 끄기')}</button><button className="voice-leave" onClick={()=>call.leave()}><Icon name="logout" size={16}/>{ui('통화 나가기')}</button></div>}
  </div>
  {state.error&&<p className="voice-error" role="alert">{ui(errors[state.error]||'마이크를 사용할 수 없습니다.')}{state.error==='VOICE_CONNECTION_FAILED'&&<button onClick={()=>call.retry()}>{ui('연결 다시 시도')}</button>}{state.error==='VOICE_PLAY_BLOCKED'&&<button onClick={()=>call.resumeAudio()}>{ui('소리 재생')}</button>}</p>}
  <ul className="voice-members">
   {state.active&&<li><span className="voice-avatar is-self"><Icon name="microphone" size={15}/></span><strong>{ui('나')}</strong><small>{ui(state.muted?'음소거':'참여 중')}</small></li>}
   {state.participants.map(p=><li key={p.peer_id} className="voice-peer"><div className="voice-peer-main"><span className="voice-avatar">{(p.nickname||'?').slice(0,1)}</span><strong>{p.nickname}<span className="voice-tag">#{p.tag_number}</span></strong><small>{ui(p.voice_muted?'음소거':!state.active?'참여 중':p.status==='connected'?'연결됨':p.status==='failed'?'연결 실패':p.status==='reconnecting'?'다시 연결 중':'연결 중')}</small></div>
    <label className="voice-peer-volume"><Icon name={p.volume===0?'volumeOff':'volume'} size={12}/><input type="range" min="0" max="100" step="1" value={p.volume} aria-label={ui('{name} 볼륨',{name:`${p.nickname}#${p.tag_number}`})} aria-valuetext={`${p.volume}%`} onChange={event=>call.setPeerVolume(p.peer_id,Number(event.target.value))}/><output aria-hidden="true">{p.volume}%</output></label>
   </li>)}
   {!count&&<li className="voice-empty">{ui('같은 캔버스의 참여자와 대화할 수 있어요.')}</li>}
  </ul>
  <p className="voice-hint">{ui(state.active?'채팅으로 전환하거나 패널을 접어도 통화는 계속됩니다.':'참여하면 마이크 접근 권한을 요청합니다.')}</p>
 </section>;
}
