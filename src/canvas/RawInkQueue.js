// Raw input samples are collected cheaply; expensive ink work flushes per microtask turn without VSync waits.
const defaultRequest = fn => {
  const token = { cancelled: false };
  queueMicrotask(() => { if (!token.cancelled) fn(); });
  return token;
};
const defaultCancel = token => {
  if (token && typeof token === 'object') token.cancelled = true;
  else if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(token);
};
export default class RawInkQueue {
 constructor(deliver,request=defaultRequest,cancel=defaultCancel){Object.assign(this,{deliver,request,cancel});this.samples=[];this.frame=null;this.pointerId=null;}
 push(event){
  if(this.pointerId!==null&&this.pointerId!==event.pointerId)this.clear();this.pointerId=event.pointerId;
  let samples;try{samples=event.getCoalescedEvents?.();}catch{}
  // Only the newest dispatch's predictions describe where the pointer is heading.
  let predicted;try{predicted=event.getPredictedEvents?.();}catch{}
  this.predicted=predicted?.length?[...predicted].map(p=>({clientX:p.clientX,clientY:p.clientY,pointerType:p.pointerType||event.pointerType,pressure:p.pressure,timeStamp:p.timeStamp})):[];
  for(const p of samples?.length?samples:[event])this.samples.push({clientX:p.clientX,clientY:p.clientY,pointerId:event.pointerId,pointerType:p.pointerType||event.pointerType,pressure:p.pressure,timeStamp:p.timeStamp});
  if(this.samples.length>4096)this.flush();
  if(this.frame===null)this.frame=this.request(()=>{this.frame=null;this.flush();});
 }
 flush(){if(this.frame!==null){this.cancel(this.frame);this.frame=null;}if(!this.samples.length)return;const samples=this.samples;this.samples=[];const predicted=this.predicted||[];this.predicted=[];const last=samples.at(-1);this.deliver({...last,type:'pointerrawupdate',getCoalescedEvents:()=>samples,getPredictedEvents:()=>predicted});}
 clear(){if(this.frame!==null)this.cancel(this.frame);this.frame=null;this.samples=[];this.predicted=[];this.pointerId=null;}
}
