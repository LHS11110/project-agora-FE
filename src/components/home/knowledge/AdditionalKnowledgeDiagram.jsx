const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };

export default function AdditionalKnowledgeDiagram({ kind }) {
  if (kind === 'distribution') {
    const points = Array.from({ length: 81 }, (_, i) => `${10 + i * 2},${84 - Math.exp(-(((i - 40) / 14) ** 2) / 2) * 66}`).join(' ');
    return <><path d="M10 12v72h160" {...line} opacity=".3" /><polygon points={`10,84 ${points} 170,84`} fill="currentColor" opacity=".1" /><polyline className="knowledge-trace" points={points} {...line} /><path d="M90 18v66" {...line} strokeDasharray="3 4" opacity=".4" /><text x="90" y="99" textAnchor="middle">μ</text></>;
  }
  if (kind === 'helix') {
    const strand = phase => Array.from({ length: 65 }, (_, i) => `${18 + i * 2.25},${50 + Math.sin(i / 64 * Math.PI * 4 + phase) * 28}`).join(' ');
    return <>{Array.from({ length: 13 }, (_, i) => {
      const x = 18 + i * 12, y = Math.sin(i / 12 * Math.PI * 4) * 28;
      return <path key={i} className="knowledge-link" style={{ '--knowledge-delay': `${i * .12}s` }} d={`M${x} ${50 - y}v${y * 2}`} {...line} opacity=".45" />;
    })}<polyline className="knowledge-trace" points={strand(0)} {...line} /><polyline points={strand(Math.PI)} {...line} opacity=".6" /><text x="90" y="99" textAnchor="middle">A · T / G · C</text></>;
  }
  if (kind === 'vector') return <><path d="M35 18v67h125" {...line} opacity=".3" /><path className="knowledge-trace" d="M35 85 139 27m-13 0h13v13" {...line} strokeWidth="2" /><path d="M35 85h104V27" {...line} strokeDasharray="3 4" opacity=".4" /><text x="85" y="99">x</text><text x="147" y="59">y</text><text x="79" y="46">v</text></>;
  if (kind === 'sets') return <><circle className="knowledge-node" cx="67" cy="50" r="31" fill="currentColor" fillOpacity=".09" {...line} /><circle className="knowledge-node" style={{ '--knowledge-delay': '.6s' }} cx="113" cy="50" r="31" fill="currentColor" fillOpacity=".09" {...line} /><text x="54" y="53">A</text><text x="119" y="53">B</text><text x="90" y="99" textAnchor="middle">SHARED IDEAS</text></>;
  if (kind === 'spiral') {
    const points = Array.from({ length: 160 }, (_, i) => {
      const angle = i / 159 * Math.PI * 5, radius = 2 + i / 159 * 42;
      return `${90 + Math.cos(angle) * radius * 1.5},${48 + Math.sin(angle) * radius}`;
    }).join(' ');
    return <><polyline className="knowledge-trace" points={points} {...line} /><circle cx="90" cy="48" r="3" fill="currentColor" /><text x="90" y="102" textAnchor="middle">GROWTH / θ</text></>;
  }
  return null;
}
