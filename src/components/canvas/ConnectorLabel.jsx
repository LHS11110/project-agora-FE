import RenderedContent from '../../canvas/content/RenderedContent.jsx';
import './connector-label.css';
function midpoint(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  let remaining = total / 2;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length && remaining <= length) return { x: a.x + (b.x - a.x) * remaining / length, y: a.y + (b.y - a.y) * remaining / length };
    remaining -= length;
  }
  return points[0];
}
export default function ConnectorLabel({ item, geometry, offsetX, offsetY }) {
  if (!item.label || !geometry?.curvePoints?.length) return null;
  const point = midpoint(geometry.curvePoints);
  return <div className="connector-name-label" style={{ left: point.x - offsetX, top: point.y - offsetY }}><RenderedContent value={item.label} mode={item.labelMode || 'markdown'} /></div>;
}
