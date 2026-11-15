import {changeItems} from '../itemSnapshots.js';
export const REMOTE_MOVE_LIMIT=12;
export class RemoteMoveAnimator{
 constructor(publish,{request=fn=>requestAnimationFrame(fn),cancel=id=>cancelAnimationFrame(id),now=()=>performance.now(),reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches}={}){Object.assign(this,{publish,request,cancel,now,reduced});this.frame=null;this.visible=null;}
 stop(){if(this.frame!==null)this.cancel(this.frame);this.frame=null;}
 show(target,previous,ids=[]){
  this.stop();const start=this.visible||previous;const moved=[];
  if(ids.length<=REMOTE_MOVE_LIMIT&&!this.reduced())for(const id of ids){const a=start?.[id],b=target[id];if(a?.kind==='stroke'&&b?.kind==='stroke'&&a.points?.length&&a.points.length===b.points?.length&&b.points.length<=2000){const dx=a.points[0].x-b.points[0].x,dy=a.points[0].y-b.points[0].y;if((dx||dy)&&a.points.every((p,i)=>Math.abs(p.x-b.points[i].x-dx)<1e-8&&Math.abs(p.y-b.points[i].y-dy)<1e-8))moved.push({id,a,b,dx,dy,stroke:true});}else if(a&&b&&a.kind===b.kind&&[a.x,a.y,b.x,b.y].every(Number.isFinite)&&(a.x!==b.x||a.y!==b.y))moved.push({id,a,b});}
  if(!moved.length){this.visible=target;this.publish(target);return;}
  const began=this.now();const tick=()=>{const t=Math.min(1,(this.now()-began)/180),ease=1-(1-t)**3;const changes=new Map(moved.map(({id,a,b,stroke,dx,dy})=>[id,stroke?{...b,points:b.points.map(p=>({...p,x:p.x+dx*(1-ease),y:p.y+dy*(1-ease)}))}:{...b,x:a.x+(b.x-a.x)*ease,y:a.y+(b.y-a.y)*ease}]));this.visible=t===1?target:changeItems(target,changes);this.publish(this.visible);if(t<1)this.frame=this.request(tick);else this.frame=null;};tick();
 }
}
