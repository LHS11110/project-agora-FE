import {useEffect,useId,useState} from 'react';
import CanvasSelect from '../content/CanvasSelect.jsx';
import CanvasCodeEditor from '../CanvasCodeEditor.jsx';
import {ui} from '../../i18n/locale.js';
import {useUiLocale} from '../../i18n/useUiLocale.js';

// Mount a language editor only in the active cell; other cells stay inexpensive.
export default function NotebookCodeInput({cell,index,editable,onChange,onRun,factor=1,active,onActivate,onDeactivate}){
 useUiLocale();
 const fieldId=useId();
 const [localEditing,setLocalEditing]=useState(false);
 const editing=active===undefined?localEditing:active;
 const setEditing=value=>active===undefined?setLocalEditing(value):value?onActivate?.():onDeactivate?.();
 useEffect(()=>{if(!editable)setEditing(false);},[editable]);
 const proof=cell.source?.startsWith('%%lean4')?'lean4':cell.source?.startsWith('%%rocq')?'rocq':'python';
 const height=Math.min(340,Math.max(100,(cell.source||'').split('\n').length*20+28))*factor;
 return <div className="notebook-code-input" style={{height,fontSize:13*factor,lineHeight:`${20*factor}px`}}>
  <CanvasSelect name="notebook-cell-language" aria-label={ui('셀 언어')} disabled={!editable} value={proof} onChange={e=>{const body=proof==='python'?cell.source:cell.source.split('\n').slice(1).join('\n');onChange(e.target.value==='python'?body:`%%${e.target.value} ${cell.id}\n${body}`);}}><option value="python">Python</option><option value="lean4">Lean 4</option><option value="rocq">Rocq</option></CanvasSelect>
  {!editable ? <pre className="notebook-code-preview" aria-label={`${ui('노트북 셀')} ${index}`}>{cell.source || ''}</pre>
    : editing ? <CanvasCodeEditor inline notebook value={cell.source||''} language={proof==='python'?'python':'plaintext'} onChange={onChange} onRun={onRun} onStopEditing={()=>setEditing(false)}/>:<textarea id={`${fieldId}-code`} name="notebook-code-input" data-cell-id={cell.id} aria-label={`${ui('노트북 셀')} ${index}`} spellCheck={false} value={cell.source||''} onFocus={()=>{if(editable)setEditing(true);}} onChange={event=>onChange(event.target.value)}/>}
 </div>;
}
