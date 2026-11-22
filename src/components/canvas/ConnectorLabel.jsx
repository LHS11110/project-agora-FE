import RenderedContent from '../../canvas/content/RenderedContent.jsx';
import { readObjectStyle } from '../../canvas/styling/objectStyleModel.js';
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
  const style = readObjectStyle(item);
  const ls = style.connector?.labelStyle || {};
  const typo = style.typography?.explicit ? style.typography : null;
  const labelColor = ls.color || typo?.textColor;
  const labelCss = {
    left: point.x - offsetX,
    top: point.y - offsetY,
    ...(ls.background ? { background: ls.background } : {}),
    ...(labelColor ? { color: labelColor } : {}),
    ...(ls.borderColor ? { borderColor: ls.borderColor } : {}),
    ...(ls.pill === false ? { borderRadius: '4px' } : { borderRadius: '999px' }),
    ...(typo?.fontFamily ? { fontFamily: typo.fontFamily } : {}),
    ...(typo && typo.fontWeight !== 400 ? { fontWeight: typo.fontWeight } : {}),
    ...(typo?.letterSpacing ? { letterSpacing: `${typo.letterSpacing}px` } : {}),
    ...(typo ? { lineHeight: typo.lineHeight, textAlign: typo.textAlign } : {}),
  };
  return <div className="connector-name-label" style={labelCss}><RenderedContent value={item.label} mode={item.labelMode || 'markdown'} /></div>;
}
