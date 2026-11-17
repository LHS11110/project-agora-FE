// Camera transforms stay on rAF; expensive scene/React updates have their own cadence.
export function shouldCommitCamera(previous,next,elapsed){
 const zooming=previous.scale!==next.scale;
 if (zooming) return elapsed>=140;
 // Pixel transforms still run each frame. Refresh membership before consuming
 // half of the 512px overscan, or periodically during slow continuous motion.
 return Math.max(Math.abs(next.x-previous.x),Math.abs(next.y-previous.y))>=256 || elapsed>=240;
}
