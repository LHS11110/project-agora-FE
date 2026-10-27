import { useEffect, useLayoutEffect, useRef } from 'react';
import { axisTickLayout } from './axisTicks.js';
import './canvas-axis-ticks.css';
const NS='http://www.w3.org/2000/svg';
function paint(group, rows, origin, size, horizontal) {
  while(group.children.length<rows.length){
    const node=document.createElementNS(NS,'g');
    node.append(document.createElementNS(NS,'line'),document.createElementNS(NS,'text'));group.append(node);
  }
  for(let index=0;index<group.children.length;index++){
    const node=group.children[index],row=rows[index];node.style.display=row?'':'none';if(!row)continue;
    const [line,text]=node.children,offset=horizontal?Math.min(origin+15,size-5):origin+8;
    node.setAttribute('data-value',String(row.value));
    if(horizontal){
      node.setAttribute('transform',`translate(${row.position} ${origin})`);
      line.setAttribute('x1','0');line.setAttribute('x2','0');line.setAttribute('y1','-3');line.setAttribute('y2','3');
      text.setAttribute('x','0');text.setAttribute('y',String(offset-origin));text.setAttribute('text-anchor','middle');
    }else{
      node.setAttribute('transform',`translate(${origin} ${row.position})`);
      line.setAttribute('x1','-3');line.setAttribute('x2','3');line.setAttribute('y1','0');line.setAttribute('y2','0');
      const left=origin>size-100;
      text.setAttribute('x',left?'-8':'8');text.setAttribute('y','3');text.setAttribute('text-anchor',left?'end':'start');
    }
    if(text.textContent!==row.label)text.textContent=row.label;
  }
}
export default function CanvasAxisTicks({boardRef,camera,showXAxis,showYAxis}){
  const svg=useRef(null),xGroup=useRef(null),yGroup=useRef(null),draw=useRef(null),latest=useRef(null);
  latest.current={camera,showXAxis,showYAxis};
  useEffect(()=>{
    const stage=boardRef.current;if(!stage)return undefined;
    let width=stage.clientWidth,height=stage.clientHeight,last='';
    const update=()=>{
      const c=latest.current,key=[c.camera.x,c.camera.y,c.camera.scale,width,height,c.showXAxis,c.showYAxis].join('|');
      if(key===last)return;last=key;
      const layout=axisTickLayout(c.camera,{width,height});
      svg.current.setAttribute('viewBox',`0 0 ${Math.max(1,width)} ${Math.max(1,height)}`);
      svg.current.setAttribute('data-step',String(layout.step??''));
      paint(xGroup.current,c.showXAxis?layout.x:[],layout.originY,height,true);
      paint(yGroup.current,c.showYAxis?layout.y:[],layout.originX,width,false);
    };
    draw.current=update;stage.addEventListener('agora-camera',update);
    const observer=new ResizeObserver(([entry])=>{width=entry.contentRect.width;height=entry.contentRect.height;update();});observer.observe(stage);update();
    return()=>{observer.disconnect();stage.removeEventListener('agora-camera',update);draw.current=null;};
  },[boardRef]);
  useLayoutEffect(()=>{draw.current?.();},[camera,showXAxis,showYAxis]);
  return <svg className="canvas-axis-ticks" ref={svg} aria-hidden="true"><g ref={xGroup} data-axis="x"/><g ref={yGroup} data-axis="y"/></svg>;
}
