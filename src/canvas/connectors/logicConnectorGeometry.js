import { logicPortPosition, nearestLogicPort } from '../logicGates.js';
import { arrowPathGeometry } from '../../components/arrowheadGeometry.js';
import { connectorControlHandles, connectorPointCount, sampleControlCurve } from './controlPoints.js';

export function logicConnectorGeometry(item, fromItem, toItem, from, to, world, boundary) {
  const center = rect => ({ x: rect.centerX, y: rect.centerY });
  const output = item.fromPort ? logicPortPosition(fromItem,item.fromPort,world) : nearestLogicPort(fromItem,'output',center(to),world);
  const input = item.toPort ? logicPortPosition(toItem,item.toPort,world) : nearestLogicPort(toItem,'input',center(from),world);
  const edge = (rect, target) => {
    const dx=target.x-rect.centerX,dy=target.y-rect.centerY;
    const nx=Math.abs(dx)>=Math.abs(dy)?Math.sign(dx)||1:0,ny=nx?0:Math.sign(dy)||1;
    const reach=boundary(rect,nx,ny);
    return {x:rect.centerX+nx*reach,y:rect.centerY+ny*reach,nx,ny};
  };
  const start=output || edge(from,input || center(to)),end=input || edge(to,output || center(from));
  const stub=14,s={x:start.x+start.nx*stub,y:start.y+start.ny*stub},e={x:end.x+end.nx*stub,y:end.y+end.ny*stub};
  const horizontal=p=>Math.abs(p.nx)>=Math.abs(p.ny);
  let points;
  if(horizontal(start) && horizontal(end)) {const x=(s.x+e.x)/2;points=[start,s,{x,y:s.y},{x,y:e.y},e,end];}
  else if(!horizontal(start) && !horizontal(end)) {const y=(s.y+e.y)/2;points=[start,s,{x:s.x,y},{x:e.x,y},e,end];}
  else points=[start,s,horizontal(start)?{x:e.x,y:s.y}:{x:s.x,y:e.y},e,end];
  const gap=Math.hypot(end.x-start.x,end.y-start.y)||1,directionX=(end.x-start.x)/gap,directionY=(end.y-start.y)/gap;
  const controls=connectorControlHandles(item,start,end);
  const custom=connectorPointCount(item)>1 || Array.isArray(item.bendPoints) || Number(item.bend)>0;
  if(custom)points=sampleControlCurve([start,s,...controls,e,end]);
  const arrow=arrowPathGeometry(points,{startHead:item.startHead,endHead:item.endHead,headSize:Number(item.headSize)||12,strokeWidth:Number(item.strokeWidth)||1.5});
  return {...arrow,directionX,directionY,normalX:-directionY,normalY:directionX,gap,bend:Math.max(0,Number(item.bend)||0)*gap,bendStart:start,bendEnd:end,controlSourcePoints:points,
    controlHandles:custom?controls:[{x:(s.x+e.x)/2,y:(s.y+e.y)/2}],routed:false,fromPort:output?.id,toPort:input?.id};
}
