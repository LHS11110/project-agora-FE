import { SizeInput } from './ObjectSizeControls.jsx';
import { hasPolygonVertices, hasShapeCorners, polygonVertexCount, MAX_POLYGON_VERTICES } from './shapeAppearance.js';

export default function ShapeGeometryControls({ item, onChange }) {
  if (!hasShapeCorners(item.shapeType)) return null;
  return <section className="inspector-section">
    <strong className="inspector-label">꼭짓점과 모서리</strong>
    {hasPolygonVertices(item.shapeType) && <div className="object-size-controls"><SizeInput label={item.shapeType === 'star' ? '별 꼭짓점 수' : '꼭짓점 수'} value={polygonVertexCount(item)} min={3} max={MAX_POLYGON_VERTICES} unit="개" onCommit={value => { if (Number.isInteger(value)) onChange('vertexCount', value); }} /></div>}
    <div className="theme-switch" role="group" aria-label="도형 모서리 형태">
      {[['sharp', '각지게'], ['rounded', '둥글게']].map(([value, label]) => <button key={value} type="button" className={(item.cornerStyle || 'sharp') === value ? 'active' : ''} aria-pressed={(item.cornerStyle || 'sharp') === value} onClick={() => onChange('cornerStyle', value)}>{label}</button>)}
    </div>
  </section>;
}
