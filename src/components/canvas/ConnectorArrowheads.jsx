export default function ConnectorArrowheads({ geometry, offsetX, offsetY, strokeWidth }) {
  return <g className="connector-arrowheads" transform={`translate(${-offsetX} ${-offsetY})`}>
    {geometry?.heads?.map((head, index) => {
      const style = {
        fill: head.filled || head.type === 'circle' ? 'currentColor' : 'none',
        stroke: 'currentColor', strokeWidth, pointerEvents: 'none',
      };
      if (head.type === 'circle') return <circle key={index} cx={head.center.x} cy={head.center.y} r={head.radius} style={style} />;
      const path = head.points.map((point, pointIndex) => `${pointIndex ? 'L' : 'M'}${point.x} ${point.y}`).join(' ');
      return <path key={index} d={`${path}${head.filled ? ' Z' : ''}`} style={style} />;
    })}
  </g>;
}
