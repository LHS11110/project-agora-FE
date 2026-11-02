export const PLAYER_OBSTACLES = '.canvas-quick-dock, .board-topline, .canvas-panel-slot, .canvas-minimap, .canvas-viewport-controls, .canvas-header-right';
const overlaps = (a,b,gap=10) => a.left < b.right+gap && a.right > b.left-gap && a.top < b.bottom+gap && a.bottom > b.top-gap;
export function launcherPosition(width,height,obstacles) {
  const size=42, margin=16;
  for(let x=width-margin-size;x>=margin;x-=size+12) {
    for(let y=height-margin-size;y>=margin;y-=size+12) {
      const rect={left:x,right:x+size,top:y,bottom:y+size};
      if(!obstacles.some(r=>overlaps(rect,r)))return {left:x,top:y};
    }
  }
  return {left:Math.max(8,width-size-16),top:16};
}
