import {useCanvasGraphics} from '../CanvasGraphicsContext.jsx';
import {graphicsRasterItem,graphicsRasterRatio,GRAPHICS_PROFILES,normalizeGraphicsQuality} from '../graphicsQuality.js';
import {useLayoutEffect,useRef} from 'react';
import {rasterDescriptor,rasterizeObject} from '../rasterObjectCache.js';
import {useAnimationItems} from './animationStore.js';

export default function AnimatedVector({id,item,world,origin}){
 const node=useRef(null),cached=useRef(null),getItems=useAnimationItems(),quality=useCanvasGraphics();
 useLayoutEffect(()=>{
  const target=node.current,refs=getItems();
  const descriptor=rasterDescriptor(id,graphicsRasterItem(item,quality),world,refs);
  if(!descriptor){target.replaceChildren();cached.current=null;return;}
  const ratio=graphicsRasterRatio(quality,4,devicePixelRatio||1);
  const budget=GRAPHICS_PROFILES[normalizeGraphicsQuality(quality)].documentPixelBudget;
  const key=JSON.stringify([descriptor.key,ratio,budget]);
  // Playback, selection and position updates do not change the rendered pixels.
  // Keep the existing canvas (and its compositor texture) until its appearance changes.
  if(cached.current?.key!==key){
   const raster=rasterizeObject(id,descriptor,world,refs,ratio,budget);
   cached.current={key,raster};target.replaceChildren(raster.canvas);
  }
  const raster=cached.current.raster;
  Object.assign(raster.canvas.style,{position:'absolute',left:`${descriptor.x+raster.left-origin.x}px`,top:`${descriptor.y+raster.top-origin.y}px`,width:`${raster.width}px`,height:`${raster.height}px`,pointerEvents:'none'});
 },[id,item,world.width,world.height,origin.x,origin.y,getItems,quality]);
 return <span ref={node} className="animated-vector-surface" aria-hidden="true"/>;
}
