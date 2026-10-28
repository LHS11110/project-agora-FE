import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { useLayoutEffect, useRef, useState } from 'react';
import { useEditingBoundary } from '../useEditingBoundary.js';
import { moveTextPosition, textSpliceBetween } from '../collaborativeText.js';
import ColorText from './ColorText.jsx';
import './inline-content-input.css';

const labels = { plain: '텍스트', markdown: 'Markdown', latex: 'LaTeX' };

/** Plain input within the object: no editor frame, line numbers or code widgets. */
export default function InlineContentInput({ value, mode, colorRanges = [], onColorChange, onChange, onSave, onStopEditing }) {
  useUiLocale();
  const boundary = useEditingBoundary(true, onStopEditing, { pointerOnly: true });
  const displayed = useRef(String(value));
  const selection = useRef(null);
  const composing = useRef(false);
  const overlay = useRef(null);
  const [hasSelection, setHasSelection] = useState(false), [color, setColor] = useState('#7558d9'), [isComposing, setIsComposing] = useState(false);
  const rememberSelection = event => {
    const input = event.currentTarget;
    selection.current = { start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection };
    setHasSelection(input.selectionStart !== input.selectionEnd);
  };
  useLayoutEffect(() => {
    const input = boundary.ref.current;
    const source = String(value);
    if (!input) return;
    if (!composing.current && selection.current && displayed.current !== source) {
      const change = textSpliceBetween(displayed.current, source);
      const next = selection.current;
      const start = Math.max(0, Math.min(source.length, moveTextPosition(next.start, change)));
      const end = Math.max(start, Math.min(source.length, moveTextPosition(next.end, change)));
      if (input === document.activeElement) input.setSelectionRange(start, end, next.direction);
      selection.current = { start, end, direction: next.direction };
      setHasSelection(start !== end);
    }
    displayed.current = source;
    if (overlay.current) overlay.current.style.transform = `translate(${-input.scrollLeft}px, ${-input.scrollTop}px)`;
    // Fit the source rather than inserting a fixed-height editor into the object.
    if (!input.closest('.has-custom-height')) {
      input.style.height = '0px';
      input.style.height = `${Math.max(28, input.scrollHeight)}px`;
    }
  }, [value, mode, boundary.ref, colorRanges]);
  const setSelectionColor = value => {
    const range = selection.current;
    if (!range || range.start === range.end) return;
    onColorChange?.(range.start, range.end, value);
  };
  return <div className="inline-content-editor">
    {onColorChange && hasSelection && <div className="text-selection-colors" onPointerDown={event => event.stopPropagation()}>
      <label>{ui('선택한 글자 색상')}<input type="color" aria-label={ui('선택한 글자 색상')} value={color} onChange={event => { setColor(event.target.value); setSelectionColor(event.target.value); }} /></label>
      <button type="button" onClick={() => setSelectionColor('')}>{ui('선택 영역 색상 지우기')}</button>
    </div>}
    <div className="inline-content-input-frame">
    {colorRanges.length > 0 && !isComposing && <div className="inline-content-color-overlay" aria-hidden="true"><div ref={overlay}><ColorText value={value} ranges={colorRanges} />{'\n'}</div></div>}
    <textarea ref={boundary.ref} className={`inline-content-input${colorRanges.length && !isComposing ? ' has-text-colors' : ''}`} data-mode={mode} autoFocus rows={1}
    aria-label={ui("{v0} 직접 수정", {
  v0: ui(labels[mode]) || ui("내용")
})} value={value} spellCheck={mode === 'plain'}
    placeholder={mode === 'latex' ? ui("예: f(x) = x^2 + 2x + 1") : mode === 'markdown' ? ui("Markdown과 $수식$을 입력하세요") : ui("내용을 입력하세요")}
    onSelect={rememberSelection} onCompositionStart={() => { composing.current = true; setIsComposing(true); }} onCompositionEnd={() => { composing.current = false; setIsComposing(false); }}
    onScroll={event => { if (overlay.current) overlay.current.style.transform = `translate(${-event.currentTarget.scrollLeft}px, ${-event.currentTarget.scrollTop}px)`; }}
    onChange={event => { displayed.current = event.target.value; rememberSelection(event); onChange(event.target.value); }}
    onPointerDown={event => event.stopPropagation()} onPointerMove={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.isComposing || event.nativeEvent.isComposing || composing.current) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); onSave(); }
      else if (event.key === 'Escape') { event.preventDefault(); onStopEditing(); }
    }} />
    </div>
  </div>;
}
