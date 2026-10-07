const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
function Graph({ curve = false }) {
  const points = Array.from({ length: 65 }, (_, i) => {
    const x = i / 64;
    return `${12 + x * 156},${curve ? 78 - (x - .5) ** 2 * 240 : 48 - Math.sin(x * Math.PI * 4) * 25}`;
  }).join(' ');
  return <><path d={curve ? "M90 10v76M12 78h160" : "M12 12v72h160M12 48h160"} opacity=".3" {...line} /><polyline className="knowledge-trace" points={points} {...line} strokeWidth="2" /><text x="166" y="94">x</text><text x="3" y="13">y</text></>;
}
function Network({ tree = false }) {
  const nodes = tree ? [[90,14],[44,44],[136,44],[22,80],[65,80],[114,80],[158,80]] : [[32,20],[91,15],[148,29],[151,76],[88,81],[25,65],[87,48]];
  const edges = tree ? [[0,1],[0,2],[1,3],[1,4],[2,5],[2,6]] : [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,6],[1,6],[2,6],[3,6],[4,6],[5,6]];
  return <>{edges.map(([a,b], i) => <path key={i} className="knowledge-link" style={{ '--knowledge-delay': `${i * .15}s` }} d={`M${nodes[a].join(' ')}L${nodes[b].join(' ')}`} {...line} opacity=".55" />)}{nodes.map(([cx,cy],i) => <g key={i} className="knowledge-node" style={{ '--knowledge-delay': `${i * .25}s` }}><circle cx={cx} cy={cy} r={i === 0 ? 7 : 5} fill="currentColor" /><circle cx={cx} cy={cy} r={i === 0 ? 11 : 9} {...line} opacity=".3" /></g>)}</>;
}
export default function KnowledgeDiagram({ kind, title }) {
  let content;
  if (kind === 'wave' || kind === 'curve') content = <Graph curve={kind === 'curve'} />;
  else if (kind === 'network' || kind === 'tree') content = <Network tree={kind === 'tree'} />;
  else if (kind === 'blueprint') content = <>
    <path d="M15 10v80M40 10v80M65 10v80M90 10v80M115 10v80M140 10v80M165 10v80M10 20h160M10 45h160M10 70h160" opacity=".12" {...line} />
    <path className="knowledge-trace" d="M35 67V32l49-18 58 19v36l-52 19Zm0-35 55 20 52-19M90 52v36M84 14v35" {...line} strokeWidth="1.8" />
    <path d="M28 80v13m118-17v17M28 92h118m-118 0 4-3m114 3-4-3" {...line} opacity=".5" /><text x="70" y="99">120 mm</text>
  </>;
  else if (kind === 'pipeline') content = <>
    {[12,70,128].map((x,i) => <g key={x} className="knowledge-node" style={{ '--knowledge-delay': `${i*.7}s` }}><rect x={x} y="25" width="42" height="35" rx="5" {...line} /><text x={x+21} y="46" textAnchor="middle">{['IN','CPU','OUT'][i]}</text></g>)}
    <path className="knowledge-link" d="M54 42h16m-4-4 4 4-4 4M112 42h16m-4-4 4 4-4 4M33 61v19h116V61" {...line} /><text x="90" y="95" textAnchor="middle">FEEDBACK LOOP</text>
  </>;
  else if (kind === 'circuit') content = <>
    <path className="knowledge-trace" d="M28 33h32l5-8 8 16 8-16 8 16 8-16 8 16 5-8h40v44H28V57M20 43h16m-12 9h8" {...line} strokeWidth="1.7" />
    <text x="22" y="28">V</text><text x="85" y="16">R</text><path className="knowledge-link" d="M112 64h25m-5-4 5 4-5 4" {...line} /><text x="115" y="58">I</text>
  </>;
  else if (kind === 'mechanics') content = <>
    <path d="M12 83h154m-142 0-8 9m26-9-8 9m26-9-8 9m26-9-8 9m26-9-8 9m26-9-8 9m26-9-8 9" {...line} opacity=".4" />
    <rect x="46" y="44" width="50" height="33" rx="3" {...line} /><text x="71" y="65" textAnchor="middle">m</text>
    <path className="knowledge-link" d="M96 58h54m-8-6 8 6-8 6" {...line} strokeWidth="2" /><text x="117" y="46">F</text><path d="M50 29h44m-5-4 5 4-5 4" {...line} /><text x="68" y="22">a</text>
  </>;
  else if (kind === 'matrix') content = <>
    <path d="M30 17h-8v64h8m120-64h8v64h-8" {...line} strokeWidth="2" />
    {[[1,0,2],[0,1,3],[0,0,1]].flatMap((row,y) => row.map((v,x) => <text key={`${x}-${y}`} className="knowledge-matrix-value" style={{ '--knowledge-delay': `${(x+y)*.3}s` }} x={48+x*42} y={30+y*24} textAnchor="middle">{v}</text>))}
  </>;
  else content = <>
    <ellipse cx="90" cy="50" rx="62" ry="21" {...line} /><ellipse cx="90" cy="50" rx="62" ry="21" transform="rotate(60 90 50)" {...line} /><ellipse cx="90" cy="50" rx="62" ry="21" transform="rotate(-60 90 50)" {...line} />
    <circle cx="90" cy="50" r="6" fill="currentColor" /><circle className="knowledge-node" cx="143" cy="39" r="4" fill="currentColor" /><circle cx="63" cy="14" r="4" fill="currentColor" />
  </>;
  return <svg className={`knowledge-diagram knowledge-${kind}`} viewBox="0 0 180 104" role="img" aria-label={title}>{content}</svg>;
}
