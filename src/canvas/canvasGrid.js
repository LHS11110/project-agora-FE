import './canvas-grid.css';
import { gridProjection } from './gridProjection.js';

/** Keep dot density bounded and anchored to world coordinate (0, 0). */
export function canvasGridStyle(camera,interval){
  const {spacing,spacingY,x,y}=gridProjection(camera,interval);
  return {'--grid-size':`${spacing}px`,'--grid-size-x':`${spacing}px`,'--grid-size-y':`${spacingY}px`,'--grid-dot-radius':'1px','--grid-position-x':`${x}px`,'--grid-position-y':`${y}px`};
}
