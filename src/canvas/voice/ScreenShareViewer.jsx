import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ui} from '../../i18n/locale.js';
import Icon from '../../components/Icon.jsx';
import './voice.css';
export default function ScreenShareViewer({voice}){
 const {call,state}=voice,{watchingScreen,screenVideo}=state;
 const [expanded,setExpanded]=useState(false),[position,setPosition]=useState(null),video=useRef(null),drag=useRef(null);
 const participant=state.participants.find(p=>p.peer_id===watchingScreen);
 useEffect(()=>{if(video.current)video.current.srcObject=screenVideo||null;return()=>{if(video.current)video.current.srcObject=null;};},[screenVideo,watchingScreen]);
 useEffect(()=>{if(!watchingScreen)setExpanded(false);},[watchingScreen]);
 if(!watchingScreen)return null;
 const move=e=>{if(!drag.current)return;const {x,y,dx,dy}=drag.current;setPosition({left:Math.max(0,Math.min(window.innerWidth-80,x+e.clientX-dx)),top:Math.max(0,Math.min(window.innerHeight-48,y+e.clientY-dy))});};
 return createPortal(<section className={`screen-share-viewer${expanded?' is-expanded':''}`} style={!expanded&&position?{left:position.left,top:position.top,right:'auto',bottom:'auto'}:undefined} aria-label={ui('공유 화면')}>
  <header onPointerDown={e=>{if(expanded||e.target.closest('button'))return;const r=e.currentTarget.parentElement.getBoundingClientRect();drag.current={x:r.left,y:r.top,dx:e.clientX,dy:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={move} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}><strong>{participant?.nickname||ui('공유 화면')}</strong><button onClick={()=>setExpanded(!expanded)} aria-label={ui(expanded?'화면 축소':'화면 확대')}>{expanded?'↙':'↗'}</button><button onClick={()=>call.watchScreen(null)} aria-label={ui('공유 화면 닫기')}>×</button></header>
  <div className="screen-share-video">{!screenVideo&&<span>{ui('화면 연결 중…')}</span>}<video ref={video} autoPlay playsInline muted /></div>
  {state.active&&<footer className="screen-share-toolbar" aria-label={ui('통화 조작')}><div className="screen-share-people" aria-label={ui('참가자')}><span className="screen-share-person is-self" title={ui('나')}>{ui('나')}</span>{state.participants.slice(0,3).map(p=><span className="screen-share-person" key={p.peer_id} title={`${p.nickname}#${p.tag_number}`}>{(p.nickname||'?').slice(0,1)}</span>)}{state.participants.length>3&&<span className="screen-share-person">+{state.participants.length-3}</span>}</div><span className="screen-share-divider"/><button aria-label={ui(state.muted?'마이크 켜기':'마이크 끄기')} title={ui(state.muted?'마이크 켜기':'마이크 끄기')} aria-pressed={state.muted} onClick={()=>call.mute()}><Icon name="microphone" size={16}/></button><button aria-label={ui(state.deafened?'소리 켜기':'소리 끄기')} title={ui(state.deafened?'소리 켜기':'소리 끄기')} aria-pressed={state.deafened} onClick={()=>call.deafen()}><Icon name={state.deafened?'volumeOff':'volume'} size={16}/></button><button className="screen-share-hangup" aria-label={ui('통화 나가기')} title={ui('통화 나가기')} onClick={()=>call.leave()}><Icon name="logout" size={16}/></button></footer>}
 </section>,document.body);
}
