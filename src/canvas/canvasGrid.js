import './canvas-grid.css';
import { gridProjection } from './gridProjection.js';

/** Keep dot density bounded and anchored to world coordinate (0, 0). */
export function canvasGridStyle(camera){
  const {spacing,x,y}=gridProjection(camera);
  return {'--grid-size':`${spacing}px`,'--grid-dot-radius':'1px','--grid-position-x':`${x}px`,'--grid-position-y':`${y}px`};
}
