import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gridProjection } from './gridProjection.js';
import { CANVAS_SPACE, formatCanvasZoom } from './canvasSpace.js';

// Camera motion is a compositor update. React refreshes scene membership at
// most every 100ms, sooner if the camera could leave the prepared overscan.
export function useCanvasCamera(boardRef,sceneRef) {
  const current=useRef({x:0,y:0,scale:1}),committed=useRef(current.current);
  const [revision,setRevision]=useState(0);
  const work=useRef({frame:0,idle:0,lastCommit:0,observer:null,size:null});
  const commit=useCallback(()=>{
    committed.current={...current.current};work.current.lastCommit=performance.now();
    setRevision(value=>value+1);
  },[]);
  const apply=useCallback(()=>{
    const stage=boardRef.current,scene=sceneRef.current,camera=current.current;
    if(!stage || !scene)return;
    if(work.current.size?.stage!==stage){
      work.current.observer?.disconnect();work.current.size={stage,width:stage.clientWidth,height:stage.clientHeight};
      work.current.observer=new ResizeObserver(([entry])=>{work.current.size={stage,width:entry.contentRect.width,height:entry.contentRect.height};});work.current.observer.observe(stage);
    }
    const {width,height}=work.current.size;
    for(const layer of scene.querySelectorAll('.canvas-world-layer'))layer.style.transform=`translate3d(${camera.x}px,${camera.y}px,0) scale(${camera.scale})`;
    const grid=stage.querySelector('.canvas-grid-surface');
    if(grid)grid.style.transform=gridProjection(camera).transform;
    const axes=stage.querySelector('.coordinate-plane');
    if(axes){
      const x=CANVAS_SPACE.width*camera.scale/2+camera.x,y=CANVAS_SPACE.height*camera.scale/2+camera.y;
      axes.style.setProperty('--axis-origin-x',`${x}px`);axes.style.setProperty('--axis-origin-y',`${y}px`);
      axes.style.setProperty('--axis-x-arrow-opacity',x<=width?'1':'0');axes.style.setProperty('--axis-y-arrow-opacity',y>=0?'1':'0');
    }
    const laser=stage.querySelector('.laser-layer > g');laser?.setAttribute('transform',`translate(${camera.x} ${camera.y}) scale(${camera.scale})`);
    const rect=stage.querySelector('.canvas-minimap-viewport');
    if(rect){for(const [key,value] of Object.entries({x:-camera.x/camera.scale,y:-camera.y/camera.scale,width:width/camera.scale,height:height/camera.scale}))rect.setAttribute(key,value);}
    const zoom=stage.parentElement?.querySelector('.zoom-value');if(zoom)zoom.textContent=formatCanvasZoom(camera.scale);
    stage.dispatchEvent(new Event('agora-camera'));
  },[boardRef,sceneRef]);
  const setCamera=useCallback(update=>{
    const next=typeof update==='function'?update(current.current):update;
    if(!next || ![next.x,next.y,next.scale].every(Number.isFinite) || next.scale<=0)return;
    if(next.x===current.current.x && next.y===current.current.y && next.scale===current.current.scale)return;
    current.current=next;
    boardRef.current?.classList.add('camera-moving');
    if(!work.current.frame)work.current.frame=requestAnimationFrame(()=>{
      work.current.frame=0;apply();
      const before=committed.current,now=current.current;
      if(performance.now()-work.current.lastCommit>=100 || Math.abs(now.x-before.x)>96 || Math.abs(now.y-before.y)>96 || Math.abs(Math.log(now.scale/before.scale))>.15)commit();
    });
    clearTimeout(work.current.idle);
    work.current.idle=setTimeout(()=>{boardRef.current?.classList.remove('camera-moving');commit();},120);
  },[apply,commit,boardRef]);
  const camera=useMemo(()=>({get x(){return current.current.x},get y(){return current.current.y},get scale(){return current.current.scale}}),[revision]);
  useLayoutEffect(apply);
  useLayoutEffect(()=>()=>{cancelAnimationFrame(work.current.frame);clearTimeout(work.current.idle);work.current.observer?.disconnect();boardRef.current?.classList.remove('camera-moving');},[boardRef]);
  return [camera,setCamera];
}
