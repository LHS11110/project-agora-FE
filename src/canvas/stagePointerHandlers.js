export function stagePointerHandlers({ dragRef, panRef, spacePressedRef, startPan, startDrawing, moveDrawing, stopDrawing, moveObject, stopObjectDrag, hideCursor }) {
  const finish = (event) => {
    if (dragRef.current) stopObjectDrag(event);
    else stopDrawing(event);
  };
  return {
    onPointerDownCapture: (event) => {
      if (event.target.closest?.('.canvas-minimap, .canvas-code-editor')) return;
      if (panRef.current) { event.preventDefault(); event.stopPropagation(); return; }
      if (event.button === 1 || (event.button === 0 && spacePressedRef.current)) startPan(event);
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
    onPointerDown: startDrawing,
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
