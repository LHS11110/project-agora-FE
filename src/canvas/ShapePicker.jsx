import { shapeCatalog } from './shapeCatalog.js';
import { shapeOutlinePaths } from './shapeGeometry.js';
import './shape-picker.css';

function previewPaths(shape) {
  const width = Math.min(40, 32 * shape.aspect);
  const height = width / shape.aspect;
  return shapeOutlinePaths(shape.id, width, height).map(path => path.map(point => ({
    x: point.x + (40 - width) / 2, y: point.y + (32 - height) / 2,
  })));
}

export default function ShapePicker({ value, onChange, compact = false }) {
  if (compact) return <select className="shape-select" aria-label="도형 종류" value={value} onChange={event => onChange(event.target.value)}>{shapeCatalog.map(shape => <option key={shape.id} value={shape.id}>{shape.label}</option>)}</select>;
  return <div className="shape-picker" role="group" aria-label="도형 종류">
    {shapeCatalog.map(shape => <button type="button" key={shape.id} className={value === shape.id ? 'selected' : ''} aria-pressed={value === shape.id} title={shape.label} onClick={() => onChange(shape.id)}>
      <svg viewBox="-3 -3 46 38" aria-hidden="true">{previewPaths(shape).map((path, index) => <polyline key={index} points={path.map(p => `${p.x},${p.y}`).join(' ')} />)}</svg><span>{shape.label}</span>
    </button>)}
  </div>;
}
