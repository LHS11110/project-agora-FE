// Quantized overscan reuses scene membership during small pans. The renderer
// moves cached pixels immediately. Two cells provide room for hysteresis so
// scene membership need not churn whenever a viewport edge crosses one cell.
export function renderWindow(bounds, world, scale) {
  const queryScale=2**Math.floor(Math.log2(Math.max(.01,scale)));
  const stepX=256/queryScale/world.width,stepY=256/queryScale/world.height;
  const minX=Math.floor(bounds.minX/stepX)-2,minY=Math.floor(bounds.minY/stepY)-2;
  const maxX=Math.ceil(bounds.maxX/stepX)+2,maxY=Math.ceil(bounds.maxY/stepY)+2;
  return {key:[stepX,stepY,minX,minY,maxX,maxY].join(':'),bounds:{minX:minX*stepX,minY:minY*stepY,maxX:maxX*stepX,maxY:maxY*stepY}};
}

// Requery before the viewport reaches the retained window's edge, regardless
// of direction or zoom. This does not authorize reuse after data changes.
export function containsViewport(windowBounds, visible, world, scale) {
  if (!windowBounds) return false;
  const x=64/scale/world.width,y=64/scale/world.height;
  return visible.minX-x>=windowBounds.minX && visible.minY-y>=windowBounds.minY
    && visible.maxX+x<=windowBounds.maxX && visible.maxY+y<=windowBounds.maxY;
}
