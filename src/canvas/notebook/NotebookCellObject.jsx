import NotebookCodeInput from './NotebookCodeInput.jsx';
import {useEffect,useState} from 'react';
import {objectFontSize,objectBaseFontSize} from '../objectSize.js';
import MarkdownText from '../../components/MarkdownText.jsx';
import {ui} from '../../i18n/locale.js';
import {notebookHtml} from './notebookData.js';
import {createId} from '../canvasIds.js';

function Output({output,fontSize}){
 const o=output||{},d=o.data||{},plain=value=>Array.isArray(value)?value.join(''):String(value??'');
 if(o.output_type==='error')return <pre className="notebook-error">{plain((Array.isArray(o.traceback)?o.traceback.join('\n'):'')||`${o.ename}: ${o.evalue}`).replace(/\u001b\[[0-9;]*m/g,'')}</pre>;
 if(o.output_type==='stream')return <pre>{plain(o.text)}</pre>;
 const image=d['image/png']||d['image/jpeg'];
 if(image)return <img alt={ui('노트북 출력')} src={`data:${d['image/png']?'image/png':'image/jpeg'};base64,${plain(image)}`}/>;
 if(d['text/html'])return <iframe title={ui('노트북 HTML 출력')} sandbox="" referrerPolicy="no-referrer" style={{height:Math.max(80,Math.min(480,(plain(d['text/html']).match(/<tr\b/gi)?.length||5)*28+32))}} srcDoc={notebookHtml(plain(d['text/html']),fontSize)}/>;
 if(d['image/svg+xml'])return <iframe title={ui('노트북 그래프')} sandbox="" referrerPolicy="no-referrer" srcDoc={notebookHtml(plain(d['image/svg+xml']),fontSize)}/>;
 return <pre>{plain(d['text/plain'])}</pre>;
}

export default function NotebookCellObject({id,item,notebook,notebookSiblings=[],notebookOrder=0,notebookCellCount=0,store,selected,readOnly,canExecute,onChange}){
 const [editingMarkdown,setEditingMarkdown]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const cell=item.notebookCell||{id:'',cellType:'code',source:''},result=item.notebookResult||{};
 const factor=objectFontSize(item)/objectBaseFontSize(item),writable=!readOnly&&selected,disabled=busy||Boolean(notebook?.runtimeState?.running);
 const hasOutput=Boolean(result.error||result.truncated||result.exitCode!==undefined||result.outputs?.length);
 const running=Boolean(notebook?.runtimeState?.running&&notebook.runtimeState.detail===cell.id);
 useEffect(()=>{if(!selected||readOnly)setEditingMarkdown(false);},[selected,readOnly]);
 const patch=(update)=>onChange(id,{notebookCell:{...cell,...update}});
 const run=async()=>{
  if(!canExecute||busy||notebook?.runtimeState?.running)return;
  setBusy(true);setMessage('');
  try{const response=await store.notebook(item.notebookId,{operation:'execute',code:cell.source||'',cellId:cell.id,cellObjectId:id});if(response?.error||response?.exitCode)setMessage(response.error||response.output||ui('셀 실행에 실패했습니다.'));}
  catch(error){setMessage(error.message||ui('셀 실행에 실패했습니다.'));}
  finally{
   setBusy(false);
   if(cell.cellType==='code'&&selected&&!readOnly){
    const index=notebookSiblings.findIndex(entry=>entry.id===id),next=notebookSiblings.slice(index+1).find(entry=>entry.item.notebookCell?.cellType==='code');
    if(next){store.focusCanvasObject?.(next.id);setTimeout(()=>{for(const editor of document.querySelectorAll('textarea[data-cell-id]'))if(editor.dataset.cellId===next.item.notebookCell.id){editor.focus({preventScroll:true});editor.scrollIntoView({block:'nearest'});break;}},30);}
    else if(notebookSiblings.length<32){const created={id:crypto.randomUUID(),cellType:'code',source:''},objectId=createId();if(store.notebookStructure?.(item.notebookId,{type:'add',cell:created,cellObjectId:objectId})){store.focusCanvasObject?.(objectId);setTimeout(()=>{for(const editor of document.querySelectorAll('textarea[data-cell-id]'))if(editor.dataset.cellId===created.id){editor.focus({preventScroll:true});editor.scrollIntoView({block:'nearest'});break;}},50);}}
   }
  }
 };
 const structure=(type,extra={})=>store.notebookStructure?.(item.notebookId,{type,cellObjectId:id,...extra});
 const markdownPanel=cell.cellType==='markdown'?<div className="notebook-markdown" tabIndex={writable&&!disabled?0:undefined} role={writable&&!disabled?'button':undefined} aria-label={ui('마크다운 편집')} onDoubleClick={()=>{if(writable&&!disabled)setEditingMarkdown(true);}} onKeyDown={event=>{if(writable&&!disabled&&event.key==='Enter'){event.preventDefault();setEditingMarkdown(true);}}}>{!editingMarkdown&&<MarkdownText source={cell.source||ui('더블 클릭하여 마크다운 편집')}/>}</div>:null;
 const outputPanel=hasOutput?<div className="notebook-outputs">{result.outputs?.map((output,index)=><Output key={index} output={output} fontSize={13*factor}/>)}{result.truncated&&<small>{ui('출력 일부가 생략되었습니다.')}</small>}{result.error&&<p role="alert">{result.error}</p>}</div>:null;
 return <section className={`notebook-cell-surface${running?' is-running':''}`} data-object-action onPointerDown={event=>{if(selected)event.stopPropagation();}} onWheel={event=>{if(selected)event.stopPropagation();}} onKeyDown={event=>{event.stopPropagation();if(event.shiftKey&&event.key==='Enter'&&!event.nativeEvent.isComposing&&event.keyCode!==229&&event.target.dataset.cellId){event.preventDefault();void run();}}}>
  <article className={`notebook-cell${cell.cellType==='markdown'?' is-markdown':''}${editingMarkdown?' is-editing':''}${busy||running?' is-running':''}`} data-status={result.exitCode===undefined?undefined:result.exitCode?'error':'success'}>
   <div className="notebook-cell-toolbar"><small>{cell.cellType==='code'?`In [${result.executionCount??' '}]`:`${notebookOrder||'·'}`}</small><select aria-label={ui('셀 유형')} disabled={!writable||disabled} value={cell.cellType} onChange={event=>patch({cellType:event.target.value})}><option value="code">Code</option><option value="markdown">Markdown</option></select><button aria-label={ui('위로 이동')} title={ui('위로 이동')} disabled={!writable||disabled||notebookOrder<=1} onClick={()=>structure('move',{direction:-1})}>↑</button><button aria-label={ui('아래로 이동')} title={ui('아래로 이동')} disabled={!writable||disabled||notebookOrder>=notebookCellCount} onClick={()=>structure('move',{direction:1})}>↓</button><button className="notebook-run-button" aria-label={ui('셀 실행')} title={ui('셀 실행')} disabled={!canExecute||disabled||cell.cellType!=='code'} onClick={()=>void run()}>▶</button><button aria-label={ui('셀 삭제')} title={ui('셀 삭제')} disabled={!writable||disabled} onClick={()=>structure('delete')}>×</button></div>
   {cell.cellType==='code'&&<NotebookCodeInput cell={cell} index={notebookOrder} editable={writable&&!disabled} onChange={source=>patch({source})} onRun={()=>void run()} factor={factor}/>}
   {editingMarkdown&&<textarea autoFocus={cell.cellType==='markdown'} onBlur={()=>{if(cell.cellType==='markdown')setEditingMarkdown(false);}} data-cell-id={cell.id} aria-label={`${ui('노트북 셀')} ${notebookOrder||''}`} spellCheck={false} readOnly={!writable||disabled} value={cell.source} onChange={event=>patch({source:event.target.value})} style={{minHeight:Math.min(320,Math.max(76,cell.source.split('\n').length*19+20))*factor}}/>}
   {cell.cellType==='markdown'?markdownPanel:outputPanel}
  </article>
  <span className="notebook-cell-status" role="status">{busy||running?ui('노트북 실행 중…'):message}</span>
 </section>;
}
