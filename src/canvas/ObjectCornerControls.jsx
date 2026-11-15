import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { objectCornerStyle } from './objectCorners.js';
export default function ObjectCornerControls({ item, value, count = 1, onChange }) {
  useUiLocale();
  const current = value ?? objectCornerStyle(item);
  return <section className="inspector-section object-corner-controls">
    <strong className="inspector-label">{ui('객체 모서리')}</strong>
    <div className="theme-switch" role="group" aria-label={ui('객체 모서리 형태')}>
      {[['sharp', '각지게'], ['rounded', '둥글게']].map(([option, label]) => <button type="button" key={option} className={current === option ? 'active' : ''} aria-pressed={current === option} onClick={() => onChange(option)}>{ui(label)}</button>)}
    </div>
    {(count > 1 || current === 'mixed') && <small className="inspector-hint">{ui('이미지·테두리 도형 등 선택한 객체의 모서리를 한 번에 맞춥니다.')}</small>}
  </section>;
}
