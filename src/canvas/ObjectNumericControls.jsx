import { SizeInput } from './ObjectSizeControls.jsx';
import { numericObjectGeometry } from './objectNumericGeometry.js';
import { hasIndependentContentSize } from './objectSize.js';
const rounded = value => Math.round(value * 100) / 100;
export default function ObjectNumericControls({ item, onChange, onRotationChange }) {
  const geometry = numericObjectGeometry(item);
  return <section className="inspector-section object-size-controls">
    <strong className="inspector-label">위치 및 수치 설정</strong>
    {geometry && <>
      {['x', 'y'].map(field => <SizeInput key={field} label={`${field.toUpperCase()} 위치`} value={rounded(geometry[field])} min={-1e9} max={1e9} step={.1} onCommit={value => onChange(field, value)} />)}
      {!hasIndependentContentSize(item) && ['width', 'height'].map(field => <SizeInput key={field} label={field === 'width' ? '너비' : '높이'} value={rounded(geometry[field])} min={1} max={1e6} step={.1} onCommit={value => onChange(field, value)} />)}
    </>}
    <SizeInput label={item.kind === 'connector' ? '곡선 방향' : '회전'} value={rounded(Number(item.rotation) || 0)} min={-180} max={180} unit="°" step={.1} onCommit={onRotationChange} />
    {item.kind === 'stroke' && <>
      <SizeInput label="선 굵기" value={Number(item.strokeWidth) || 3} min={1} max={64} step={.1} onCommit={value => onChange('strokeWidth', value)} />
      <SizeInput label="불투명도" value={rounded((item.opacity ?? 1) * 100)} min={0} max={100} unit="%" onCommit={value => onChange('opacity', value)} />
    </>}
  </section>;
}
