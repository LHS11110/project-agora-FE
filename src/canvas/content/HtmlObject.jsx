import {memo,useMemo,useRef,useEffect,useLayoutEffect} from 'react';
import CanvasCodeEditor from '../CanvasCodeEditor.jsx';
import {ui} from '../../i18n/locale.js';
import {useUiLocale} from '../../i18n/useUiLocale.js';
import './html-object.css';
export {htmlPreviewDocument} from './htmlPreviewDocument.js';
import {htmlPreviewDocument} from './htmlPreviewDocument.js';
import {useWebAssets} from './WebAssetsContext.js';
const HtmlObject=memo(function HtmlObject({id,value,editing,onChange,onUndo,onSave,onStopEditing,onStartEditing}){
 useUiLocale();
 const assets=useWebAssets(id);
 const codeRevision=JSON.stringify([assets.css,assets.js]);
 const frame=useRef(null),current=useRef(assets);current.current=assets;
 const preview=useMemo(()=>htmlPreviewDocument(value,assets),[value,codeRevision]);
 const sendValues=()=>frame.current?.contentWindow?.postMessage({type:'frelog-values',values:current.current.values||{}},'*');
 const latestPreview=useRef(preview);latestPreview.current=preview;
 useEffect(()=>{sendValues();},[assets]);
 // The host page asks for its document once per load; a new preview reloads the frame (key below).
 // The listener is attached in the commit itself: a passive effect can be deferred for
 // several frames while the camera moves, and a ready message sent in that gap was lost,
 // leaving the frame on the blank host page for good.
 const sendDocument=target=>target?.postMessage({type:'frelog-document',html:latestPreview.current},'*');
 useLayoutEffect(()=>{
  const receive=event=>{if(event.source===frame.current?.contentWindow&&event.data?.type==='frelog-preview-ready')sendDocument(event.source);};
  window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
 },[]);
 // The host's listener is registered before its load event, so answering on load as well
 // covers a ready message missed for any other reason. The host takes only the first
 // document, so a duplicate is ignored.
 const handleLoad=()=>{sendDocument(frame.current?.contentWindow);sendValues();};
 return <div className={`html-object-content${editing?' is-editing':''}`} data-object-action onPointerDown={event=>{if(editing||event.target.closest('button'))event.stopPropagation();}} onWheel={event=>{if(!event.ctrlKey&&!event.metaKey)event.stopPropagation();}}>
  <header><strong>HTML</strong><span>{ui('미리보기')} · CSS {assets.css.length} · JS {assets.js.length}</span><button disabled={!editing&&!onStartEditing} type="button" onClick={()=>editing?onStopEditing():onStartEditing?.()}>{editing?ui('완료'):ui('코드 편집')}</button></header>
  {editing&&<div className="html-object-editor"><CanvasCodeEditor inline value={value} language="html" onChange={onChange} onUndo={onUndo} onSave={onSave} onStopEditing={onStopEditing}/></div>}
  <iframe key={preview} ref={frame} onLoad={handleLoad} title={ui('HTML 미리보기')} sandbox="allow-scripts" referrerPolicy="no-referrer" src="/html-preview.html"/>
 </div>;
});
export default HtmlObject;
