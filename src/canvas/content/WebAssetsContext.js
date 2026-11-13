import {createContext,useContext,useCallback,useSyncExternalStore} from 'react';
export const WebAssetsContext=createContext(null);
const empty=Object.freeze({css:[],js:[]}),noop=()=>()=>{};
export function useWebAssets(id){const store=useContext(WebAssetsContext);const subscribe=useCallback(fn=>store?store.subscribe(id,fn):noop(),[store,id]),get=useCallback(()=>store?.get(id)||empty,[store,id]);return useSyncExternalStore(subscribe,get,get);}
