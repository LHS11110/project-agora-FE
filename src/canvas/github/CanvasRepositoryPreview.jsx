import {useMemo} from 'react';
import {ui} from '../../i18n/locale.js';
import {splitCanvas} from './canvasRepository.js';
export default function CanvasRepositoryPreview({source,previous,previousSplit,path}){
 const changes=useMemo(()=>{const files=splitCanvas(source,path),old=previous?(previousSplit?splitCanvas(previous,path):{[path]:previous}):{};return [...new Set([...Object.keys(files),...Object.keys(old)])].sort().map(name=>({name,source:files[name],state:!Object.hasOwn(files,name)?'삭제':!Object.hasOwn(old,name)?'추가':files[name]===old[name]?'변경 없음':'수정'}));},[source,previous,previousSplit,path]);
 return <details className="canvas-github-preview"><summary>{ui('분할 파일 변경 검토')} · {changes.filter(c=>c.state!=='변경 없음').length} {ui('변경 파일')}</summary><small>{ui('객체는 종류별로, 객체의 그룹 권한은 별도 파일로 저장합니다. 모든 변경 파일은 하나의 커밋으로 저장합니다.')}</small>{changes.map(change=><details key={change.name}><summary>{ui(change.state)} · {change.name} {change.source?`· ${new TextEncoder().encode(change.source).length.toLocaleString()} bytes`:''}</summary>{change.source&&<pre>{change.source}</pre>}</details>)}</details>;
}
