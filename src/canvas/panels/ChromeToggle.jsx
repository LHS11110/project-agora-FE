import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
export default function ChromeToggle({ label, collapsed, onToggle, controls }) {
  useUiLocale();
  const title=`${label} ${ui(collapsed?'펼치기':'접기')}`;
  return <button type="button" className="canvas-chrome-toggle" aria-label={title} title={title}
    aria-expanded={!collapsed} aria-controls={controls}
    onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();onToggle();}}>
    <span aria-hidden="true">{collapsed?'+':'−'}</span>
  </button>;
}
