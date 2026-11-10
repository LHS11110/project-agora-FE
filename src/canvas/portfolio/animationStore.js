import {createContext,useContext,useLayoutEffect,useSyncExternalStore,useCallback,useRef} from 'react';
import {animationFrames} from './portfolioModel.js';
export const AnimationContext=createContext(null);
export function createAnimationStore(getItems){const records=new Map(),listeners=new Set();return {getItems,get:id=>records.get(id)||null,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},update(items,ids){let changed=false;for(const id of ids||Object.keys(items)){const value=items[id]?.animationPlayback||null,old=records.get(id);if(value?(old?.runId!==value.runId||old?.startedAt!==value.startedAt):old){if(value)records.set(id,value);else records.delete(id);changed=true;}}if(changed)listeners.forEach(fn=>fn());}};}
const noSubscribe=()=>()=>{},empty=()=>null;
export function useObjectAnimation(id,element,disabled){const store=useContext(AnimationContext),get=useCallback(()=>store?.get(id)||null,[store,id]),playback=useSyncExternalStore(store?.subscribe||noSubscribe,get,empty),running=useRef(null);
 useLayoutEffect(()=>{running.current?.cancel();running.current=null;const node=element.current;if(!node||disabled||playback?.action!=='play'||!playback.startedAt||playback.config.effect==='none')return;const config=playback.config,offset=Date.now()-playback.startedAt;if(!config.loop&&offset>=config.delay+config.duration)return;
  const animation=node.animate(animationFrames(config),{duration:config.duration,delay:config.delay,iterations:config.loop?Infinity:1,easing:config.easing,fill:'none'});animation.id='portfolio:'+playback.runId;animation.pause();
  let timer;if(offset<0){animation.currentTime=0;timer=setTimeout(()=>animation.play(),-offset);}else{animation.currentTime=offset;animation.play();}running.current=animation;
  return()=>{clearTimeout(timer);animation.cancel();};
 },[playback,disabled]);
}
export function useAnimationItems(){return useContext(AnimationContext)?.getItems||(()=>({}));}
