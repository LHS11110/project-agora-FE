export function minimapBitmapProjection(previous,current,width,height,pad=32){
  const scaleX=previous.width/current.width,scaleY=previous.height/current.height;
  const x=(previous.minX-current.minX)/current.width*width-pad*scaleX;
  const y=(previous.minY-current.minY)/current.height*height-pad*scaleY;
  return {x,y,scaleX,scaleY,covers:x<=0 && y<=0 && x+(width+pad*2)*scaleX>=width && y+(height+pad*2)*scaleY>=height};
}
