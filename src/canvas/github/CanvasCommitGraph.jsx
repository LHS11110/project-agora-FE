import {useMemo} from 'react';
import {intlLocale,ui} from '../../i18n/locale.js';
import {useUiLocale} from '../../i18n/useUiLocale.js';
import {commitGraph} from './commitGraph.js';
const GAP=22,PADDING=14;
const colors=['#168dcc','#be35ba','#25a559','#d89a25','#8957da','#e46864'];
export default function CanvasCommitGraph({entries,refs=[],branch,busy,canRestore,onRestore,onInspect}){
 const locale=useUiLocale();
 const graph=useMemo(()=>commitGraph(entries,{refs,branch,includeBands:false}),[entries,refs,branch]);
 const labels=useMemo(()=>{const map=new Map();for(const ref of refs){if(!map.has(ref.sha))map.set(ref.sha,[]);map.get(ref.sha).push(ref);}return map;},[refs]);
 const width=PADDING*2+Math.max(0,graph.width-1)*GAP;
 return <div className="canvas-git-history">
  <ol className="canvas-commit-graph canvas-git-graph" aria-label={ui('Git 커밋 그래프')} style={{'--graph-width':`${width}px`}}>
   {graph.rows.map(({entry,lane,segments},index)=>{
    const color=colors[lane%colors.length],head=labels.get(entry.sha)||[];
    return <li key={entry.sha} className="canvas-git-row canvas-commit-entry" data-history-row={index} data-commit={entry.sha} data-lane={lane}>
     <div className="canvas-git-lanes" aria-hidden="true">
      <svg viewBox={`0 0 ${width} 100`} preserveAspectRatio="none">{segments.map((s,i)=>{
       const a=PADDING+s.from*GAP,b=PADDING+s.to*GAP,middle=(s.start+s.end)/2;
       return <path key={i} d={s.from===s.to?`M ${a} ${s.start} L ${b} ${s.end}`:`M ${a} ${s.start} C ${a} ${middle}, ${b} ${middle}, ${b} ${s.end}`} fill="none" stroke={colors[(s.start===50?s.to:s.from)%colors.length]} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeDasharray={s.dashed?'3 4':undefined}/>;
      })}</svg>
      <span className={`canvas-commit-node${entry.parents.length>1?' is-merge':''}${head.some(r=>r.name===branch)?' is-head':''}`} style={{left:PADDING+lane*GAP,'--commit-color':color}}/>
     </div>
     <div className="canvas-git-content">
      <div className="canvas-git-message"><div className="canvas-commit-refs">{head.map(r=><span key={r.name} className={r.name===branch?'is-current':''} style={{'--commit-color':color}}><svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4v8M4 9c6 0 8-1 8-5"/><circle cx="4" cy="3" r="2"/><circle cx="4" cy="13" r="2"/><circle cx="12" cy="3" r="2"/></svg>{r.name===branch?'HEAD · ':''}{r.name}</span>)}</div><strong title={entry.message}>{entry.message.split('\n')[0]}</strong></div>
      <small className="canvas-commit-meta"><code>{entry.sha.slice(0,7)}</code><span title={entry.author}>{entry.author}</span>{entry.date&&<time dateTime={entry.date} title={new Date(entry.date).toLocaleString(intlLocale(locale))}>{new Date(entry.date).toLocaleString(intlLocale(locale),{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}</time>}{entry.parents.length>1&&<span title={ui('병합 커밋')}>{ui('병합 커밋')}</span>}</small>
     </div>
     <div className="canvas-git-actions"><button aria-label={ui('이 커밋으로 캔버스 복구')} title={ui('이 커밋으로 캔버스 복구')} disabled={busy||!canRestore} onClick={()=>onRestore(entry)}>{ui('복구')}</button><button aria-label={ui('코드로 검토')} title={ui('코드로 검토')} disabled={busy} onClick={()=>onInspect(entry)}>{ui('코드')}</button></div>
    </li>;
   })}
  </ol>
 </div>;
}
