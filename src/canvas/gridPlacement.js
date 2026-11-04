import {CANVAS_SPACE} from './canvasSpace.js';
export const gridInterval=value=>Number.isFinite(Number(value))&&Number(value)>=1&&Number(value)<=10000?Number(value):20;
export function snapPosition(point,interval=20,space=CANVAS_SPACE){
 const step=gridInterval(interval);
 return {x:Math.round(point.x*space.width/step)*step/space.width,y:Math.round(point.y*space.height/step)*step/space.height};
}
export function snapNewItem(item,interval,space=CANVAS_SPACE){
 if(!item||item.kind==='connector'||item.kind==='stroke'||!Number.isFinite(item.x)||!Number.isFinite(item.y))return item;
 return {...item,...snapPosition(item,interval,space)};
}
export function snappedTranslation(anchor,dx,dy,interval,space=CANVAS_SPACE){
 const end=snapPosition({x:anchor.x+dx,y:anchor.y+dy},interval,space);
 return {dx:end.x-anchor.x,dy:end.y-anchor.y};
}
