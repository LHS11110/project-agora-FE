import {useCallback,useEffect,useRef,useState} from 'react';
import {captureWatchCamera,fitWatchCamera} from './canvasWatch.js';
const empty={users:[],self_id:null,watching_id:null};
export default function useCanvasWatch({canvasId,connection,sendRaw,camera,setCamera,boardRef,state,setState,onFollow}){
 const [error,setError]=useState('');const latest=useRef(null),remote=useRef(null),before=useRef(null),intent=useRef(null),resumeUntil=useRef(0);latest.current={sendRaw,camera,setCamera,state,onFollow};
 const command=useCallback((action,extra={})=>{setError('');const sent=latest.current.sendRaw({type:'canvas_watch',action,...extra});if(!sent)setError('서버 연결을 확인한 뒤 다시 관전해주세요.');return sent;},[]);
 useEffect(()=>{
  if(connection!=='connected'){if(intent.current){resumeUntil.current=Date.now()+20000;return;}if(before.current)latest.current.setCamera(before.current);before.current=null;setState(empty);remote.current=null;return;}
  command('list');let timer,last=-Infinity,lastSent=null,eventCamera=null;
  const observed=()=>{const s=latest.current.state;return !s.watching_id&&s.users.some(user=>user.watching_id===s.self_id);};
  const emit=(force=false)=>{clearTimeout(timer);const remaining=80-(performance.now()-last);if(remaining>0){timer=setTimeout(()=>emit(force),remaining);return;}const stage=boardRef.current;if(!stage||!stage.clientWidth||!stage.clientHeight)return;const view=captureWatchCamera(eventCamera||latest.current.camera,{width:stage.clientWidth,height:stage.clientHeight});if(!force&&lastSent&&Object.keys(view).every(key=>view[key]===lastSent[key]))return;last=performance.now();if(command('camera',{camera:view}))lastSent=view;};
  const changed=event=>{if(event?.detail?.camera)eventCamera=event.detail.camera;if(!observed())return;clearTimeout(timer);timer=setTimeout(()=>emit(),Math.max(0,80-(performance.now()-last)));};
  const apply=()=>{const stage=boardRef.current;if(!stage||!remote.current)return;const view=fitWatchCamera(remote.current,{width:stage.clientWidth,height:stage.clientHeight});if(view)latest.current.setCamera(view);};
  const received=event=>{
   if(String(event.detail?.canvasId)!==String(canvasId))return;const data=event.detail.data;
   if(data.type==='canvas_watch_state'){
    const previous=latest.current.state;
    if(!data.watching_id&&intent.current&&!['left','presentation_ended'].includes(data.watch_end_reason)&&(data.watch_end_reason==='disconnected'||previous.self_id!==data.self_id||resumeUntil.current>Date.now())){
     if(!resumeUntil.current)resumeUntil.current=Date.now()+20000;
     const target=data.users.find(user=>user.id!==data.self_id&&user.nickname===intent.current.nickname&&Number(user.tag_number)===Number(intent.current.tag_number)&&!user.watching_id);
     if(Date.now()<resumeUntil.current){latest.current.state={...data,watching_id:previous.watching_id};setState(latest.current.state);if(target)command('follow',{target_id:target.id,mode:intent.current.mode});return;}
    }
    if(data.watching_id){resumeUntil.current=0;const target=data.users.find(user=>user.id===data.watching_id);if(target)intent.current={nickname:target.nickname,tag_number:target.tag_number,mode:data.watch_kind||intent.current?.mode||'manual'};}
    else {intent.current=null;resumeUntil.current=0;}
    if(data.watching_id&&!previous.watching_id){before.current={x:latest.current.camera.x,y:latest.current.camera.y,scale:latest.current.camera.scale};}
    if(!data.watching_id&&previous.watching_id){remote.current=null;if(before.current)latest.current.setCamera(before.current);before.current=null;}
    latest.current.state=data;setState(data);
   }
   else if(data.type==='canvas_watch_camera'&&data.source_id===latest.current.state.watching_id){remote.current=data.camera;apply();}
   else if(data.type==='canvas_watch_camera_requested'){clearTimeout(timer);timer=setTimeout(()=>emit(true),Math.max(0,80-(performance.now()-last)));}
   else if(data.type==='error'){const labels={WATCH_TARGET_UNAVAILABLE:'현재 관전할 수 없는 사용자입니다.',WATCH_HAS_FOLLOWERS:'나를 관전 중인 사용자가 관전을 종료한 뒤 다시 시도해주세요.',WATCH_RECONNECTING:'연결 복구 후 다시 시도해주세요.',WATCH_READ_ONLY:'관전을 종료하면 편집할 수 있습니다.'};setError(labels[data.code]||'관전 요청을 처리하지 못했습니다.');}
  };
  window.addEventListener('agora:canvas-watch',received);const stage=boardRef.current;stage?.addEventListener('agora-camera',changed);const observer=new ResizeObserver(()=>{if(latest.current.state.watching_id)apply();else changed();});if(stage)observer.observe(stage);emit(true);const repair=setInterval(()=>{if(observed()){eventCamera=null;emit(true);}if(resumeUntil.current)command('list');},400);
  return()=>{clearTimeout(timer);clearInterval(repair);observer.disconnect();stage?.removeEventListener('agora-camera',changed);window.removeEventListener('agora:canvas-watch',received);};
 },[canvasId,connection,command,boardRef,setState]);
 useEffect(()=>{if(!state.watching_id)return;const stage=boardRef.current,block=event=>{event.preventDefault();event.stopImmediatePropagation();};stage?.addEventListener('wheel',block,{capture:true,passive:false});return()=>stage?.removeEventListener('wheel',block,true);},[state.watching_id,boardRef]);
 const follow=(id)=>{try{latest.current.onFollow?.();}catch{setError('현재 편집을 종료하지 못했습니다. 편집을 마친 뒤 다시 관전해주세요.');return false;}const target=latest.current.state.users.find(user=>user.id===id);if(target)intent.current={nickname:target.nickname,tag_number:target.tag_number,mode:'manual'};return command('follow',{target_id:id,mode:'manual'});};
 return {state,error,follow,leave:()=>{intent.current=null;resumeUntil.current=0;return command('leave');}};
}
