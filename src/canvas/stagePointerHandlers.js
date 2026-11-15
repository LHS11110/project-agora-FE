export function stagePointerHandlers({ disabled=false, activeTool, dragRef, panRef, spacePressedRef, startPan, cancelCameraMotion, startDrawing, moveDrawing, stopDrawing, moveObject, stopObjectDrag, hideCursor, sendCursorPosition, pickVector, touchNavigation }) {
  if(disabled)return {};
  const isCanvasUi = event => Boolean(event.target.closest?.('[data-canvas-ui]'));
  const finish = (event) => {
    if(isCanvasUi(event))return;
    if (dragRef.current) stopObjectDrag(event);
    else stopDrawing(event);
  };
  return {
    onPointerDownCapture: (event) => {
      if(isCanvasUi(event))return;
      if (touchNavigation?.down(event)) return;
      if (event.target.closest?.('.canvas-minimap')) return;
      cancelCameraMotion?.();
      if (activeTool !== 'hand' && event.target.closest?.('.canvas-code-editor')) return;
      if (panRef.current) { event.preventDefault(); event.stopPropagation(); return; }
      if (event.button === 1 || (event.button === 0 && (activeTool === 'hand' || spacePressedRef.current))) startPan(event);
      else pickVector?.(event, false, true);
    },
    onPointerMoveCapture: (event) => {
      if(isCanvasUi(event))return;
      if (touchNavigation?.move(event)) return;
      if (!event.target.closest?.('.canvas-minimap')) sendCursorPosition?.(event);
      if (!panRef.current) return;
      event.stopPropagation();
      moveDrawing(event);
    },
    onPointerUpCapture: (event) => {
      if(isCanvasUi(event))return;
      if (touchNavigation?.up(event)) return;
      if (!panRef.current) return;
      event.stopPropagation();
      stopDrawing(event);
    },
    onPointerCancelCapture: (event) => {
      if(isCanvasUi(event))return;
      if (touchNavigation?.up(event)) return;
      if (!panRef.current) return;
      event.stopPropagation();
      stopDrawing(event);
    },
    onPointerDown: event => { if(isCanvasUi(event))return;if (!pickVector?.(event)) startDrawing(event); },
    onDoubleClick: event => {if(!isCanvasUi(event))pickVector?.(event, true);},
    onPointerMove: (event) => {
      if(isCanvasUi(event))return;
      if (dragRef.current) moveObject(event);
      else moveDrawing(event);
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture: (event) => {
      // A child's capture loss bubbles here too; it does not end the stage gesture.
      if (event.target !== event.currentTarget || touchNavigation?.active) return;
      if (dragRef.current) stopObjectDrag(event);
      else stopDrawing(event);
    },
    onPointerLeave: hideCursor,
  };
}
