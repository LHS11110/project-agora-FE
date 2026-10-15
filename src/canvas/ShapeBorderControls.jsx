import { SizeInput } from './ObjectSizeControls.jsx';
import { shapeStrokeWidth, MIN_SHAPE_STROKE_WIDTH, MAX_SHAPE_STROKE_WIDTH } from './shapeAppearance.js';
import CanvasColorPicker from './CanvasColorPicker.jsx';
export default function ShapeBorderControls({ enabled = true, color, width, onWidthChange, onEnabledChange, onColorChange, favoriteColors, onSaveFavorite }) {
  return <section className="inspector-section">
    <div className="inspector-switch-row"><span><strong>도형 테두리</strong><small>{enabled ? '테두리 색상과 굵기를 지정합니다.' : '투명 · 테두리 없음'}</small></span><button type="button" className={`toggle-switch${enabled ? ' on' : ''}`} role="switch" aria-label="도형 테두리" aria-checked={enabled} onClick={() => onEnabledChange(!enabled)}><i /></button></div>
    {enabled && <><CanvasColorPicker color={color} onChange={onColorChange} favoriteColors={favoriteColors} onSaveFavorite={onSaveFavorite} label="도형 테두리 색상" /><div className="object-size-controls"><SizeInput label="도형 테두리 굵기" value={shapeStrokeWidth({ strokeWidth: width })} min={MIN_SHAPE_STROKE_WIDTH} max={MAX_SHAPE_STROKE_WIDTH} step={.5} onCommit={onWidthChange} /></div></>}
  </section>;
}
