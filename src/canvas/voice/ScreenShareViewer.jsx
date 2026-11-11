import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ui} from '../../i18n/locale.js';
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
 </section>,document.body);
}
