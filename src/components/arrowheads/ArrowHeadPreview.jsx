import { arrowPathGeometry } from '../arrowheadGeometry.js';
import { vectorStrokePaths } from '../../canvas/vectorStyle.js';
import ConnectorArrowheads from '../canvas/ConnectorArrowheads.jsx';
export default function ArrowHeadPreview({ type, start = false, visualStyle = 'standard' }) {
  const geometry = arrowPathGeometry([{ x: 4, y: 10 }, { x: 48, y: 10 }], { startHead: start ? type : 'none', endHead: start ? 'none' : type, headSize: 12, strokeWidth: 1.5 });
  const seed = `preview:${type}:${start}`;
  return <svg className="arrow-head-preview" viewBox="0 0 54 20" aria-hidden="true">
    {vectorStrokePaths(geometry.points, visualStyle, seed).map((stroke, index) => <polyline key={index} points={stroke.points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={1.5 * stroke.widthScale} strokeOpacity={stroke.alpha} strokeLinecap="round" />)}
    <ConnectorArrowheads geometry={geometry} visualStyle={visualStyle} seed={seed} />
  </svg>;
}
