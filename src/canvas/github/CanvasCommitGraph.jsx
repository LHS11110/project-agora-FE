import {useMemo} from 'react';
import {ui} from '../../i18n/locale.js';
import {commitGraph} from './commitGraph.js';
const colors=['#7c83f5','#38bdb0','#e6a154','#d680bd','#69a8e4','#91b85c'];
export default function CanvasCommitGraph({entries,refs,branch,busy,canRestore,onRestore,onInspect}){
 const graph=useMemo(()=>commitGraph(entries,{refs,branch}),[entries,refs,branch]);
 const width=graph.width*280;
 return <div className="canvas-parallel-history" style={{'--branch-columns':graph.width,'--branch-width':`${width}px`}}>
  <div className="canvas-parallel-headings" aria-label={ui('브랜치별 경로')}>{Array.from({length:graph.width},(_,lane)=><div key={lane} style={{color:colors[lane%colors.length]}}>{graph.columns[lane]?.names.join(' · ')||ui('병합 경로')}</div>)}</div>
  <ol className="canvas-commit-graph canvas-parallel-graph" aria-label={ui('Git 커밋 그래프')}>
   {graph.bands.map((band,index)=><li key={index} className="canvas-commit-band" data-history-row={index}>
    <svg className="canvas-band-lines" viewBox={`0 0 ${width} 100`} preserveAspectRatio="none" aria-hidden="true">{band.segments.map((s,i)=>{const a=18+s.from*280,b=18+s.to*280;return <path key={i} d={s.start===8&&s.from!==s.to?`M ${a} 8 C ${b} 8, ${b} 8, ${b} 18 L ${b} 100`:`M ${a} ${s.start} C ${a} ${(s.start+s.end)/2}, ${b} ${(s.start+s.end)/2}, ${b} ${s.end}`} fill="none" stroke={colors[(s.end===8?s.from:s.to)%colors.length]} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray={s.dashed?'4 4':undefined}/>;})}</svg>
    {band.commits.map(({entry,lane})=><div className="canvas-commit-entry" key={entry.sha} data-commit={entry.sha} data-lane={lane} style={{gridColumn:lane+1}}>
     <span aria-hidden="true" className={`canvas-commit-node${entry.parents.length>1?' is-merge':''}`} style={{borderColor:colors[lane%colors.length]}}/>
     <div className="canvas-commit-content">
      <div className="canvas-commit-refs">{refs.filter(r=>r.sha===entry.sha).map(r=><span key={r.name} className={r.name===branch?'is-current':''}>{r.name===branch?'HEAD · ':''}{r.name}</span>)}</div>
      <strong title={entry.message}>{entry.message.split('\n')[0]}</strong>
      <small><code>{entry.sha.slice(0,7)}</code> · {entry.author}</small><small>{entry.date?new Date(entry.date).toLocaleString():''}</small>
      {entry.parents.length>1&&<small>{ui('병합 커밋')} · {entry.parents.length}</small>}
      <div className="canvas-github-actions"><button disabled={busy||!canRestore} onClick={()=>onRestore(entry)}>{ui('이 커밋으로 캔버스 복구')}</button><button disabled={busy} onClick={()=>onInspect(entry)}>{ui('코드로 검토')}</button></div>
     </div>
    </div>)}
   </li>)}
  </ol>
 </div>;
}
