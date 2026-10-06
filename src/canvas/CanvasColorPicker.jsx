import { useId, useRef, useState } from 'react';
import { normalizeCanvasColor } from './useCanvasPalette.js';
import './canvas-color-picker.css';

export default function CanvasColorPicker({ color, onChange, favoriteColors, onSaveFavorite, label = '색상', compact = false }) {
  const dialogRef = useRef(null);
  const headingId = useId();
  const [draft, setDraft] = useState(color);
  const [hex, setHex] = useState(color);
  const [message, setMessage] = useState('');
  const validColor = normalizeCanvasColor(hex);
  const choose = value => { setDraft(value); setHex(value); setMessage(''); };
  const open = () => {
    choose(normalizeCanvasColor(color) || '#263b35');
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();
  return <div className={`canvas-color-control${compact ? ' compact' : ''}`}>
    <div className="canvas-favorite-swatches" role="group" aria-label={`${label} · 자주 쓰는 색상`}>
      {favoriteColors.map((saved, index) => <button key={index} type="button" className={`canvas-color-swatch${normalizeCanvasColor(color) === saved ? ' selected' : ''}`} style={{ '--swatch': saved }} title={`저장 색상 ${index + 1}: ${saved}`} aria-label={`저장 색상 ${index + 1}: ${saved}`} aria-pressed={normalizeCanvasColor(color) === saved} onClick={() => onChange(saved)} />)}
    </div>
    <button type="button" className="canvas-custom-color-button" onClick={open} aria-haspopup="dialog" aria-label={`${label} 자유 선택 및 저장 색상 관리`}><i style={{ background: color }} aria-hidden="true" />{compact ? '색상 선택' : '자유 선택 · 색상 관리'}</button>
    <dialog ref={dialogRef} className="canvas-color-dialog" aria-labelledby={headingId} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Enter' && event.target.tagName === 'INPUT' && validColor) { event.preventDefault(); onChange(validColor); close(); }
    }} onClick={event => {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) close();
    }}>
      <div className="canvas-color-dialog-heading"><h2 id={headingId}>{label} 선택</h2><button type="button" onClick={close} aria-label="색상 선택 닫기">×</button></div>
      <div className="canvas-color-inputs"><label>자유 선택<input type="color" value={draft} onChange={event => choose(event.target.value)} aria-label={`${label} 색상 선택기`} /></label><label>HEX 색상 코드<input type="text" value={hex} maxLength={7} spellCheck={false} aria-label="HEX 색상 코드" aria-invalid={!validColor} onChange={event => {
        setHex(event.target.value); setMessage('');
        const next = normalizeCanvasColor(event.target.value);
        if (next) setDraft(next);
      }} /></label></div>
      {!validColor && <p className="canvas-color-message">#336699 또는 #369 형식으로 입력하세요.</p>}
      <h3>자주 쓰는 색상 5개</h3><p className="canvas-color-description">원하는 칸에 현재 색상을 저장하세요. 기존 색상은 교체됩니다.<br />이 브라우저에 저장되어 다른 캔버스에서도 사용할 수 있어요.</p>
      <div className="canvas-color-save-slots">{favoriteColors.map((saved, index) => <div key={index}><button className="canvas-color-saved-value" type="button" onClick={() => choose(saved)} aria-label={`저장 색상 ${index + 1} 선택: ${saved}`}><i style={{ background: saved }} aria-hidden="true" /><span>{index + 1}</span><code>{saved}</code></button><button type="button" className="canvas-color-save-button" disabled={!validColor} onClick={() => {
        onSaveFavorite(index, validColor); setMessage(`${index + 1}번에 ${validColor} 색상을 저장했어요.`);
      }}>현재 색상 저장</button></div>)}</div>
      <p className="canvas-color-message" role="status">{message}</p>
      <div className="canvas-color-dialog-actions"><button type="button" className="button button-outline" onClick={close}>취소</button><button type="button" className="button button-dark" disabled={!validColor} onClick={() => { onChange(validColor); close(); }}>색상 적용</button></div>
    </dialog>
  </div>;
}
