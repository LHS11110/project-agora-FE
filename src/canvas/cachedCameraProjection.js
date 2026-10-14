/** Project an overscan bitmap into the current viewport without repainting it. */
export function cachedCameraProjection(cached,camera,width,height,margin=256) {
  if(!cached || !(cached.scale>0) || !(camera.scale>0))return null;
  const scale=camera.scale/cached.scale;
  const x=camera.x-(cached.x+margin)*scale,y=camera.y-(cached.y+margin)*scale;
  if(![scale,x,y].every(Number.isFinite) || x>0 || y>0 || x+(width+margin*2)*scale<width || y+(height+margin*2)*scale<height)return null;
  return {x,y,scale};
}
