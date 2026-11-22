import {createContext,useContext,useCallback,useState,useSyncExternalStore} from 'react';
// Two or more playing YouTube players held the whole canvas at 30fps even while
// idle (one player stays at 60fps), so starting a player closes the previous one.
const KIND_LIMITS={youtube:1};
const kindOf=identity=>{const at=typeof identity==='string'?identity.indexOf(':'):-1;return at>0?identity.slice(0,at):'';};
export function createLiveContentRegistry(limit=6,kindLimits=KIND_LIMITS){
 let ids=[],nextGeneration=0;
 const identities=new Map(),generations=new Map(),listeners=new Set();
 const emit=()=>{for(const fn of listeners)fn();};
 const forget=id=>{identities.delete(id);generations.delete(id);};
 return {
  subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
  getSnapshot:()=>ids,identity:id=>identities.get(id),generation:id=>generations.get(id)||0,
  activate(id,identity){
   if(ids.includes(id)&&identities.get(id)===identity)return generations.get(id);
   identities.set(id,identity);generations.set(id,++nextGeneration);
   ids=[...ids.filter(value=>value!==id),id];
   const kind=kindOf(identity),kindLimit=kindLimits?.[kind];
   if(kindLimit){const same=ids.filter(value=>kindOf(identities.get(value))===kind);if(same.length>kindLimit){const drop=new Set(same.slice(0,same.length-kindLimit));ids=ids.filter(value=>!drop.has(value));}}
   ids=ids.slice(-limit);
   for(const key of identities.keys())if(!ids.includes(key))forget(key);
   emit();return generations.get(id);
  },
  deactivate(id){if(!ids.includes(id))return;ids=ids.filter(value=>value!==id);forget(id);emit();},
  prune(valid){const next=ids.filter(id=>valid.has(id));if(next.length!==ids.length){ids=next;for(const key of identities.keys())if(!valid.has(key))forget(key);emit();}}
 };
}
export const LiveContentContext=createContext(null);
const subscribe=()=>()=>{};
export function useLiveContent(id,identity){
 const registry=useContext(LiveContentContext),[local,setLocal]=useState(false);
 // A per-object scalar snapshot leaves unrelated inactive previews untouched.
 const get=useCallback(()=>registry?.getSnapshot().includes(id)&&(identity===undefined||registry.identity(id)===identity)?registry.generation(id):0,[registry,id,identity]);
 const generation=useSyncExternalStore(registry?.subscribe||subscribe,get,get);
 return {
  active:registry&&id?generation>0:local,generation:registry&&id?generation:1,
  activate:useCallback(()=>{if(registry&&id)return registry.activate(id,identity);setLocal(true);return 1;},[registry,id,identity]),
  deactivate:useCallback(()=>registry&&id?registry.deactivate(id):setLocal(false),[registry,id])
 };
}
