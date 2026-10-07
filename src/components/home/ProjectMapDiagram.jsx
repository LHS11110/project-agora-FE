import { PROJECT_MAP_NODES, PROJECT_MAP_EDGES } from '../../home/projectMapData.js';

export default function ProjectMapDiagram() {
  return <div className="vector-showcase">
    <div className="vector-showcase-label">PROJECT STRUCTURE / 01</div>
    <svg viewBox="0 0 700 440" role="img" aria-label="가입 흐름 개선 목표에서 조사, 개발, 출시 단계와 실행 과제로 분기하는 프로젝트 트리">
      <defs><marker id="home-project-arrow" viewBox="0 0 10 10" markerWidth="10" markerHeight="10" refX="1" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1L9 5L1 9Z" fill="#82988a" /></marker></defs>
      {PROJECT_MAP_EDGES.map(([d, level], index) => <g key={d}>
        <path data-diagram-edge data-level={level} d={d} fill="none" stroke={level ? '#a0b2a6' : '#82988a'} strokeWidth={level ? 2 : 2.5} strokeLinecap="round" markerEnd="url(#home-project-arrow)" />
        <circle data-diagram-packet={index} r="4" fill={level ? '#9c86c5' : '#bf9564'} stroke="#fff" strokeWidth="1.5" opacity="0" aria-hidden="true" />
      </g>)}
      {PROJECT_MAP_NODES.map((node, index) => <g key={`${node.x}-${node.y}`} className="diagram-node project-map-node" data-diagram-node data-level={node.level} style={{ '--diagram-delay': `${node.level * 1.6 + index % 3 * .12}s` }}>
        <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={node.kind === 'root' ? 15 : node.kind === 'group' ? 13 : 10} fill={node.fill} stroke={node.stroke} strokeWidth="2" />
        {node.kind === 'root' && <path d="M169 176h18v18" fill="#e9ddc1" stroke="#e5d8b9" strokeWidth="2" strokeLinejoin="round" />}
        {node.lines.map((text, line) => {
          const offsets = node.kind === 'root' ? [24, 48, 70] : node.kind === 'group' ? [20, 43, 60] : [20, 42];
          const suffix = node.kind === 'root' ? ['label', 'title', 'metric'][line] : node.kind === 'group' ? ['label', 'title', 'note'][line] : ['index', 'title'][line];
          return <text key={text} className={`map-${node.kind}-${suffix}`} x={node.x + (node.kind === 'group' ? 16 : 15)} y={node.y + offsets[line]}>{text}</text>;
        })}
      </g>)}
    </svg>
    <span className="vector-showcase-caption">목표 → 단계 → 실행 과제가 이어지는 프로젝트 맵.</span>
  </div>;
}
