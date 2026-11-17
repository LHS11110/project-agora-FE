import { useEffect, useLayoutEffect, useRef } from 'react';
import { axisTickLayout } from './axisTicks.js';
import './canvas-axis-ticks.css';
const NS='http://www.w3.org/2000/svg';
function setAttr(node, name, value) {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function paint(group, rows, origin, size, horizontal, zooming) {
  while(group.children.length<rows.length){
    const node=document.createElementNS(NS,'g');
    const line=document.createElementNS(NS,'line');
    const text=document.createElementNS(NS,'text');
    if(horizontal){line.setAttribute('x1','0');line.setAttribute('x2','0');line.setAttribute('y1','-3');line.setAttribute('y2','3');text.setAttribute('x','0');text.setAttribute('text-anchor','middle');}
    else{line.setAttribute('x1','-3');line.setAttribute('x2','3');line.setAttribute('y1','0');line.setAttribute('y2','0');text.setAttribute('y','3');}
    node.append(line,text);group.append(node);
  }
  const left = horizontal ? false : origin > size - 100;
  const textX = left ? '-8' : '8', textAnchor = left ? 'end' : 'start', textY = horizontal ? String(origin > size - 30 ? -8 : 15) : null;
  for(let index=0;index<group.children.length;index++){
    const node=group.children[index],row=rows[index];
    if(!row){if(node.style.display!=='none')node.style.display='none';continue;}
    if(node.style.display)node.style.display='';
    const [,text]=node.children;
    setAttr(node,'data-value',String(row.value));
    setAttr(node,'transform',horizontal?`translate(${row.position} ${origin})`:`translate(${origin} ${row.position})`);
    {
      if(horizontal)setAttr(text,'y',textY);
      else{setAttr(text,'x',textX);setAttr(text,'text-anchor',textAnchor);}
      if(text.textContent!==row.label)text.textContent=row.label;
    }
  }
}
export default function CanvasAxisTicks({boardRef,camera,showXAxis,showYAxis}){
  const svg=useRef(null),xGroup=useRef(null),yGroup=useRef(null),draw=useRef(null),latest=useRef(null);
  latest.current={camera,showXAxis,showYAxis};
  useEffect(()=>{
    const stage=boardRef.current;if(!stage)return undefined;
    let width=stage.clientWidth,height=stage.clientHeight,last='';
    const update=()=>{
      const zooming=stage.classList.contains('camera-zooming')?1:0;
      const c=latest.current,key=[c.camera.x,c.camera.y,c.camera.scale,width,height,c.showXAxis,c.showYAxis,zooming].join('|');
      if(key===last)return;last=key;
      const layout=axisTickLayout(c.camera,{width,height});
      setAttr(svg.current,'viewBox',`0 0 ${Math.max(1,width)} ${Math.max(1,height)}`);
      setAttr(svg.current,'data-step',String(layout.step??''));
      paint(xGroup.current,c.showXAxis?layout.x:[],layout.displayY??layout.originY,height,true,zooming);
      paint(yGroup.current,c.showYAxis?layout.y:[],layout.displayX??layout.originX,width,false,zooming);
    };
    draw.current=update;stage.addEventListener('agora-camera',update);
    const observer=new ResizeObserver(([entry])=>{width=entry.contentRect.width;height=entry.contentRect.height;update();});observer.observe(stage);update();
    return()=>{observer.disconnect();stage.removeEventListener('agora-camera',update);draw.current=null;};
  },[boardRef]);
  useLayoutEffect(()=>{draw.current?.();},[camera,showXAxis,showYAxis]);
  return <svg className="canvas-axis-ticks" ref={svg} aria-hidden="true"><g ref={xGroup} data-axis="x"/><g ref={yGroup} data-axis="y"/></svg>;
}
