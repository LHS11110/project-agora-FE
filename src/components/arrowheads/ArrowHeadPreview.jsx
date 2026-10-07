import { arrowPathGeometry } from '../arrowheadGeometry.js';
import ConnectorArrowheads from '../canvas/ConnectorArrowheads.jsx';
export default function ArrowHeadPreview({ type, start = false }) {
  const geometry = arrowPathGeometry([{ x: 4, y: 10 }, { x: 48, y: 10 }], { startHead: start ? type : 'none', endHead: start ? 'none' : type, headSize: 12, strokeWidth: 1.5 });
  return <svg className="arrow-head-preview" viewBox="0 0 54 20" aria-hidden="true"><polyline points={geometry.points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><ConnectorArrowheads geometry={geometry} /></svg>;
}
