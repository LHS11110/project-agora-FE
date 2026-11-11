import {mediaPosition} from '../canvas/media/mediaModel.js';
import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import {useEffect,useRef,useState} from 'react';
import Icon from './Icon.jsx';
import { inspectShareUrl } from './shareMedia.js';
import './shared-playback.css';
export function playbackTime(state,now=Date.now()){return Math.max(0,(state?.time||0)+(state&&!state.paused?Math.max(0,now-state.updatedAt)/1000:0));}
export default function SharedMediaContent({ item, interactive = true, writable=true, onChange }) {
  useUiLocale();
  const media = inspectShareUrl(item?.url),frame=useRef(null),video=useRef(null),actor=useRef(globalThis.crypto?.randomUUID?.()||String(Math.random())),until=useRef(0),latest=useRef(null),observed=useRef(null),playerReady=useRef(false),reportedState=useRef(null),lastPublished=useRef(null),seekTimer=useRef(null),pendingSeek=useRef(0);
  const [position,setPosition]=useState(0),[duration,setDuration]=useState(0),[blocked,setBlocked]=useState(false);
  latest.current={item,writable,interactive,onChange,duration};
  const sharedTime=state=>mediaPosition(state,latest.current.duration,latest.current.item.mediaLoop);
  const command=(func,args=[])=>frame.current?.contentWindow?.postMessage(JSON.stringify({event:'command',func,args}),'https://www.youtube-nocookie.com');
  const publish=(paused,time)=>{
   const c=latest.current;if(!c.writable||!c.onChange||!Number.isFinite(time))return;
   const state={paused,time:Math.max(0,time),updatedAt:Date.now(),actor:actor.current};
   lastPublished.current=state;
   c.onChange({mediaState:state});
  };
  const apply=()=>{
   command('setLoop',[Boolean(latest.current.item.mediaLoop)]);const state=latest.current.item.mediaState;if(!state)return;
   clearTimeout(seekTimer.current);seekTimer.current=null;
   until.current=Date.now()+1200;if(state.paused)setBlocked(false);const target=sharedTime(state);setPosition(target);
   if(video.current){const node=video.current;if(Math.abs(node.currentTime-target)>.75)node.currentTime=Number.isFinite(node.duration)?Math.min(target,node.duration):target;if(state.paused)node.pause();else node.play().then(()=>setBlocked(false)).catch(()=>setBlocked(true));}
   if(frame.current){command('seekTo',[target,true]);command(state.paused?'pauseVideo':'playVideo');}
  };
  useEffect(()=>{if(item.mediaState?.actor!==actor.current)apply();},[item.mediaState,item.mediaLoop,item.url]);
  useEffect(()=>()=>clearTimeout(seekTimer.current),[item.url]);
  const seek=time=>{
   setPosition(time);until.current=Date.now()+800;
   if(video.current)video.current.currentTime=time;else command('seekTo',[time,true]);
   pendingSeek.current=time;
   // Share at most ten updates per second, including the final drag position.
   if(!seekTimer.current)seekTimer.current=setTimeout(()=>{seekTimer.current=null;publish(latest.current.item.mediaState?.paused??true,pendingSeek.current);},100);
  };
  useEffect(()=>{
   if(media?.mediaType!=='youtube')return;
   playerReady.current=false;observed.current=null;reportedState.current=null;lastPublished.current=null;
   const handshake=()=>{if(playerReady.current)return;frame.current?.contentWindow?.postMessage(JSON.stringify({event:'listening',id:actor.current}),'https://www.youtube-nocookie.com');command('addEventListener',['onReady']);command('addEventListener',['onStateChange']);command('addEventListener',['onAutoplayBlocked']);};
   handshake();const retry=setInterval(handshake,500);
   const receive=event=>{
    if(event.origin!=='https://www.youtube-nocookie.com'||event.source!==frame.current?.contentWindow)return;
    let data;try{data=typeof event.data==='string'?JSON.parse(event.data):event.data;}catch{return;}
    if(data.event==='onReady'){if(!playerReady.current){playerReady.current=true;apply();}return;}
    if(!playerReady.current&&['infoDelivery','initialDelivery'].includes(data.event)){playerReady.current=true;apply();}
    if(data.event==='onAutoplayBlocked'){setBlocked(true);return;}
    const info=data.info||{};
    const stateCode=data.event==='onStateChange'?data.info:info.playerState;
    if(stateCode===0&&latest.current.item.mediaLoop){command('seekTo',[0,true]);command('playVideo');return;}
    if([0,1,2].includes(stateCode))reportedState.current=stateCode;
    if(stateCode===1)setBlocked(false);
    if(Number.isFinite(info.duration))setDuration(info.duration);
    if(Number.isFinite(info.currentTime)){
     setPosition(info.currentTime);observed.current={time:info.currentTime,at:Date.now()};
     const c=latest.current,state=lastPublished.current?.updatedAt>=(c.item.mediaState?.updatedAt||0)?lastPublished.current:c.item.mediaState;
     if(Date.now()>until.current&&c.interactive&&document.activeElement===frame.current){if(Math.abs(info.currentTime-sharedTime(state))>1.5)publish(reportedState.current===null?(state?.paused??true):reportedState.current!==1,info.currentTime);}
    }
    // Followers recover from buffering/background throttling without broadcasting echoes.
    const shared=latest.current.item.mediaState;
    if(shared&&Number.isFinite(info.currentTime)&&Date.now()>until.current&&document.activeElement!==frame.current&&reportedState.current===1&&!shared.paused&&Math.abs(info.currentTime-sharedTime(shared))>2.5)apply();
    if([0,1,2].includes(stateCode)&&Date.now()>until.current&&latest.current.interactive&&document.activeElement===frame.current){const paused=stateCode!==1;const current=lastPublished.current?.updatedAt>=(latest.current.item.mediaState?.updatedAt||0)?lastPublished.current:latest.current.item.mediaState;if(paused!==(current?.paused??true))publish(paused,observed.current?.time??sharedTime(current));}
   };
   window.addEventListener('message',receive);return()=>{clearInterval(retry);window.removeEventListener('message',receive);};
  },[item.url]);
  if (!media) return <div className="shared-media-invalid">{ui('올바른 주소가 아닙니다.')}</div>;
  const player = content => <div className="shared-playback" data-object-action={interactive && media.mediaType === 'youtube' ? 'playback' : undefined} onPointerDown={interactive && media.mediaType === 'youtube' ? e=>e.stopPropagation() : undefined} data-playback-paused={item.mediaState?.paused!==false}>
   <div className="shared-media-preview">{content}{!interactive&&<div className="shared-media-activate" aria-hidden="true"/>}</div>
   {interactive&&writable&&onChange&&<div className="shared-playback-controls" data-object-action="playback" onPointerDown={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}>
    <button aria-label={ui(item.mediaState?.paused===false?'공유 일시정지':'공유 재생')} onClick={()=>{clearTimeout(seekTimer.current);seekTimer.current=null;const paused=(lastPublished.current?.updatedAt>=(item.mediaState?.updatedAt||0)?lastPublished.current:item.mediaState)?.paused===false;const time=position;until.current=Date.now()+500;publish(paused,time);if(video.current){if(paused)video.current.pause();else video.current.play().catch(()=>setBlocked(true));}else command(paused?'pauseVideo':'playVideo');}}>{ui(item.mediaState?.paused===false?'일시정지':'재생')}</button>
    <input aria-label={ui('공유 재생 위치')} type="range" min={0} max={Math.max(1,duration,position)} step={.1} value={position} onChange={e=>seek(Number(e.target.value))}/><span>{Math.floor(position)}s</span>
   </div>}
   {interactive&&writable&&onChange&&<button className="shared-playback-loop" data-object-action="playback" aria-label={ui('반복 재생')} title={ui('반복 재생')} aria-pressed={Boolean(item.mediaLoop)} onPointerDown={e=>e.stopPropagation()} onClick={()=>onChange({mediaLoop:!item.mediaLoop})}><span aria-hidden="true">↻</span></button>}
   {blocked&&<button className="shared-playback-unlock" data-object-action="playback" onPointerDown={e=>e.stopPropagation()} onClick={()=>{apply();setBlocked(false);}}>{ui('브라우저에서 공유 재생 허용')}</button>}
  </div>;
  if (media.mediaType === 'youtube') {
    return player(<iframe ref={frame} className="shared-video-player" src={`${media.embedUrl}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&playsinline=1&playlist=${media.videoId||item.videoId||media.embedUrl.split('/').at(-1)}&loop=0`} title={item.title || media.defaultTitle} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen onPointerDown={e=>e.stopPropagation()} onLoad={()=>{frame.current?.contentWindow?.postMessage(JSON.stringify({event:'listening',id:actor.current}),'https://www.youtube-nocookie.com');command('addEventListener',['onReady']);command('addEventListener',['onStateChange']);command('addEventListener',['onAutoplayBlocked']);apply();}}/>);
  }
  if (media.mediaType === 'video') {
    const local=()=>Date.now()>until.current&&writable&&interactive;
    return player(<video key={media.url} ref={video} className="shared-video-player" controls={interactive} playsInline preload="metadata" onPointerDown={e=>{until.current=0;e.stopPropagation();}} onWheel={e=>e.stopPropagation()} onLoadedMetadata={e=>{setDuration(e.currentTarget.duration);apply();}} onPlay={e=>{if(local()&&item.mediaState?.paused!==false)publish(false,e.currentTarget.currentTime);}} onPause={e=>{if(local()&&item.mediaState?.paused!==true)publish(true,e.currentTarget.currentTime);}} onSeeked={e=>{if(local()&&Math.abs(e.currentTarget.currentTime-sharedTime(item.mediaState))>.75)publish(e.currentTarget.paused,e.currentTarget.currentTime);}} onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)} onEnded={e=>{if(local())publish(true,e.currentTarget.currentTime);}}>
      <source src={media.url}/>{ui('브라우저에서 이 동영상을 재생할 수 없습니다.')}</video>);
  }
  return <a className="shared-link-card" href={media.url} target="_blank" rel="noopener noreferrer" onPointerDown={event => event.stopPropagation()}><span className="shared-link-icon"><Icon name="link" size={17}/></span><span className="shared-link-copy"><strong>{item.title||media.defaultTitle}</strong><small>{media.url}</small></span><Icon name="arrow" size={15}/></a>;
}
