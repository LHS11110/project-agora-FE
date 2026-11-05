import {CANVAS_SPACE} from './canvasSpace.js';
export const gridInterval=value=>Number.isFinite(Number(value))&&Number(value)>=1&&Number(value)<=10000?Number(value):20;
export const gridIntervals=value=>({x:gridInterval(value&&typeof value==='object'?value.x:value),y:gridInterval(value&&typeof value==='object'?value.y:value)});
export function snapPosition(point,interval=20,space=CANVAS_SPACE){
 const step=gridIntervals(interval);
 return {x:Math.round(point.x*space.width/step.x)*step.x/space.width,y:Math.round(point.y*space.height/step.y)*step.y/space.height};
}
export function snapNewItem(item,interval,space=CANVAS_SPACE){
 if(!item||item.kind==='connector'||item.kind==='stroke'||!Number.isFinite(item.x)||!Number.isFinite(item.y))return item;
 return {...item,...snapPosition(item,interval,space)};
}
export function snappedTranslation(anchor,dx,dy,interval,space=CANVAS_SPACE){
 const end=snapPosition({x:anchor.x+dx,y:anchor.y+dy},interval,space);
 return {dx:end.x-anchor.x,dy:end.y-anchor.y};
}
