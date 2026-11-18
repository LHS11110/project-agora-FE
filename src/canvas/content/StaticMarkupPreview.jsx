import {memo,useEffect,useState,useMemo} from 'react';
import {staticMarkupPreview,staticPreviewQueue} from './staticPreviewQueue.js';
import {ui} from '../../i18n/locale.js';
import './static-preview.css';
const StaticMarkupPreview=memo(function StaticMarkupPreview({source,revision='',label='HTML',onActivate,fontSize}){
 const key=useMemo(()=>JSON.stringify([source,revision]),[source,revision]);
 const [ready,setReady]=useState(()=>{const value=staticPreviewQueue.cache.get(key);return value?{source,revision,value}:null;});
 useEffect(()=>{return staticPreviewQueue.request(key,()=>staticMarkupPreview(source),value=>setReady(previous=>previous?.source===source&&previous.revision===revision&&previous.value===value?previous:{source,revision,value}));},[source,revision,key]);
 const preview=ready?.source===source&&ready.revision===revision?ready.value:null;
 return <div className="static-markup-preview" style={fontSize?{fontSize}:undefined}>
  <small>{label} · {ui('정적 콘텐츠 요약')}</small>
  {preview?.heading&&<strong>{preview.heading}</strong>}
  {preview?.rows.length?<div className="static-preview-table">{preview.rows.map((row,i)=><div key={i}>{row.map((cell,j)=><span key={j}>{cell}</span>)}</div>)}</div>:<pre>{preview?.text||preview?.code||String(source||'').slice(0,350)}</pre>}
  {onActivate&&<button type="button" data-object-action onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();onActivate();}}>{ui('실제 출력 보기')}</button>}
 </div>;
});
export default StaticMarkupPreview;
