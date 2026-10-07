import './connector-selection-effect.css';

/** A brief selection cue above the ink; never participates in pointer hit testing. */
export default function ConnectorSelectionEffect({ geometry, offsetX, offsetY, width, height, color, strokeWidth }) {
  if (!geometry?.points?.length) return null;
  const path = geometry.points.map((point, index) => `${index ? 'L' : 'M'}${point.x - offsetX} ${point.y - offsetY}`).join(' ');
  return <svg className="connector-selection-effect" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false" style={{ color: color || '#617d68' }}>
    <path className="connector-selection-flow" d={path} pathLength="1" style={{ strokeWidth: Math.max(2.5, (Number(strokeWidth) || 1.5) + 1.5) }} />
    {[geometry.start, geometry.end].filter(Boolean).map((point, index) => <circle key={index} className="connector-selection-ring" cx={point.x - offsetX} cy={point.y - offsetY} r="6" style={{ animationDelay: `${index * 90}ms` }} />)}
  </svg>;
}
