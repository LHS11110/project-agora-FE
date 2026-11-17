// Camera pixels update on every browser animation frame. Rebuild scene membership
// only when the retained overscan is consumed, or a large zoom can trim the scene.
export function shouldCommitCamera(previous,next,viewport) {
  const width=Math.max(1,viewport?.width||1),height=Math.max(1,viewport?.height||1);
  const ratio=previous.scale/next.scale;
  const left=previous.x-next.x*ratio,top=previous.y-next.y*ratio;
  const margin=256;
  return left < -margin || top < -margin || left+width*ratio > width+margin || top+height*ratio > height+margin
    || next.scale/previous.scale>=2;
}
