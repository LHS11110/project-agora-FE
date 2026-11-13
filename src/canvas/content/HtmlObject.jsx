import {useDeferredValue} from 'react';
import CanvasCodeEditor from '../CanvasCodeEditor.jsx';
import {ui} from '../../i18n/locale.js';
import './html-object.css';
export {htmlPreviewDocument} from './htmlPreviewDocument.js';
import {htmlPreviewDocument} from './htmlPreviewDocument.js';
import {useWebAssets} from './WebAssetsContext.js';
export default function HtmlObject({id,value,editing,onChange,onUndo,onSave,onStopEditing,onStartEditing}){
 const assets=useWebAssets(id);
 const preview=useDeferredValue(htmlPreviewDocument(value,assets));
 return <div className={`html-object-content${editing?' is-editing':''}`} data-object-action onPointerDown={event=>{if(editing||event.target.closest('button'))event.stopPropagation();}}  onWheel={event=>event.stopPropagation()}>
  <header><strong>HTML</strong><span>{ui('미리보기')} · CSS {assets.css.length} · JS {assets.js.length}</span><button disabled={!editing&&!onStartEditing} type="button" onClick={()=>editing?onStopEditing():onStartEditing?.()}>{editing?ui('완료'):ui('코드 편집')}</button></header>
  {editing&&<div className="html-object-editor"><CanvasCodeEditor inline value={value} language="html" onChange={onChange} onUndo={onUndo} onSave={onSave} onStopEditing={onStopEditing}/></div>}
  <iframe title={ui('HTML 미리보기')} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={preview}/>
 </div>;
}
