// Camera transforms stay on rAF; expensive scene/React updates have their own cadence.
export function shouldCommitCamera(previous,next,elapsed){
 const zooming=previous.scale!==next.scale;
 return elapsed>=(zooming?140:90);
}
