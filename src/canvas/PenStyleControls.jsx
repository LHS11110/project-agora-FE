import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { PEN_STYLES } from './penStyles.js';
import './pen-style-controls.css';
export default function PenStyleControls({ brush, opacity, onBrushChange, onOpacityChange, compact = false }) {
  useUiLocale();
  const transparency = Math.round((1 - opacity) * 100);
  return <div className={`pen-style-controls${compact ? ' compact' : ''}`}>
    <label>{ui("스타일")}<select aria-label={ui("드로잉 스타일")} value={brush} onChange={event => onBrushChange(event.target.value)}>{PEN_STYLES.map(style => <option key={style.id} value={style.id}>{ui(style.label)}</option>)}</select></label>
    <label>{"" + ui("투명도") + " "}<span>{transparency}%</span><input aria-label={ui("드로잉 투명도")} type="range" min="0" max="100" step="1" value={transparency} onChange={event => onOpacityChange(1 - Number(event.target.value) / 100)} /></label>
    {!compact && <small>{ui(PEN_STYLES.find(style => style.id === brush)?.description)}{" " + ui("· 새로 그리는 선에 적용됩니다.") + ""}{brush === 'highlighter' && ui(" 형광펜은 기본적으로 반투명합니다.")}</small>}
  </div>;
}
