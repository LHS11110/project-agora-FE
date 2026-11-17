import {useMemo,useState} from 'react';
import {ui} from '../../i18n/locale.js';
import {notebookHtml} from './notebookData.js';
import StaticMarkupPreview from '../content/StaticMarkupPreview.jsx';
import {useLiveContent} from '../content/LiveContentContext.js';
function RichOutput({source,svg,fontSize,ownerId}){
 const live=useLiveContent(ownerId,'notebook'),[opened,setOpened]=useState(false),active=opened&&live.active&&opened===live.generation;
 const document=useMemo(()=>active?notebookHtml(source,fontSize):'', [active,source,fontSize]);
 const svgUri=useMemo(()=>svg?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(source):null,[svg,source]);
 const show=()=>setOpened(live.activate());
 const height=svg?240:Math.max(80,Math.min(480,(source.match(/<tr\b/gi)?.length||5)*28+32));
 return active?<div className="notebook-live-output"><button type="button" data-object-action onClick={()=>{setOpened(false);live.deactivate();}}>{ui('실제 출력 닫기')}</button><iframe title={ui(svg?'노트북 그래프':'노트북 HTML 출력')} sandbox="" referrerPolicy="no-referrer" style={{height}} srcDoc={document}/></div>:svg?<div className="notebook-live-output"><img className="notebook-static-svg" alt={ui('노트북 그래프')} src={svgUri}/><button type="button" data-object-action onPointerDown={event=>event.stopPropagation()} onClick={show}>{ui('실제 출력 보기')}</button></div>:<StaticMarkupPreview source={source} revision={fontSize} fontSize={fontSize} onActivate={show}/>;
}
export default function NotebookOutput({output,fontSize,ownerId}){
 const o=output||{},d=o.data||{},plain=value=>Array.isArray(value)?value.join(''):String(value??'');
 if(o.output_type==='error')return <pre className="notebook-error">{plain((Array.isArray(o.traceback)?o.traceback.join('\n'):'')||`${o.ename}: ${o.evalue}`).replace(/\u001b\[[0-9;]*m/g,'')}</pre>;
 if(o.output_type==='stream')return <pre>{plain(o.text)}</pre>;
 const image=d['image/png']||d['image/jpeg'];
 if(image)return <img alt={ui('노트북 출력')} src={`data:${d['image/png']?'image/png':'image/jpeg'};base64,${plain(image)}`}/>;
 if(d['text/html'])return <RichOutput source={plain(d['text/html'])} {...{fontSize,ownerId}}/>;
 if(d['image/svg+xml'])return <RichOutput source={plain(d['image/svg+xml'])} svg {...{fontSize,ownerId}}/>;
 return <pre>{plain(d['text/plain'])}</pre>;
}
