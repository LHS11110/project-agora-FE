import CanvasColorPicker from './CanvasColorPicker.jsx';

export default function ShapeFillControls({ value, onChange, favoriteColors, onSaveFavorite }) {
  const enabled = /^#[0-9a-f]{6}$/i.test(value || '');
  return <section className="inspector-section">
    <div className="inspector-switch-row"><span><strong>도형 내부 채우기</strong><small>테두리와 별도로 색상을 지정합니다.</small></span><button type="button" className={`toggle-switch${enabled ? ' on' : ''}`} role="switch" aria-label="도형 내부 채우기" aria-checked={enabled} onClick={() => onChange(enabled ? '' : '#d8e8dc')}><i /></button></div>
    {enabled && <CanvasColorPicker color={value} onChange={onChange} favoriteColors={favoriteColors} onSaveFavorite={onSaveFavorite} label="도형 내부 색상" />}
  </section>;
}
