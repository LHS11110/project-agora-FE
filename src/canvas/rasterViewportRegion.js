/** Quantized occupied pixels avoid copying/uploading a mostly transparent viewport. */
export function rasterViewportRegion(bounds,camera,width,height,step=64) {
  if(!bounds)return null;
  const left=Math.max(0,Math.floor((bounds.minX*camera.scale+camera.x-2)/step)*step);
  const top=Math.max(0,Math.floor((bounds.minY*camera.scale+camera.y-2)/step)*step);
  const right=Math.min(width,Math.ceil((bounds.maxX*camera.scale+camera.x+2)/step)*step);
  const bottom=Math.min(height,Math.ceil((bounds.maxY*camera.scale+camera.y+2)/step)*step);
  return right>left && bottom>top ? {x:left,y:top,width:right-left,height:bottom-top}:null;
}
