import {hasAnimation} from './portfolioModel.js';
export const newFrame=()=>({kind:'frame',title:'프레임',text:'',frameOrder:0,fill:'#ffffff',x:0,y:0,width:.8,height:.72,rotation:0});
export const validFrame=item=>item?.kind==='frame'&&typeof item.title==='string'&&item.title.length<=200&&typeof item.text==='string'&&item.text.length<=4000&&Number.isInteger(item.frameOrder)&&item.frameOrder>=0&&item.frameOrder<=1000000&&(!item.rotation||item.rotation===0);
export const validFrameField=(key,value)=>key==='frameId'?typeof value==='string'&&value.length>0&&value.length<=128:Number.isInteger(value)&&value>=0&&value<=(key==='frameOrder'?1000000:9999);
export function isColorDark(hex){
 if(!hex||typeof hex!=='string')return false;
 let c=hex.replace('#','').trim();
 if(c.length===3)c=c.split('').map(x=>x+x).join('');
 if(c.length!==6)return false;
 const num=parseInt(c,16);
 if(Number.isNaN(num))return false;
 return ((num>>16)&255)*0.299 + ((num>>8)&255)*0.587 + (num&255)*0.114 < 128;
}
export function animationGroups(page,items){const groups=new Map();for(const id of page?.objectIds||[]){const item=items[id];if(!item||!hasAnimation(item))continue;const priority=item.animationPriority||0;if(!groups.has(priority))groups.set(priority,[]);groups.get(priority).push(id);}return [...groups].sort(([a],[b])=>a-b).map(([priority,ids])=>({priority,ids:ids.sort()}));}
export function nextFrameId(frameId,items){let best=null;for(const [id,item] of Object.entries(items)){if(item?.kind!=='connector'||item.from!==frameId||items[item.to]?.kind!=='frame'||item.to===frameId)continue;if(!best||(item.frameLinkPriority||0)<(best[1].frameLinkPriority||0)||((item.frameLinkPriority||0)===(best[1].frameLinkPriority||0)&&id.localeCompare(best[0])<0))best=[id,item];}return best?.[1].to||null;}
export function validCursor(c){return Boolean(c&&Object.keys(c).length===5&&typeof c.runId==='string'&&c.runId.length>0&&c.runId.length<=128&&typeof c.previousRunId==='string'&&c.previousRunId.length<=128&&typeof c.frameId==='string'&&c.frameId.length>0&&c.frameId.length<=128&&Number.isInteger(c.step)&&c.step>=0&&c.step<=10000&&Number.isSafeInteger(c.startedAt)&&c.startedAt>=0);}
// Only frame or membership edits rebuild pages. Ordinary drawing/movement is O(touched).
export function createFrameStore(){const frames=new Map(),membership=new Map(),links=new Map(),listeners=new Set();let snapshot=[];return {subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},getSnapshot:()=>snapshot,
 update(items,ids){let dirty=false;if(!ids){dirty=frames.size>0||membership.size>0||links.size>0;frames.clear();membership.clear();links.clear();}for(const id of ids||Object.keys(items)){const item=items[id],old=frames.get(id);if(item?.kind==='connector'){if(links.get(id)!==item){links.set(id,item);dirty=true;}}else if(links.delete(id))dirty=true;if(item?.kind==='frame'){if(old!==item){frames.set(id,item);dirty=true;}}else if(frames.delete(id))dirty=true;const before=membership.get(id),after=item?.kind!=='frame'?item?.frameId:undefined;if(before!==after){if(after)membership.set(id,after);else membership.delete(id);dirty=true;}}if(!dirty)return;
 const members=new Map();for(const [id,frame] of membership){if(!members.has(frame))members.set(frame,[]);members.get(frame).push(id);}
 const best=new Map();for(const [key,link] of links){if(link.from===link.to||!frames.has(link.from)||!frames.has(link.to))continue;const old=best.get(link.from);if(!old||(link.frameLinkPriority||0)<(old[1].frameLinkPriority||0)||((link.frameLinkPriority||0)===(old[1].frameLinkPriority||0)&&key.localeCompare(old[0])<0))best.set(link.from,[key,link]);}
 snapshot=[...frames].sort(([a,x],[b,y])=>(x.frameOrder||0)-(y.frameOrder||0)||a.localeCompare(b)).map(([id,item])=>({id,frameId:id,title:item.title,notes:item.text||'',objectIds:(members.get(id)||[]).sort(),frame:item,nextFrameId:best.get(id)?.[1].to||null}));listeners.forEach(fn=>fn());
 }};}
