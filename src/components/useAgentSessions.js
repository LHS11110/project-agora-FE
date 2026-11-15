import {useCallback,useEffect,useRef,useState} from 'react';
import {isAgentConnectionError} from './agentRecovery.js';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export default function useAgentSessions({canvasId,open,requestRef}){
 const [sessions,setSessions]=useState([]),[draft,setDraft]=useState(null),[activeId,setActiveId]=useState(null),[detail,setDetail]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[nextOffset,setNextOffset]=useState(null),[connection,setConnection]=useState('connected');
 const activeRef=useRef(null),detailRef=useRef(null),listRef=useRef(null),sessionsRef=useRef([]),inflight=useRef(null),again=useRef(false),mounted=useRef(true),openRef=useRef(open);openRef.current=open;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const metadata=useCallback(async payload=>{for(let attempt=0;;attempt++){try{return await requestRef.current(payload);}catch(error){if(error.code!=='AGENT_STATUS_BUSY'||attempt>=3)throw error;await wait(150*(attempt+1));}}},[requestRef]);
 const mergeDetail=useCallback((value,id)=>{
  if(!mounted.current||activeRef.current!==id)return;
  const summary=value.session;
  if(summary&&summary.status!=='draft'){
   const next=[summary,...sessionsRef.current.filter(session=>session.id!==summary.id)];
   if(!same(sessionsRef.current,next)){sessionsRef.current=next;setSessions(next);}
  }
  const previous=detailRef.current;let next=value;
  if(previous?.session?.id===id&&previous.messages?.length){const ordered=value.before<previous.before?[...value.messages,...previous.messages]:[...previous.messages,...value.messages];const messages=[...new Map(ordered.map(message=>[message.id,message])).values()];const keptOlder=previous.before<value.before;next={...value,messages,before:keptOlder?previous.before:value.before,has_more:keptOlder?previous.has_more:value.has_more};}
  if(!same(previous,next)){detailRef.current=next;setDetail(next);}
 },[]);
 const reload=useCallback(()=>{
  if(inflight.current){again.current=true;return inflight.current;}
  const job=(async()=>{
   if(mounted.current)setLoading(true);
   try{
    do{
     again.current=false;
     const page=await metadata({operation:'sessions',limit:30,offset:0});if(!mounted.current)return;
     const listUnchanged=same(listRef.current,page.sessions);listRef.current=page.sessions;
     // A first page is not the entire history. Revalidate previously opened
     // sessions that are absent instead of dropping them on a draft switch.
     const ids=new Set(page.sessions.map(session=>session.id));const retained=[];
     for(const previous of sessionsRef.current){
      if(ids.has(previous.id))continue;
      try{const value=await metadata({operation:'session_get',session_id:previous.id,limit:1});if(value.session?.status!=='draft')retained.push(value.session);}
      catch(failure){if(!['AGENT_SESSION_ACCESS_DENIED','AGENT_SESSION_NOT_FOUND'].includes(failure.code))throw failure;}
     }
     if(!mounted.current)return;
     const next=[...page.sessions,...retained];if(!same(sessionsRef.current,next)){sessionsRef.current=next;setSessions(next);}
     setDraft(previous=>same(previous,page.draft)?previous:page.draft);setNextOffset(page.next_offset??null);
     if(!activeRef.current){activeRef.current=page.draft.id;setActiveId(page.draft.id);}
     const id=activeRef.current,cached=detailRef.current;
     const listed=page.draft.id===id||page.sessions.some(value=>value.id===id);
     if(!(listed&&listUnchanged&&cached?.session?.id===id&&cached.revision!==undefined&&cached.revision===page.revision)){
      try{const value=await metadata({operation:'session_get',session_id:id,limit:50});mergeDetail(value,id);}
      catch(failure){if(['AGENT_SESSION_ACCESS_DENIED','AGENT_SESSION_NOT_FOUND'].includes(failure.code)){activeRef.current=page.draft.id;setActiveId(page.draft.id);detailRef.current=null;setDetail(null);again.current=true;}else throw failure;}
     }
     if(mounted.current){setConnection('connected');setError('');}
    }while(again.current&&mounted.current&&openRef.current);
   }catch(failure){if(mounted.current){if(isAgentConnectionError(failure)){setConnection('reconnecting');}else setError(failure.message);}}
   finally{if(mounted.current)setLoading(false);inflight.current=null;}
  })();inflight.current=job;return job;
 },[metadata,mergeDetail]);
 const reloadRef=useRef(reload);reloadRef.current=reload;
 const choose=useCallback(id=>{if(!id)return;if(activeRef.current===id){void reloadRef.current();return;}activeRef.current=id;setActiveId(id);detailRef.current=null;setDetail(null);void reloadRef.current();},[]);
 const older=useCallback(async()=>{const current=detailRef.current;if(!current?.has_more||!activeRef.current)return;const id=activeRef.current;setLoading(true);try{const page=await metadata({operation:'session_get',session_id:id,before:current.before,limit:50});mergeDetail(page,id);}catch(failure){if(mounted.current)setError(failure.message);}finally{if(mounted.current)setLoading(false);}},[metadata,mergeDetail]);
 const remove=useCallback(async id=>{
  setError('');
  try{
   await metadata({operation:'session_delete',session_id:id});
   const next=sessionsRef.current.filter(session=>session.id!==id);sessionsRef.current=next;setSessions(next);
   if(activeRef.current===id){const nextId=draft?.id||null;activeRef.current=nextId;setActiveId(nextId);detailRef.current=null;setDetail(null);}
   await reload();return true;
  }catch(failure){if(mounted.current)setError(failure.message);return false;}
 },[metadata,reload,draft?.id]);
 const more=useCallback(async()=>{if(nextOffset===null)return;setLoading(true);try{const page=await metadata({operation:'sessions',offset:nextOffset,limit:30});if(mounted.current){const next=[...new Map([...sessionsRef.current,...page.sessions].map(s=>[s.id,s])).values()];sessionsRef.current=next;setSessions(next);setNextOffset(page.next_offset??null);}}catch(failure){if(mounted.current)setError(failure.message);}finally{if(mounted.current)setLoading(false);}},[nextOffset,metadata]);
 useEffect(()=>{if(!open)return;void reload();let timer;const changed=event=>{if(String(event.detail?.canvasId)!==String(canvasId))return;clearTimeout(timer);timer=setTimeout(()=>void reload(),80);};window.addEventListener('agora:agent-sessions-changed',changed);const repair=setInterval(()=>void reload(),15000);return()=>{clearTimeout(timer);clearInterval(repair);window.removeEventListener('agora:agent-sessions-changed',changed);};},[open,canvasId,reload]);
 return {sessions,draft,activeId,activeRef,detail,loading,error,connection,nextOffset,reload,choose,older,more,metadata,remove};
}
