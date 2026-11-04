import {ui} from '../i18n/locale.js';
import {useEffect, useRef, useState} from 'react';
import {useLocation} from '../routing.jsx';
import {parseYoutube, parseSubtitles} from './youtube.js';
import './youtube.css';
import {PLAYER_OBSTACLES, launcherPosition} from './playerLayout.js';

export default function GlobalYoutubePlayer() {
  const location = useLocation();
  const [open,setOpen]=useState(false), [link,setLink]=useState(''), [video,setVideo]=useState(null);
  const [error,setError]=useState(''), [compact,setCompact]=useState(false), [captions,setCaptions]=useState(true);
  const [cues,setCues]=useState([]), [line,setLine]=useState(''), [playing,setPlaying]=useState(false);
  const [position,setPosition]=useState(null), [width,setWidth]=useState(360), [safeBottom,setSafeBottom]=useState(24);
  const [launcher,setLauncher]=useState(null), [captionName,setCaptionName]=useState(''), [trackTitle,setTrackTitle]=useState('');
  const frame=useRef(null), panel=useRef(null), gesture=useRef(null), cueRef=useRef([]), captionsRef=useRef(true);
  cueRef.current=cues; captionsRef.current=captions;
  const canvas=/^\/canvases\//.test(location.pathname)||location.pathname==='/tutorial';
  const command=(func,args=[])=>frame.current?.contentWindow?.postMessage(JSON.stringify({event:'command',func,args}), 'https://www.youtube.com');
  useEffect(()=>{
    const receive=e=>{
      if(e.origin!=='https://www.youtube.com'||e.source!==frame.current?.contentWindow)return;
      let d;try{d=typeof e.data==='string'?JSON.parse(e.data):e.data;}catch{return;}
      if(d.event==='onStateChange')setPlaying(d.info===1);
      if(d.event==='infoDelivery'){
        if(typeof d.info?.videoData?.title==='string')setTrackTitle(d.info.videoData.title);
        const t=d.info?.currentTime;
        if(Number.isFinite(t))setLine(captionsRef.current?cueRef.current.filter(c=>c.start<=t&&c.end>t).map(c=>c.text).join('\n'):'');
        if(d.info?.playerState!==undefined)setPlaying(d.info.playerState===1);
      }
      if(d.event==='onError'){setPlaying(false);setError(ui("이 영상은 삽입 재생이 제한되었거나 재생할 수 없습니다. 다른 링크를 사용해 주세요."));}
    };
    window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
  },[]);
  useEffect(()=>{
    const update=()=>{
      if(!canvas){setSafeBottom(24);setLauncher(null);return;}
      const obstacles=[...document.querySelectorAll(PLAYER_OBSTACLES)].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
      const next=launcherPosition(innerWidth,innerHeight,obstacles);
      setLauncher(p=>p&&p.left===next.left&&p.top===next.top?p:next);
      const dock=document.querySelector('.canvas-quick-dock');
      setSafeBottom(dock?Math.max(24,innerHeight-dock.getBoundingClientRect().top+20):100);
    };
    update();const timer=setInterval(update,250);window.addEventListener('resize',update);
    return()=>{clearInterval(timer);window.removeEventListener('resize',update);};
  },[canvas]);
  useEffect(()=>{
    const resize=()=>{setWidth(w=>Math.min(w,Math.max(240,innerWidth-24)));setPosition(p=>p?{x:Math.max(12,Math.min(p.x,innerWidth-Math.min(width,Math.max(240,innerWidth-24))-12)),y:Math.max(12,Math.min(p.y,innerHeight-160))}:p);};
    window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);
  },[width]);
  const startGesture=(e,type)=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const r=panel.current.getBoundingClientRect();gesture.current={type,x:e.clientX,y:e.clientY,left:r.left,top:r.top,width:r.width};};
  const move=e=>{const g=gesture.current;if(!g)return;if(g.type==='resize')setWidth(Math.max(240,Math.min(innerWidth-g.left-12,g.width+e.clientX-g.x)));else setPosition({x:Math.max(12,Math.min(innerWidth-(panel.current?.offsetWidth||240)-12,g.left+e.clientX-g.x)),y:Math.max(12,Math.min(innerHeight-(panel.current?.offsetHeight||160)-12,g.top+e.clientY-g.y))});};
  function load(e){e.preventDefault();const parsed=parseYoutube(link);if(!parsed){setError(ui("올바른 유튜브 영상 링크를 입력해 주세요."));return;}setError('');setCues([]);setCaptionName('');setLine('');setPlaying(false);setTrackTitle('');setVideo(parsed);}
  const stop=()=>{setPlaying(false);setTrackTitle('');setVideo(null);setOpen(false);setLine('');setCues([]);};
  return <>
    {!open&&<button className={`youtube-launcher${playing?' is-playing':''}`} data-playback={playing?'playing':video?'paused':'idle'} style={launcher?{left:launcher.left,top:launcher.top,right:'auto',bottom:'auto'}:undefined} aria-label={ui("유튜브 플레이어 열기")} aria-describedby={video?"youtube-launcher-playback":undefined} title={[playing?ui("재생 중"):video?ui("재생 대기 중"):ui("유튜브 플레이어"),trackTitle].filter(Boolean).join(" · ")} onClick={()=>setOpen(true)}><span aria-hidden="true">{playing?<span className="youtube-equalizer"><i/><i/><i/><i/></span>:"♫"}</span>{video&&<span className="youtube-playback-dot" aria-hidden="true"/>}<span id="youtube-launcher-playback" className="youtube-sr-only">{playing?ui("재생 중"):video?ui("재생 대기 중"):""}</span></button>}
    <section ref={panel} className={`youtube-panel ${compact?'is-compact':''}`} aria-label={ui("유튜브 플레이어")} style={{display:open?'block':'none',width:Math.min(width,Math.max(240,window.innerWidth-24)),...(position?{left:position.x,top:position.y,right:'auto',bottom:'auto'}:{right:20,top:88})}}>
      <header><span className="youtube-grip" onPointerDown={e=>startGesture(e,'move')} onPointerMove={move} onPointerUp={()=>gesture.current=null} onPointerCancel={()=>gesture.current=null}>⠿ YouTube</span><button onClick={()=>{setCompact(v=>!v);setWidth(compact?360:260);}} aria-pressed={compact} title={ui("오디오 중심의 작은 화면")}>{compact?ui("화면 확대"):ui("작게 듣기")}</button><button onClick={()=>setOpen(false)} aria-label={ui("플레이어 접기")}>−</button><button onClick={stop} aria-label={ui("재생 종료")}>×</button></header>
      {video&&<div className={`youtube-now-playing${playing?' is-playing':''}`} role="status"><span className="youtube-equalizer" aria-hidden="true"><i/><i/><i/><i/></span><div><strong>{playing?ui("재생 중"):ui("재생 대기 중")}</strong><span title={trackTitle}>{trackTitle||ui("YouTube 동영상")}</span></div></div>}
      <form onSubmit={load}><input type="url" aria-label={ui("유튜브 링크")} placeholder={ui("유튜브 링크 붙여넣기")} value={link} onChange={e=>setLink(e.target.value)}/><button type="submit">{ui("열기")}</button></form>
      {error&&<p role="alert" className="youtube-error">{error}</p>}
      {video&&<><iframe key={`${video.id}:${video.start}`} ref={frame} title={ui("YouTube 동영상")} width="100%" height={compact?200:Math.max(200,(width-24)*9/16)} src={`https://www.youtube.com/embed/${video.id}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&playsinline=1&autoplay=1&start=${video.start}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={()=>{const send=(event,extra={})=>frame.current?.contentWindow?.postMessage(JSON.stringify({event,...extra}),'https://www.youtube.com');send('listening',{id:'frelog-youtube'});command('addEventListener',['onError']);command('addEventListener',['onStateChange']);}}/>
      <div className="youtube-controls"><button onClick={()=>command(playing?'pauseVideo':'playVideo')}>{playing?ui("일시정지"):ui("재생")}</button><button aria-pressed={captions} onClick={()=>{setCaptions(v=>!v);setLine('');}}>{ui("하단 자막")} {captions?ui("켜짐"):ui("꺼짐")}</button><label>{ui("하단 자막 불러오기")}<input type="file" accept=".vtt,.srt" onChange={async e=>{const file=e.target.files[0];if(!file)return;if(file.size>2e6){setError(ui("자막 파일은 2MB 이하로 선택해 주세요."));return;}const parsed=parseSubtitles(await file.text());setCues(parsed);setCaptionName(parsed.length?file.name:'');setCaptions(true);setError(parsed.length?'':ui("자막 파일의 시간 정보를 확인해 주세요."));e.target.value='';}}/></label></div>{captionName&&<p className="youtube-caption-source">{captionName}</p>}<p className="youtube-hint">{ui("SRT·VTT 자막을 불러오면 영상 밖, 페이지 중앙 하단에 표시됩니다. 일반 유튜브 영상의 자막은 자동으로 가져올 수 없습니다.")}</p></>}
      <button className="youtube-resize" aria-label={ui("플레이어 크기 조절")} onPointerDown={e=>startGesture(e,'resize')} onPointerMove={move} onPointerUp={()=>gesture.current=null} onPointerCancel={()=>gesture.current=null} onKeyDown={e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setWidth(w=>Math.max(240,Math.min(innerWidth-24,w+(e.key==='ArrowRight'?20:-20))));}}}>◢</button>
    </section>
    {line&&captions&&<div className="youtube-subtitles" style={{bottom:safeBottom}} aria-live="off"><span>{line}</span></div>}
  </>;
}
