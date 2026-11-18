import {CANVAS_SPACE} from './canvasSpace.js';
export const BASE_GRID_INTERVAL = 1;
export const DEFAULT_GRID_INTERVAL = 1;
export const gridInterval=value=>Number.isFinite(Number(value))&&Number(value)>=1&&Number(value)<=10000?Number(value):20;
export const gridIntervals=value=>({x:gridInterval(value&&typeof value==='object'?value.x:value),y:gridInterval(value&&typeof value==='object'?value.y:value)});
export const activeGridInterval=(snapToGrid,interval)=>snapToGrid?gridIntervals(interval):{x:BASE_GRID_INTERVAL,y:BASE_GRID_INTERVAL};
export function snapPosition(point,interval=BASE_GRID_INTERVAL,space=CANVAS_SPACE){
 const step=gridIntervals(interval);
 return {x:Math.round(point.x*space.width/step.x)*step.x/space.width,y:Math.round(point.y*space.height/step.y)*step.y/space.height};
}
export function snapDimensions(item,space=CANVAS_SPACE){
 const patch={};
 if(Number.isFinite(item?.width)&&item.width>0)patch.width=Math.max(1,Math.round(item.width*space.width))/space.width;
 if(Number.isFinite(item?.height)&&item.height>0)patch.height=Math.max(1,Math.round(item.height*space.height))/space.height;
 return patch;
}
export function strokeGridAnchor(item){
 if(!item||item.kind!=='stroke'||!Array.isArray(item.points)||!item.points.length)return null;
 let minX=Infinity,minY=Infinity;
 for(let i=0;i<item.points.length;i++){
  const p=item.points[i];
  if(Number.isFinite(p?.x)&&Number.isFinite(p?.y)){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);}
 }
 return Number.isFinite(minX)&&Number.isFinite(minY)?{x:minX,y:minY}:null;
}
export function snapNewItem(item,interval=BASE_GRID_INTERVAL,space=CANVAS_SPACE){
 if(!item||item.kind==='connector'||item.kind==='stroke'||!Number.isFinite(item.x)||!Number.isFinite(item.y))return item;
 return {...item,...snapPosition(item,interval,space),...snapDimensions(item,space)};
}
export function snappedTranslation(anchor,dx,dy,interval=BASE_GRID_INTERVAL,space=CANVAS_SPACE){
 const end=snapPosition({x:anchor.x+dx,y:anchor.y+dy},interval,space);
 return {dx:end.x-anchor.x,dy:end.y-anchor.y};
}
