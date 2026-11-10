import {useEffect,useRef,useState} from 'react';
import {apiUrl} from '../../api/client.js';
import {ui} from '../../i18n/locale.js';
import {mediaPosition} from './mediaModel.js';
import './media.css';
export default function UploadedMedia({item,token,selected=false,interactive,writable,onChange}){
 const video=useRef(null),surface=useRef(null),worker=useRef(null),pending=useRef(false),requested=useRef(0),sent=useRef(0),generation=useRef(0),applying=useRef(false),latest=useRef(null),actor=useRef(crypto.randomUUID());
 const [source,setSource]=useState(''),[ready,setReady]=useState(false),[duration,setDuration]=useState(0),[position,setPosition]=useState(0),[error,setError]=useState(''),[blocked,setBlocked]=useState(false);
 latest.current={item,writable,onChange};const gif=item.mediaType==='gif';
 const publish=(paused,time=position,patch={})=>{if(!latest.current.writable)return;latest.current.onChange({...patch,mediaState:{paused,time:Math.max(0,time),updatedAt:Date.now(),actor:actor.current}});};
 const renderGif=time=>{requested.current=time;if(worker.current&&!pending.current){pending.current=true;sent.current=time;worker.current.postMessage({type:'render',time});}};
 const apply=()=>{const current=latest.current.item,state=current.mediaState,time=mediaPosition(state,duration,current.mediaLoop);setPosition(time);renderGif(time);const node=video.current;if(!node)return;applying.current=true;try{if(node.readyState>0&&Math.abs(node.currentTime-time)>(state?.paused!==false?.001:.05))node.currentTime=Number.isFinite(node.duration)?Math.min(time,node.duration):time;if(state?.paused!==false)node.pause();else node.play().then(()=>setBlocked(false)).catch(()=>setBlocked(true));}finally{queueMicrotask(()=>{applying.current=false;});}};
 useEffect(()=>{
  const turn=++generation.current,abort=new AbortController();let objectUrl='',gifWorker;
  setSource('');setReady(false);setDuration(0);setError('');pending.current=false;
  const load=async()=>{try{
   const address=new URL(apiUrl(item.url)),internal=address.origin===new URL(apiUrl('/')).origin;
   if(!gif&&!internal){setSource(address.href);return;}
   const response=await fetch(address,{headers:internal&&token?{Authorization:`Bearer ${token}`}:{},signal:abort.signal});if(!response.ok)throw Error('미디어를 불러오지 못했습니다.');
   const limit=(gif?20:100)*1024*1024;if(Number(response.headers.get('content-length'))>limit)throw Error('동영상은 100MiB, GIF는 20MiB 이하로 올려주세요.');
   const blob=await response.blob();if(blob.size>limit)throw Error('동영상은 100MiB, GIF는 20MiB 이하로 올려주세요.');if(generation.current!==turn)return;
   if(gif){const buffer=await blob.arrayBuffer();if(generation.current!==turn)return;gifWorker=new Worker(new URL('./gifWorker.js',import.meta.url),{type:'module'});worker.current=gifWorker;
    gifWorker.onmessage=({data})=>{if(generation.current!==turn){data.bitmap?.close();return;}if(data.type==='ready'){surface.current.width=data.width;surface.current.height=data.height;setReady(true);setDuration(data.duration);renderGif(mediaPosition(latest.current.item.mediaState,data.duration,latest.current.item.mediaLoop));}else if(data.type==='frame'){pending.current=false;const context=surface.current?.getContext('2d');if(context){context.clearRect(0,0,surface.current.width,surface.current.height);context.drawImage(data.bitmap,0,0);}data.bitmap.close();if(Math.abs(requested.current-sent.current)>.001)renderGif(requested.current);}else if(data.type==='unchanged'){pending.current=false;if(Math.abs(requested.current-sent.current)>.001)renderGif(requested.current);}else if(data.type==='error'){pending.current=false;setError(data.message);}};
    gifWorker.onerror=()=>setError('GIF를 재생하지 못했습니다.');gifWorker.postMessage({type:'load',buffer},[buffer]);
   }else{objectUrl=URL.createObjectURL(blob);setSource(objectUrl);}
  }catch(failure){if(!abort.signal.aborted&&generation.current===turn)setError(gif&&failure instanceof TypeError?'GIF 원본을 가져올 수 없습니다. GIF 파일을 다운로드한 뒤 붙여넣어주세요.':failure.message);}};load();
  return()=>{generation.current++;abort.abort();gifWorker?.terminate();if(worker.current===gifWorker)worker.current=null;if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[item.url,gif,token]);
 useEffect(apply,[item.mediaState,item.mediaLoop,duration,source]);
 useEffect(()=>{
  if(!gif||!duration)return;const tick=()=>{const current=latest.current.item;if(document.hidden||current.mediaState?.paused!==false)return;const time=mediaPosition(current.mediaState,duration,current.mediaLoop);setPosition(time);renderGif(time);if(!current.mediaLoop&&time>=duration&&latest.current.writable)publish(true,duration);};const timer=setInterval(tick,40);return()=>clearInterval(timer);
 },[gif,duration]);
 const controls=selected&&interactive&&writable;
 const metadata=node=>{setReady(true);const length=Number.isFinite(node.duration)?node.duration:node.seekable.length?node.seekable.end(node.seekable.length-1):0;if(length>0)setDuration(length);};
 const stamp=time=>time<1?time.toFixed(2):String(Math.floor(time));
 return <div className={`uploaded-media${selected?' is-selected':''}`} data-object-action={selected?'uploaded-media':undefined} onPointerDown={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}>
  <div className="uploaded-media-screen">{gif?<canvas ref={surface} aria-label={item.title||'GIF'}/>:source?<video ref={video} src={source} playsInline preload="metadata" loop={Boolean(item.mediaLoop)} onLoadedMetadata={e=>metadata(e.currentTarget)} onDurationChange={e=>metadata(e.currentTarget)} onProgress={e=>metadata(e.currentTarget)} onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)} onEnded={()=>{if(writable&&!item.mediaLoop)publish(true,video.current.currentTime);}} onError={()=>setError('브라우저에서 이 동영상을 재생할 수 없습니다.')}/>:<span>{ui('미디어를 불러오는 중…')}</span>}{error&&<div role="alert">{ui(error)}</div>}</div>
  <div className="uploaded-media-center"><button className="uploaded-media-toggle" disabled={!controls||!ready||Boolean(error)} aria-label={ui(item.mediaState?.paused===false?'공유 일시정지':'공유 재생')} onClick={()=>{let time=video.current?.currentTime??mediaPosition(item.mediaState,duration,item.mediaLoop);if(item.mediaState?.paused!==false&&duration&&time>=duration-.05)time=0;const paused=item.mediaState?.paused===false;publish(paused,time);if(video.current&&!paused)video.current.play().catch(()=>setBlocked(true));}}><span aria-hidden="true">{item.mediaState?.paused===false?'Ⅱ':'▶'}</span></button></div>
  <div className="uploaded-media-controls">
   <input type="range" aria-label={ui('공유 재생 위치')} disabled={!controls||!duration} min="0" max={duration||1} step="0.01" value={Math.min(position,duration||1)} onChange={e=>{const time=Number(e.target.value);if(video.current)video.current.currentTime=time;publish(item.mediaState?.paused!==false,time);}}/><span>{stamp(position)} / {duration?stamp(duration):'—'}s</span>

   {!gif&&<input type="range" aria-label={ui('음량')} min="0" max="1" step=".05" defaultValue="1" onChange={e=>{if(video.current)video.current.volume=Number(e.target.value);}}/>}
  </div>   <button className="uploaded-media-loop" title={ui('반복 재생')} disabled={!controls} aria-label={ui('반복 재생')} aria-pressed={Boolean(item.mediaLoop)} onClick={()=>publish(item.mediaState?.paused!==false,video.current?.currentTime??mediaPosition(item.mediaState,duration,item.mediaLoop),{mediaLoop:!item.mediaLoop})}><span aria-hidden="true">↻</span></button>{blocked&&<button className="uploaded-media-unlock" onClick={()=>video.current?.play().then(()=>setBlocked(false)).catch(()=>{})}>{ui('브라우저에서 공유 재생 허용')}</button>}
 </div>;
}
