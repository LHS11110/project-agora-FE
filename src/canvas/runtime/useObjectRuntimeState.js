import {useCallback,useEffect,useMemo,useState,useSyncExternalStore} from 'react';
export function useObjectRuntimeState(id,item,store){
 const subscribe=useCallback(listener=>store?store.subscribe(id,listener):()=>{},[store,id]);
 const snapshot=useCallback(()=>store?.get(id)||item.runtimeState||null,[store,id,item.runtimeState]);
 const state=useSyncExternalStore(subscribe,snapshot,()=>null),[clock,setClock]=useState(0);
 useEffect(()=>{
  if(!state?.running||!Number.isFinite(state.updatedAt))return;
  const timer=setTimeout(()=>setClock(n=>n+1),Math.max(0,state.updatedAt+120000-Date.now()));return()=>clearTimeout(timer);
 },[state]);
 return useMemo(()=>state?.running&&Number.isFinite(state.updatedAt)&&Date.now()-state.updatedAt>=120000?{...state,running:false,status:'error',failed:true,error:'실행 상태가 만료되었습니다. 다시 실행할 수 있습니다.'}:state,[state,clock]);
}
