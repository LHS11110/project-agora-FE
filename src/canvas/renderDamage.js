export function paintBounds(descriptor,raster) {
  const x=descriptor.x+descriptor.centerX,y=descriptor.y+descriptor.centerY;
  const left=raster.left-descriptor.centerX,top=raster.top-descriptor.centerY;
  const angle=descriptor.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const corners=[[left,top],[left+raster.width,top],[left+raster.width,top+raster.height],[left,top+raster.height]];
  const bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(const [dx,dy] of corners){const px=x+dx*c-dy*s,py=y+dx*s+dy*c;bounds.minX=Math.min(bounds.minX,px);bounds.minY=Math.min(bounds.minY,py);bounds.maxX=Math.max(bounds.maxX,px);bounds.maxY=Math.max(bounds.maxY,py);}
  return bounds;
}
export const overlaps=(a,b)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minY<=b.maxY&&a.maxY>=b.minY;
export function mergeDamage(rectangles,padding=2) {
  if(!rectangles.length)return null;
  return rectangles.reduce((a,b)=>({minX:Math.min(a.minX,b.minX-padding),minY:Math.min(a.minY,b.minY-padding),maxX:Math.max(a.maxX,b.maxX+padding),maxY:Math.max(a.maxY,b.maxY+padding)}),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
}
