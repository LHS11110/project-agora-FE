import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { useEffect, useState } from 'react';
import { CANVAS_SPACE } from './canvasSpace.js';
import { objectFontSize, MIN_OBJECT_FONT_SIZE, MAX_OBJECT_FONT_SIZE } from './objectSize.js';
import './object-size-controls.css';

export function SizeInput({ label, value, min, max, onCommit, unit = 'px', step = 1 }) {
  useUiLocale();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const number = Number(draft);
    if (!draft.trim() || !Number.isFinite(number) || number < min || number > max) { setDraft(String(value)); return; }
    if (number !== Number(value)) onCommit(number);
  };
  return <label>{label}<span><input type="number" min={min} max={max} step={step} aria-label={label} placeholder={ui("자동")} value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Enter') event.currentTarget.blur(); }} />{unit}</span></label>;
}

export default function ObjectSizeControls({ item, onFontSizeChange, onDimensionChange }) {
  useUiLocale();
  return <section className="inspector-section object-size-controls">
    <strong className="inspector-label">{ui(({ text: '텍스트', note: '포스트잇', code: '코드', table: '테이블', math: '수식' })[item.kind])}{" " + ui("크기") + ""}</strong>
    <SizeInput label={ui("글자 크기")} value={Math.round(objectFontSize(item) * 10) / 10} min={MIN_OBJECT_FONT_SIZE} max={MAX_OBJECT_FONT_SIZE} onCommit={onFontSizeChange} />
    <SizeInput label={ui("영역 너비")} value={Math.round((Number(item.width) || ({ code: .32, table: .42, math: .2 }[item.kind] || .22)) * CANVAS_SPACE.width)} min={40} max={16000} onCommit={value => onDimensionChange('width', value)} />
    <SizeInput label={ui("영역 높이")} value={item.height ? Math.round(Number(item.height) * CANVAS_SPACE.height) : ''} min={32} max={10000} onCommit={value => onDimensionChange('height', value)} />
    <small className="inspector-hint">{ui("영역 조절은 글자 크기를 유지합니다. 높이를 지정하지 않으면 내용에 따라 영역이 늘어납니다.")}</small>
  </section>;
}
