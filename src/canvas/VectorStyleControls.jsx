import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import './vector-style-controls.css';
export default function VectorStyleControls({ value = 'standard', onChange }) {
  useUiLocale();
  return <div className="vector-style-options" role="group" aria-label={ui("그림 스타일")}>
    {[['standard', '기본'], ['sketch', '손그림']].map(([style, label]) => <button key={style} type="button" className={value === style ? 'selected' : ''} aria-pressed={value === style} onClick={() => onChange(style)}>
      <svg viewBox="0 0 48 24" aria-hidden="true"><path d={style === 'sketch' ? 'M4 18 Q8 3 13 6 Q24 3 40 5 L42 18 Q22 21 4 18 M5 17 L13 5 L41 6 L40 19' : 'M4 18 L13 5 H41 V18 Z'} /></svg><span>{ui(label)}</span>
    </button>)}
  </div>;
}
