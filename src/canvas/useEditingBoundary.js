import { isInternalEditorPointer, isMonacoControl } from './editorInteraction.js';
import { useEffect, useRef } from 'react';

/** Losing input focus inside an object is not leaving that object's editor. */
export function useEditingBoundary(enabled, onExit, { pointerOnly = false } = {}) {
  const ref = useRef(null);
  const pointerInside = useRef(false);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  const root = () => ref.current?.closest('[data-item-id]') || ref.current;
  useEffect(() => {
    if (!enabled) return undefined;
    pointerInside.current = false;
    const track = event => {
      const boundary = root();
      pointerInside.current = isInternalEditorPointer(boundary, event);
      // An earlier click on internal padding may already have blurred the input.
      if (!pointerInside.current && boundary && (pointerOnly || !boundary.contains(document.activeElement))) exitRef.current?.();
    };
    document.addEventListener('pointerdown', track, true);
    return () => document.removeEventListener('pointerdown', track, true);
  }, [enabled, pointerOnly]);
  const onBlur = event => {
    if (!enabled || pointerOnly) return;
    const boundary = root();
    const next = event.relatedTarget;
    if (boundary?.contains(next) || isMonacoControl(next)) return;
    // Clicking a non-focusable caption/padding gives relatedTarget=null.
    if (!next && pointerInside.current) return;
    exitRef.current?.();
  };
  return { ref, onBlur };
}
