export function stagePointerHandlers({ activeTool, dragRef, panRef, spacePressedRef, startPan, cancelCameraMotion, startDrawing, moveDrawing, stopDrawing, moveObject, stopObjectDrag, hideCursor, pickVector }) {
  const finish = (event) => {
    if (dragRef.current) stopObjectDrag(event);
    else stopDrawing(event);
  };
  return {
    onPointerDownCapture: (event) => {
      if (event.target.closest?.('.canvas-minimap')) return;
      cancelCameraMotion?.();
      if (activeTool !== 'hand' && event.target.closest?.('.canvas-code-editor')) return;
      if (panRef.current) { event.preventDefault(); event.stopPropagation(); return; }
      if (event.button === 1 || (event.button === 0 && (activeTool === 'hand' || spacePressedRef.current))) startPan(event);
      else pickVector?.(event, false, true);
    },
    onPointerMoveCapture: (event) => {
      if (!panRef.current) return;
      event.stopPropagation();
      moveDrawing(event);
    },
    onPointerUpCapture: (event) => {
      if (!panRef.current) return;
      event.stopPropagation();
      stopDrawing(event);
    },
    onPointerCancelCapture: (event) => {
      if (!panRef.current) return;
      event.stopPropagation();
      stopDrawing(event);
    },
    onPointerDown: event => { if (!pickVector?.(event)) startDrawing(event); },
    onDoubleClick: event => pickVector?.(event, true),
    onPointerMove: (event) => {
      if (dragRef.current) moveObject(event);
      else moveDrawing(event);
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture: (event) => {
      // A child's capture loss bubbles here too; it does not end the stage gesture.
      if (event.target !== event.currentTarget) return;
      if (dragRef.current) stopObjectDrag(event);
      else stopDrawing(event);
    },
    onPointerLeave: hideCursor,
  };
}
