// The stable stage owns gestures so changing object hit areas cannot interrupt them.
export function captureObjectPointer(board, drag, event) {
  drag.pointerId = event.pointerId;
  drag.captureElement = board;
  drag.pointerStart = { x: event.clientX, y: event.clientY };
  drag.pressElement = event.target;
  // Keep clicks on their original content; transfer to the stage only after movement.
  drag.pressElement?.setPointerCapture?.(event.pointerId);
}

export function activateObjectPointer(drag, event) {
  if (!drag.pointerStart) return true;
  if (Math.hypot(event.clientX - drag.pointerStart.x, event.clientY - drag.pointerStart.y) < 4) return false;
  drag.pointerStart = null;
  drag.captureElement?.classList.add('object-gesture-active');
  drag.captureElement?.setPointerCapture?.(event.pointerId);
  return true;
}

export function releaseObjectPointer(drag) {
  const board = drag.captureElement;
  board?.classList.remove('object-gesture-active');
  if (board?.hasPointerCapture?.(drag.pointerId)) board.releasePointerCapture(drag.pointerId);
  if (drag.pressElement?.hasPointerCapture?.(drag.pointerId)) drag.pressElement.releasePointerCapture(drag.pointerId);
}
