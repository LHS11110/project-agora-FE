import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { SizeInput } from './ObjectSizeControls.jsx';
import { numericObjectGeometry } from './objectNumericGeometry.js';
import { hasIndependentContentSize } from './objectSize.js';
const rounded = value => Math.round(value * 100) / 100;
export default function ObjectNumericControls({ item, onChange, onRotationChange }) {
  useUiLocale();
  const geometry = numericObjectGeometry(item);
  return <section className="inspector-section object-size-controls">
    <strong className="inspector-label">{ui("위치 및 수치 설정")}</strong>
    {geometry && <>
      {['x', 'y'].map(field => <SizeInput key={field} label={ui("{v0} 위치", {
  v0: field.toUpperCase()
})} value={rounded(geometry[field])} min={-1e9} max={1e9} step={.1} onCommit={value => onChange(field, value)} />)}
      {!hasIndependentContentSize(item) && ['width', 'height'].map(field => <SizeInput key={field} label={field === 'width' ? ui("너비") : ui("높이")} value={rounded(geometry[field])} min={1} max={1e6} step={.1} onCommit={value => onChange(field, value)} />)}
    </>}
    <SizeInput label={item.kind === 'connector' ? ui("곡선 방향") : ui("회전")} value={rounded(Number(item.rotation) || 0)} min={-180} max={180} unit="°" step={.1} onCommit={onRotationChange} />
    {item.kind === 'stroke' && <>
      <SizeInput label={ui("선 굵기")} value={Number(item.strokeWidth) || 3} min={1} max={64} step={.1} onCommit={value => onChange('strokeWidth', value)} />
      <SizeInput label={ui("불투명도")} value={rounded((item.opacity ?? 1) * 100)} min={0} max={100} unit="%" onCommit={value => onChange('opacity', value)} />
    </>}
  </section>;
}
