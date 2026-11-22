import {memo,useMemo} from 'react';
import {ui} from '../../i18n/locale.js';
import {useUiLocale} from '../../i18n/useUiLocale.js';
import {notebookHtml} from './notebookData.js';
import '../content/static-preview.css';
const RichOutput=memo(function RichOutput({source,svg,fontSize}){
 useUiLocale();
 const document=useMemo(()=>notebookHtml(source,fontSize),[source,fontSize]);
 const height=svg?240:Math.max(80,Math.min(480,(source.match(/<tr\b/gi)?.length||5)*28+32));
 return <div className="notebook-live-output"><iframe title={ui(svg?'노트북 그래프':'노트북 HTML 출력')} sandbox="" referrerPolicy="no-referrer" style={{height}} srcDoc={document}/></div>;
});
const NotebookOutput=memo(function NotebookOutput({output,fontSize}){
 useUiLocale();
 const o=output||{},d=o.data||{},plain=value=>Array.isArray(value)?value.join(''):String(value??'');
 if(o.output_type==='error')return <pre className="notebook-error">{plain((Array.isArray(o.traceback)?o.traceback.join('\n'):'')||`${o.ename}: ${o.evalue}`).replace(/\u001b\[[0-9;]*m/g,'')}</pre>;
 if(o.output_type==='stream')return <pre>{plain(o.text)}</pre>;
 const image=d['image/png']||d['image/jpeg'];
 if(image)return <img alt={ui('노트북 출력')} src={`data:${d['image/png']?'image/png':'image/jpeg'};base64,${plain(image)}`}/>;
 if(d['text/html'])return <RichOutput source={plain(d['text/html'])} fontSize={fontSize}/>;
 if(d['image/svg+xml'])return <RichOutput source={plain(d['image/svg+xml'])} svg fontSize={fontSize}/>;
 return <pre>{plain(d['text/plain'])}</pre>;
});
export default NotebookOutput;
