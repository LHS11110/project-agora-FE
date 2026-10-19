import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { MIN_ERASER_WIDTH, MAX_ERASER_WIDTH } from './canvasConstants.js';
import './eraser-size-control.css';

export default function EraserSizeControl({ value, onChange, compact = false }) {
  useUiLocale();
  return <label className={`eraser-size-control${compact ? ' compact' : ''}`}>
    <span>{"" + ui("지우개 굵기") + " "}<strong>{value}px</strong></span>
    <input type="range" min={MIN_ERASER_WIDTH} max={MAX_ERASER_WIDTH} step="1" value={value} onChange={event => onChange(event.target.value)} aria-label={ui("지우개 굵기")} aria-valuetext={ui("{v0}픽셀", {
  v0: value
})} />
    <small>{ui("커서 원의 지름입니다. 확대·축소해도 화면에서 같은 크기를 유지합니다.")}</small>
  </label>;
}
