import {viewportPreloadPadding} from './viewportPreload.js';
// Quantization keeps membership stable while preparing a viewport-sized ring.
export function renderWindow(bounds,world,scale,viewport) {
  const view=viewport||{width:(bounds.maxX-bounds.minX)*world.width*scale,height:(bounds.maxY-bounds.minY)*world.height*scale};
  const padding=viewportPreloadPadding(view);
  const queryScale=2**Math.floor(Math.log2(Math.max(.01,scale)));
  const stepX=256/queryScale/world.width,stepY=256/queryScale/world.height;
  const cellsX=Math.ceil(padding.x*queryScale/scale/256-1e-8),cellsY=Math.ceil(padding.y*queryScale/scale/256-1e-8);
  const minX=Math.floor(bounds.minX/stepX)-cellsX,minY=Math.floor(bounds.minY/stepY)-cellsY;
  const maxX=Math.ceil(bounds.maxX/stepX)+cellsX,maxY=Math.ceil(bounds.maxY/stepY)+cellsY;
  return {key:[stepX,stepY,minX,minY,maxX,maxY].join(':'),bounds:{minX:minX*stepX,minY:minY*stepY,maxX:maxX*stepX,maxY:maxY*stepY}};
}
// Refill the ring while half the planned preparation margin is still available.
export function containsViewport(windowBounds,visible,world,scale,viewport) {
  if(!windowBounds)return false;
  const view=viewport||{width:(visible.maxX-visible.minX)*world.width*scale,height:(visible.maxY-visible.minY)*world.height*scale};
  const padding=viewportPreloadPadding(view);
  const x=padding.x*.5/scale/world.width,y=padding.y*.5/scale/world.height;
  return visible.minX-x>=windowBounds.minX&&visible.minY-y>=windowBounds.minY
    &&visible.maxX+x<=windowBounds.maxX&&visible.maxY+y<=windowBounds.maxY;
}
