import {useCallback,useEffect,useRef,useState} from 'react';

export function useCanvasPasswordPrompt(){
 const [prompt,setPrompt]=useState(null),pending=useRef(null);
 const requestPassword=useCallback(({canvasName,error='',signal}={})=>new Promise(resolve=>{
  pending.current?.finish(null);
  if(signal?.aborted){resolve(null);return;}
  const request={canvasName,error,finish:value=>{
   if(pending.current!==request)return;
   pending.current=null;signal?.removeEventListener('abort',abort);setPrompt(null);resolve(value);
  }};
  const abort=()=>request.finish(null);
  pending.current=request;signal?.addEventListener('abort',abort,{once:true});setPrompt(request);
 }),[]);
 useEffect(()=>()=>pending.current?.finish(null),[]);
 return {prompt,requestPassword};
}
