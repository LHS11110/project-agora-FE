import { createPortal } from 'react-dom';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ui } from '../../i18n/locale.js';
import Icon from '../../components/Icon.jsx';
import { normalizeCanvasColor } from '../useCanvasPalette.js';
import './text-selection-color.css';

const palette = [
  ['#263445', '먹색'], ['#64748b', '회색'], ['#ffffff', '흰색'], ['#7558d9', '보라색'],
  ['#2563eb', '파란색'], ['#0891b2', '청록색'], ['#15803d', '초록색'], ['#65a30d', '연두색'],
  ['#ca8a04', '노란색'], ['#ea580c', '주황색'], ['#dc2626', '빨간색'], ['#db2777', '분홍색'],
];

export default function TextSelectionColorPopover({ owner, inputRef, anchor, selectedText, activeColor, mixed, onChoose, onClose }) {
  const headingId = useId(), hintId = useId(), card = useRef(null);
  const [hex, setHex] = useState(activeColor || '#7558d9');
  const [position, setPosition] = useState(null);
  const valid = normalizeCanvasColor(hex);
  useLayoutEffect(() => { setHex(activeColor || '#7558d9'); }, [activeColor]);
  useLayoutEffect(() => {
    let frame;
    const place = () => {
      const input = inputRef.current, popup = card.current;
      if (!input || !popup) return;
      const bounds = input.getBoundingClientRect(), size = popup.getBoundingClientRect();
      const x = bounds.left + bounds.width * (anchor?.x ?? .5);
      const y = bounds.top + bounds.height * (anchor?.y ?? 1);
      const gap = 14, margin = 12;
      const left = Math.max(margin, Math.min(window.innerWidth - size.width - margin, x - size.width / 2));
      const below = y + gap;
      const top = Math.max(margin, Math.min(window.innerHeight - size.height - margin,
        below + size.height <= window.innerHeight - margin ? below : y - size.height - gap));
      setPosition(previous => previous?.left === left && previous?.top === top ? previous : { left, top });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(place); };
    place();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('wheel', schedule, true);
    const observer = new ResizeObserver(schedule); if (card.current) observer.observe(card.current);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true); window.removeEventListener('wheel', schedule, true); };
  }, [inputRef, anchor]);
  const host = inputRef.current?.closest('.canvas-app-page') || document.body;
  return createPortal(<section ref={card} className="text-selection-color-popover" role="dialog" aria-modal="false" aria-labelledby={headingId}
    data-text-selection-owner={owner} data-object-action="text-colors" style={position ? { left: position.left, top: position.top } : { visibility: 'hidden' }}
    onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}
    onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); onClose(); } }}>
    <header className="selection-color-heading"><span className="selection-color-heading-icon" aria-hidden="true">A</span><div><h2 id={headingId}>{ui('선택한 글자 색상')}</h2><small>{ui('{count}자 선택', { count: Array.from(selectedText).length })}</small></div><button type="button" className="selection-color-close" aria-label={ui('글자 색상 창 닫기')} onMouseDown={event => event.preventDefault()} onClick={onClose}><Icon name="close" size={16} /></button></header>
    <div className="selection-color-preview"><span style={activeColor ? { color: activeColor } : undefined}>{selectedText.replace(/\s+/g, ' ').slice(0, 80)}</span><small>{ui(mixed ? '여러 색상' : activeColor ? '지정한 색상' : '기본색')}</small></div>
    <div className="selection-color-swatches" role="group" aria-label={ui('추천 글자 색상')}>
      {palette.map(([color, name]) => <button key={color} type="button" className="selection-color-swatch" style={{ '--selection-swatch': color, '--selection-check': color === '#ffffff' ? '#263445' : '#ffffff' }}
        aria-label={ui('{label} 글자 색상', { label: ui(name) })} aria-pressed={activeColor?.toLowerCase() === color}
        title={ui('{label} 글자 색상', { label: ui(name) })} onMouseDown={event => event.preventDefault()} onClick={() => onChoose(color)}>
        {activeColor?.toLowerCase() === color && <Icon name="check" size={16} />}
      </button>)}
    </div>
    <form className="selection-color-custom" onSubmit={event => { event.preventDefault(); if (valid) onChoose(valid); }}>
      <label className="selection-custom-picker" title={ui('직접 색상 고르기')}><span style={{ background: valid || activeColor || '#7558d9' }} /><input type="color" aria-label={ui('선택한 글자 색상')} value={valid || activeColor || '#7558d9'} onChange={event => { setHex(event.target.value); onChoose(event.target.value, false); }} /></label>
      <label className="selection-hex-label"><span>HEX</span><input type="text" aria-label={ui('글자 색상 HEX 코드')} value={hex} maxLength={7} spellCheck={false} autoComplete="off" aria-invalid={!valid} aria-describedby={hintId} onChange={event => setHex(event.target.value)} /></label>
      <button className="selection-color-apply" type="submit" disabled={!valid}>{ui('적용')}</button>
    </form>
    <p id={hintId} className={`selection-color-hint${!valid ? ' is-invalid' : ''}`}>{ui(valid ? '색상을 누르면 선택한 글자에 바로 적용돼요.' : '#336699 또는 #369 형식으로 입력하세요.')}</p>
    <button className="selection-color-reset" type="button" aria-label={ui('선택 영역 색상 지우기')} onMouseDown={event => event.preventDefault()} onClick={() => onChoose('')}><Icon name="reset" size={14} />{ui('기본색으로 되돌리기')}</button>
  </section>, host);
}
