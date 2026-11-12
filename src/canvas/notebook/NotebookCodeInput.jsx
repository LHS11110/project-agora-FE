import {useEffect,useState} from 'react';
import CanvasCodeEditor from '../CanvasCodeEditor.jsx';
import {ui} from '../../i18n/locale.js';

// Mount a language editor only in the active cell; other cells stay inexpensive.
export default function NotebookCodeInput({cell,index,editable,onChange,onRun,factor=1,active,onActivate,onDeactivate}){
 const [localEditing,setLocalEditing]=useState(false);
 const editing=active===undefined?localEditing:active;
 const setEditing=value=>active===undefined?setLocalEditing(value):value?onActivate?.():onDeactivate?.();
 useEffect(()=>{if(!editable)setEditing(false);},[editable]);
 const height=Math.min(340,Math.max(100,(cell.source||'').split('\n').length*20+28))*factor;
 return <div className="notebook-code-input" style={{height,fontSize:13*factor,lineHeight:`${20*factor}px`}}>
  {editing&&editable?<CanvasCodeEditor inline notebook value={cell.source||''} language="python" onChange={onChange} onRun={onRun} onStopEditing={()=>setEditing(false)}/>:<textarea data-cell-id={cell.id} aria-label={`${ui('노트북 셀')} ${index}`} spellCheck={false} readOnly={!editable} value={cell.source||''} onFocus={()=>{if(editable)setEditing(true);}} onChange={event=>onChange(event.target.value)}/>}
 </div>;
}
