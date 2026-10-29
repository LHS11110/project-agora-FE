import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { objectCornerStyle } from './objectCorners.js';
export default function ObjectCornerControls({ item, onChange }) {
  useUiLocale();
  const current = objectCornerStyle(item);
  return <section className="inspector-section object-corner-controls">
    <strong className="inspector-label">{ui('객체 모서리')}</strong>
    <div className="theme-switch" role="group" aria-label={ui('객체 모서리 형태')}>
      {[['sharp', '각지게'], ['rounded', '둥글게']].map(([value, label]) => <button type="button" key={value} className={current === value ? 'active' : ''} aria-pressed={current === value} onClick={() => onChange(value)}>{ui(label)}</button>)}
    </div>
  </section>;
}
