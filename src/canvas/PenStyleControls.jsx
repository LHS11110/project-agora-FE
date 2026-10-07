import { PEN_STYLES } from './penStyles.js';
import './pen-style-controls.css';
export default function PenStyleControls({ brush, opacity, onBrushChange, onOpacityChange, compact = false }) {
  const transparency = Math.round((1 - opacity) * 100);
  return <div className={`pen-style-controls${compact ? ' compact' : ''}`}>
    <label>스타일<select aria-label="드로잉 스타일" value={brush} onChange={event => onBrushChange(event.target.value)}>{PEN_STYLES.map(style => <option key={style.id} value={style.id}>{style.label}</option>)}</select></label>
    <label>투명도 <span>{transparency}%</span><input aria-label="드로잉 투명도" type="range" min="0" max="100" step="1" value={transparency} onChange={event => onOpacityChange(1 - Number(event.target.value) / 100)} /></label>
    {!compact && <small>{PEN_STYLES.find(style => style.id === brush)?.description} · 새로 그리는 선에 적용됩니다.{brush === 'highlighter' && ' 형광펜은 기본적으로 반투명합니다.'}</small>}
  </div>;
}
