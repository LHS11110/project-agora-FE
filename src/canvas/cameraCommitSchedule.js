import {containsViewport} from './renderWindow.js';
import {viewportPreloadPadding} from './viewportPreload.js';
// Camera pixels update on every browser animation frame. Rebuild scene membership
// only when the retained overscan is consumed, or a large zoom can trim the scene.
export function shouldCommitCamera(previous,next,viewport,prepared) {
  const width=Math.max(1,viewport?.width||1),height=Math.max(1,viewport?.height||1);
  if(prepared){
    const world=prepared.world;
    const visible={minX:-next.x/next.scale/world.width,minY:-next.y/next.scale/world.height,maxX:(width-next.x)/next.scale/world.width,maxY:(height-next.y)/next.scale/world.height};
    return !containsViewport(prepared.bounds,visible,world,next.scale,viewport)||next.scale/previous.scale>=2;
  }
  const ratio=previous.scale/next.scale;
  const left=previous.x-next.x*ratio,top=previous.y-next.y*ratio;
  const padding=viewportPreloadPadding(viewport),marginX=padding.x*.5,marginY=padding.y*.5;
  return left < -marginX || top < -marginY || left+width*ratio > width+marginX || top+height*ratio > height+marginY
    || next.scale/previous.scale>=2;
}
