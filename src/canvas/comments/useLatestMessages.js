import {useLayoutEffect,useRef} from 'react';

// New/open conversations follow their newest entry; explicit mention jumps
// take priority once. Prepending history preserves the reader's position.
export function isNearLatest(height,viewport,top,total){
 return Math.max(0,height-viewport-top)<=height/Math.max(1,total)+1;
}
export function useLatestMessages(list,entries,scope,highlight,onHighlightVisible,{followNearBottom=false,totalCount=entries?.length||0,onHighlightExpired}={}){
 const state=useRef({scope:null,last:null,sequence:0,first:null,height:0,viewport:0,total:0,top:0,mode:'latest',highlight:null,located:false}),callback=useRef(onHighlightVisible);callback.current=onHighlightVisible;
 const expiry=useRef(onHighlightExpired),timer=useRef(null);expiry.current=onHighlightExpired;
 const located=()=>{callback.current?.();if(timer.current===null)timer.current=setTimeout(()=>{timer.current=null;expiry.current?.();},3000);};
 const last=entries?.at(-1)?.id||null,first=entries?.[0]?.id||null,count=entries?.length||0;
 useLayoutEffect(()=>{
  const node=list.current;if(!node)return;const s=state.current;
  if(!highlight&&s.highlight){s.mode='manual';s.located=false;}
  const changedScope=s.scope!==scope,newHighlight=Boolean(highlight)&&(changedScope||s.highlight!==highlight||!s.located);
  if(newHighlight){
   s.mode='focus';const target=[...node.querySelectorAll('[data-message-id]')].find(e=>e.dataset.messageId===highlight);
   s.located=Boolean(target&&node.clientHeight);
   if(s.located){node.scrollTop+=target.getBoundingClientRect().top-node.getBoundingClientRect().top;located();}
  }else if(changedScope||last!==s.last){
   const ownArrival=entries?.some(entry=>entry.own&&entry.sequence>s.sequence);
   const follow=changedScope||!s.last||ownArrival||!followNearBottom||isNearLatest(s.height,s.viewport,s.top,s.total);
   s.mode=follow?'latest':'manual';
   if(follow)node.scrollTop=node.scrollHeight;
   else node.scrollTop=s.top;
  }
  else if(first!==s.first&&s.height)node.scrollTop=s.top+node.scrollHeight-s.height;
  s.scope=scope;s.last=last;s.sequence=entries?.at(-1)?.sequence||0;s.first=first;s.highlight=highlight;s.height=node.scrollHeight;s.viewport=node.clientHeight;s.total=totalCount;s.top=node.scrollTop;
 },[list,scope,last,first,count,highlight,followNearBottom,totalCount]);
 useLayoutEffect(()=>{
  const node=list.current;if(!node)return;const anchor=node.style.overflowAnchor;node.style.overflowAnchor='none';let frame=0,visible=node.clientHeight>0;
  const refresh=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const shown=node.clientHeight>0,s=state.current;if(shown&&s.mode==='focus'&&!s.located&&highlight){const target=[...node.querySelectorAll('[data-message-id]')].find(e=>e.dataset.messageId===highlight);if(target){node.scrollTop+=target.getBoundingClientRect().top-node.getBoundingClientRect().top;s.located=true;located();}}else if(shown&&(!visible||s.mode==='latest')){s.mode='latest';node.scrollTop=node.scrollHeight;}visible=shown;s.height=node.scrollHeight;s.viewport=node.clientHeight;s.total=totalCount;s.top=node.scrollTop;});};
  const scroll=()=>{state.current.top=node.scrollTop;if(state.current.mode!=='focus')state.current.mode=(followNearBottom?isNearLatest(node.scrollHeight,node.clientHeight,node.scrollTop,totalCount):node.scrollHeight-node.clientHeight-node.scrollTop<3)?'latest':'manual';};
  const observer=new ResizeObserver(refresh);observer.observe(node);for(const child of node.children)observer.observe(child);
  node.addEventListener('scroll',scroll,{passive:true});
  return()=>{cancelAnimationFrame(frame);observer.disconnect();node.style.overflowAnchor=anchor;node.removeEventListener('scroll',scroll);};
 },[list,scope,first,last,count,highlight,followNearBottom,totalCount]);
 useLayoutEffect(()=>{
  clearTimeout(timer.current);timer.current=null;
  if(highlight&&state.current.located)timer.current=setTimeout(()=>{timer.current=null;expiry.current?.();},3000);
  return()=>{clearTimeout(timer.current);timer.current=null;};
 },[scope,highlight]);
}
