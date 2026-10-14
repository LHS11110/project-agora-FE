// Quantized overscan reuses scene membership during small pans. The renderer
// moves cached pixels immediately; only crossing a cell queries the tree again.
export function renderWindow(bounds, world, scale) {
  const queryScale=2**Math.floor(Math.log2(Math.max(.01,scale)));
  const stepX=256/queryScale/world.width,stepY=256/queryScale/world.height;
  const minX=Math.floor(bounds.minX/stepX)-1,minY=Math.floor(bounds.minY/stepY)-1;
  const maxX=Math.ceil(bounds.maxX/stepX)+1,maxY=Math.ceil(bounds.maxY/stepY)+1;
  return {key:[stepX,stepY,minX,minY,maxX,maxY].join(':'),bounds:{minX:minX*stepX,minY:minY*stepY,maxX:maxX*stepX,maxY:maxY*stepY}};
}
