import { arrowheadStrokeParts } from '../../canvas/vectorStyle.js';
export default function ConnectorArrowheads({ geometry, offsetX = 0, offsetY = 0, visualStyle = 'standard', seed = '' }) {
  return <g className="connector-arrowheads" transform={`translate(${-offsetX} ${-offsetY})`}>
    {geometry?.heads?.map((head, index) => <g key={index}>
      {arrowheadStrokeParts(head, visualStyle, `${seed}:${index}`).flatMap((part, partIndex) => [
        ...part.hatches.map((hatch, line) => <path className="sketch-head-hatch" key={`${partIndex}:hatch:${line}`}
          d={`M${hatch.points[0].x} ${hatch.points[0].y} L${hatch.points[1].x} ${hatch.points[1].y}`}
          style={{ fill: 'none', stroke: 'currentColor', strokeWidth: Math.max(.7, head.strokeWidth * .45) * hatch.widthScale,
            strokeOpacity: hatch.alpha, strokeLinecap: 'round', pointerEvents: 'none' }} />),
        ...part.strokes.map((stroke, pass) => {
        const style = { fill: part.filled && pass === 0 && visualStyle !== 'sketch' ? 'currentColor' : 'none',
          stroke: 'currentColor', strokeWidth: head.strokeWidth * stroke.widthScale, strokeOpacity: stroke.alpha,
          strokeLinecap: 'round', strokeLinejoin: 'round', pointerEvents: 'none' };
        const key = `${partIndex}:${pass}`;
        if (part.center && visualStyle !== 'sketch') return <circle key={key} cx={part.center.x} cy={part.center.y} r={part.radius} style={style} />;
        const path = stroke.points.map((point, pointIndex) => `${pointIndex ? 'L' : 'M'}${point.x} ${point.y}`).join(' ');
        return <path key={key} d={`${path}${part.closed ? ' Z' : ''}`} style={style} />;
      })])}
    </g>)}
  </g>;
}
