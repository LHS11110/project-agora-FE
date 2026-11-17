import {useMemo,useRef,useEffect} from 'react';
import StaticMarkupPreview from './StaticMarkupPreview.jsx';
import {useLiveContent} from './LiveContentContext.js';
import CanvasCodeEditor from '../CanvasCodeEditor.jsx';
import {ui} from '../../i18n/locale.js';
import './html-object.css';
export {htmlPreviewDocument} from './htmlPreviewDocument.js';
import {htmlPreviewDocument} from './htmlPreviewDocument.js';
import {useWebAssets} from './WebAssetsContext.js';
export default function HtmlObject({id,value,editing,onChange,onUndo,onSave,onStopEditing,onStartEditing}){
 const assets=useWebAssets(id),live=useLiveContent(id,'html'),active=editing||live.active;
 const codeRevision=JSON.stringify([assets.css,assets.js]);
 const revision=JSON.stringify([codeRevision,assets.values]);
 const frame=useRef(null),current=useRef(assets);current.current=assets;
 const preview=useMemo(()=>active?htmlPreviewDocument(value,assets):'',[active,value,codeRevision]);
 const sendValues=()=>frame.current?.contentWindow?.postMessage({type:'frelog-values',values:current.current.values||{}},'*');
 useEffect(()=>{sendValues();},[assets]);
 return <div className={`html-object-content${editing?' is-editing':''}`} data-object-action onPointerDown={event=>{if(editing||event.target.closest('button'))event.stopPropagation();}}  onWheel={event=>event.stopPropagation()}>
  <header><strong>HTML</strong><span>{ui('미리보기')} · CSS {assets.css.length} · JS {assets.js.length}</span><button type="button" onClick={()=>live.active?live.deactivate():live.activate()}>{live.active?ui('미리보기 닫기'):ui('미리보기 실행')}</button><button disabled={!editing&&!onStartEditing} type="button" onClick={()=>editing?onStopEditing():onStartEditing?.()}>{editing?ui('완료'):ui('코드 편집')}</button></header>
  {editing&&<div className="html-object-editor"><CanvasCodeEditor inline value={value} language="html" onChange={onChange} onUndo={onUndo} onSave={onSave} onStopEditing={onStopEditing}/></div>}
  {active?<iframe ref={frame} onLoad={sendValues} title={ui('HTML 미리보기')} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={preview}/>:<StaticMarkupPreview source={value} revision={revision}/> }
 </div>;
}
