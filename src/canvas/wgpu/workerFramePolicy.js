/** Cached reprojection remains an immediate visual fallback, not a substitute
 * for fresh GPU frames while the camera is moving. Idle scenes do no extra work. */
export function needsFreshWorkerFrame({moving,changed,hasFrame}){
 return !hasFrame||Boolean(moving&&changed);
}
