import { shapeFillOpacity, sketchFillOpacity } from './shapeAppearance.js';
import { SizeInput } from './ObjectSizeControls.jsx';
import CanvasColorPicker from './CanvasColorPicker.jsx';

export default function ShapeFillControls({ value, onChange, opacity = 1, visualStyle, onOpacityChange, inkOpacity, onInkOpacityChange, favoriteColors, onSaveFavorite }) {
  const enabled = /^#[0-9a-f]{6}$/i.test(value || '');
  const transparency = Math.round((1 - shapeFillOpacity({ fillOpacity: opacity })) * 100);
  const inkPercent = Math.round(sketchFillOpacity({ sketchFillOpacity: inkOpacity }) * 100);
  return <section className="inspector-section">
    <div className="inspector-switch-row"><span><strong>도형 내부 채우기</strong><small>{enabled ? '테두리와 별도로 색상을 지정합니다.' : '투명 · 채우기 없음'}</small></span><button type="button" className={`toggle-switch${enabled ? ' on' : ''}`} role="switch" aria-label="도형 내부 채우기" aria-checked={enabled} onClick={() => onChange(enabled ? '' : '#d8e8dc')}><i /></button></div>
    {enabled && <><CanvasColorPicker color={value} onChange={onChange} favoriteColors={favoriteColors} onSaveFavorite={onSaveFavorite} label="도형 내부 색상" />
      <div className="object-size-controls"><SizeInput label="채우기 투명도" value={transparency} min={0} max={100} unit="%" onCommit={value => onOpacityChange?.(1 - value / 100)} /></div>
      <input type="range" aria-label="채우기 투명도 조절" min="0" max="100" step="1" value={transparency} onChange={event => onOpacityChange?.(1 - Number(event.target.value) / 100)} />
      {visualStyle === 'sketch' && <>
        <div className="object-size-controls"><SizeInput label="빗금 진하기" value={inkPercent} min={0} max={100} unit="%" onCommit={value => onInkOpacityChange?.(value / 100)} /></div>
        <input type="range" aria-label="빗금 진하기 조절" min="0" max="100" step="1" value={inkPercent} onChange={event => onInkOpacityChange?.(Number(event.target.value) / 100)} />
      </>}
      <small className="inspector-hint">{visualStyle === 'sketch' ? '투명도를 높이면 빗금 간격이 넓어집니다. 100%는 채우기 없음입니다. 빗금 진하기를 높이면 선이 더 불투명해집니다.' : '0%는 불투명, 100%는 완전히 투명합니다.'}</small>
    </>}
  </section>;
}
