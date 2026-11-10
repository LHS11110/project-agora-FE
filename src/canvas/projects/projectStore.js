import {createContext,useContext,useSyncExternalStore} from 'react';
export const ProjectContext=createContext(null);
export function createProjectStore(){let records={},snapshot={records},listeners=new Set();return {
 subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},getSnapshot:()=>snapshot,
 update(items,ids){let next=records;for(const id of ids||Object.keys(items)){const item=items[id];if(item?.kind==='project'){if(records[id]!==item){if(next===records)next={...records};next[id]=item;}}else if(Object.hasOwn(records,id)){if(next===records)next={...records};delete next[id];}}if(next!==records){records=next;this.refresh();}},
 refresh(){snapshot={records};listeners.forEach(fn=>fn());},
 actions:null,
};}
export function useProjectStore(){const store=useContext(ProjectContext);const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);return {...snapshot,actions:store.actions};}
