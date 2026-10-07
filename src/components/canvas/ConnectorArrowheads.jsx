export default function ConnectorArrowheads({ geometry, offsetX = 0, offsetY = 0 }) {
  return <g className="connector-arrowheads" transform={`translate(${-offsetX} ${-offsetY})`}>
    {geometry?.heads?.map((head, index) => <g key={index}>
      {head.parts.map((part, partIndex) => {
        const style = { fill: part.filled ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: head.strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', pointerEvents: 'none' };
        if (part.center) return <circle key={partIndex} cx={part.center.x} cy={part.center.y} r={part.radius} style={style} />;
        const path = part.points.map((point, pointIndex) => `${pointIndex ? 'L' : 'M'}${point.x} ${point.y}`).join(' ');
        return <path key={partIndex} d={`${path}${part.closed ? ' Z' : ''}`} style={style} />;
      })}
    </g>)}
  </g>;
}
