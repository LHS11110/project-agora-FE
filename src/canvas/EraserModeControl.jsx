import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import './eraser-mode-control.css';

export default function EraserModeControl({ value, onChange, compact = false }) {
  useUiLocale();
  if (compact) return <label className="eraser-mode-control compact">
    {ui('지우기 방식')}
    <select aria-label={ui('지우기 방식')} value={value} onChange={event => onChange(event.target.value)}>
      <option value="partial">{ui('부분 지우기')}</option>
      <option value="stroke">{ui('선 전체 지우기')}</option>
    </select>
  </label>;
  return <div className="eraser-mode-control">
    <span>{ui('지우기 방식')}</span>
    <div role="group" aria-label={ui('지우기 방식')}>
      <button type="button" aria-pressed={value === 'partial'} onClick={() => onChange('partial')}>{ui('부분 지우기')}</button>
      <button type="button" aria-pressed={value === 'stroke'} onClick={() => onChange('stroke')}>{ui('선 전체 지우기')}</button>
    </div>
  </div>;
}
