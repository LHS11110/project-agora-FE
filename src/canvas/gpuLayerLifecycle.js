// A depth layer can disappear while WebGL's asynchronous loss event is queued.
// Never access the Application's canvas getter after its renderer is destroyed.
export function observeGpuContextLoss(canvas, isDisposed, onLost) {
  let active = true;
  const listener = event => {
    if (!active || isDisposed()) return;
    onLost(event);
  };
  canvas.addEventListener('webglcontextlost', listener);
  return () => {
    active = false;
    canvas.removeEventListener('webglcontextlost', listener);
  };
}
