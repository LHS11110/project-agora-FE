import { useEffect } from 'react';
import { CANVAS_SPACE } from './canvasSpace.js';

const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
export function canvasNudgeVector(event) {
  if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || !directions[event.key]) return null;
  // Preserve caret navigation, numeric/range inputs and keyboard-operated panels.
  if (event.target?.isContentEditable || event.target?.closest?.('input, textarea, select, button, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="spinbutton"], [role="dialog"], [role="menu"], .monaco-editor, .canvas-code-editor, .canvas-as-code-overlay, .canvas-management-dialog')) return null;
  const step = event.shiftKey ? 10 : 1;
  const [x, y] = directions[event.key];
  return { dx: x * step / CANVAS_SPACE.width, dy: y * step / CANVAS_SPACE.height };
}

export default function useCanvasKeyboardNudge({ activeTool, editingId, selectedIds, itemsRef, sessionRef, dragRef, moveItems, flushMoves }) {
  useEffect(() => {
    let moved = false;
    const flush = () => { if (moved) { moved = false; flushMoves(); } };
    const onKeyDown = event => {
      if (activeTool !== 'select' || editingId != null || !sessionRef.current.editable || dragRef.current) return;
      const vector = canvasNudgeVector(event);
      if (!vector) return;
      const ids = [...new Set(selectedIds.map(String))].filter(id => {
        const item = itemsRef.current[id];
        return item && item.kind !== 'connector' && item.type !== 'chat_room';
      });
      if (!ids.length) return;
      event.preventDefault();
      if (moveItems(ids, vector.dx, vector.dy)) moved = true;
    };
    const onKeyUp = event => { if (directions[event.key]) flush(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', flush);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', flush); flush(); };
  }, [activeTool, editingId, selectedIds, itemsRef, sessionRef, dragRef, moveItems, flushMoves]);
}
