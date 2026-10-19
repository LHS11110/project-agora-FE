import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { useLayoutEffect, useRef } from 'react';
import { useEditingBoundary } from '../useEditingBoundary.js';
import { moveTextPosition, textSpliceBetween } from '../collaborativeText.js';
import './inline-content-input.css';

const labels = { plain: '텍스트', markdown: 'Markdown', latex: 'LaTeX' };

/** Plain input within the object: no editor frame, line numbers or code widgets. */
export default function InlineContentInput({ value, mode, onChange, onSave, onStopEditing }) {
  useUiLocale();
  const boundary = useEditingBoundary(true, onStopEditing, { pointerOnly: true });
  const displayed = useRef(String(value));
  const selection = useRef(null);
  const composing = useRef(false);
  const rememberSelection = event => {
    const input = event.currentTarget;
    selection.current = { start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection };
  };
  useLayoutEffect(() => {
    const input = boundary.ref.current;
    const source = String(value);
    if (!input) return;
    if (input === document.activeElement && !composing.current && selection.current && displayed.current !== source) {
      const change = textSpliceBetween(displayed.current, source);
      const next = selection.current;
      const start = Math.max(0, Math.min(source.length, moveTextPosition(next.start, change)));
      const end = Math.max(start, Math.min(source.length, moveTextPosition(next.end, change)));
      input.setSelectionRange(start, end, next.direction);
      selection.current = { start, end, direction: next.direction };
    }
    displayed.current = source;
    // Fit the source rather than inserting a fixed-height editor into the object.
    if (!input.closest('.has-custom-height')) {
      input.style.height = '0px';
      input.style.height = `${Math.max(28, input.scrollHeight)}px`;
    }
  }, [value, mode, boundary.ref]);
  return <textarea ref={boundary.ref} className="inline-content-input" data-mode={mode} autoFocus rows={1}
    aria-label={ui("{v0} 직접 수정", {
  v0: ui(labels[mode]) || ui("내용")
})} value={value} spellCheck={mode === 'plain'}
    placeholder={mode === 'latex' ? ui("예: f(x) = x^2 + 2x + 1") : mode === 'markdown' ? ui("Markdown과 $수식$을 입력하세요") : ui("내용을 입력하세요")}
    onSelect={rememberSelection} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
    onChange={event => { displayed.current = event.target.value; rememberSelection(event); onChange(event.target.value); }}
    onPointerDown={event => event.stopPropagation()} onPointerMove={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.isComposing || event.nativeEvent.isComposing || composing.current) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); onSave(); }
      else if (event.key === 'Escape') { event.preventDefault(); onStopEditing(); }
    }} />;
}
