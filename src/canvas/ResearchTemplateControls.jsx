import {useState} from 'react';
import {researchTemplates} from './researchTemplates.js';
export default function ResearchTemplateControls({onInsert}){
 const [template,setTemplate]=useState(researchTemplates[0].id);
 return <div className="research-template-controls"><strong className="inspector-label">다이어그램·자료 구조 예시</strong><select aria-label="연구 다이어그램 예시" value={template} onChange={e=>setTemplate(e.target.value)}>{researchTemplates.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select><button type="button" onClick={()=>onInsert(template)}>예시 구조 삽입</button><small className="inspector-hint">화면 근처의 빈 공간에 삽입합니다. 각 노드와 연결선을 편집할 수 있습니다.</small></div>;
}
