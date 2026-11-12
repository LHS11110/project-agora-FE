import NotebookCodeInput from './NotebookCodeInput.jsx';
import {objectFontSize,objectBaseFontSize} from '../objectSize.js';
import {useObjectRuntimeState} from '../runtime/useObjectRuntimeState.js';
import {useEffect,useRef,useState} from 'react';
import MarkdownText from '../../components/MarkdownText.jsx';
import {ui} from '../../i18n/locale.js';
import {exportNotebook,importNotebook,notebookCell,notebookHtml,NOTEBOOK_LIMIT,NOTEBOOK_FILE_LIMIT_BYTES} from './notebookData.js';
import './notebook.css';
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
export {Output as NotebookOutput};

export default function NotebookObject({id,item,store,readOnly,canExecute,selected,onChange,cellItems=[]}){
 const [editingMarkdown,setEditingMarkdown]=useState(null);
 const [activeCodeCell,setActiveCodeCell]=useState(null);
 const root=useRef(null),[focusCell,setFocusCell]=useState(null);
 useEffect(()=>{if(!selected||readOnly)setEditingMarkdown(null);},[selected,readOnly]);
 const [busy,setBusy]=useState(null),[message,setMessage]=useState('');const file=useRef(null),latest=useRef(item);latest.current=item;
 const fontFactor=objectFontSize(item)/objectBaseFontSize(item);
 const runtime=useObjectRuntimeState(id,item,store);
 const separate=Array.isArray(item.notebookCellIds);
 const getCellItems=()=>store.notebookCellItems?.(id)||cellItems;
 const cells=separate?cellItems.map(entry=>({...entry.item.notebookCell,objectId:entry.id,result:entry.item.notebookResult})).filter(cell=>cell?.id):item.notebookCells||[];
 const results=separate?Object.fromEntries(cells.filter(cell=>cell.result).map(cell=>[cell.id,cell.result])):item.notebookResults||{};
 const remoteBusy=runtime?.running,writable=!readOnly&&selected;
 useEffect(()=>{
  if(!focusCell||busy||!writable)return;
  const editor=Array.from(root.current?.querySelectorAll('textarea[data-cell-id]')||[]).find(node=>node.dataset.cellId===focusCell);
  if(editor){editor.focus({preventScroll:true});editor.scrollIntoView({block:'nearest',inline:'nearest'});setFocusCell(null);}
 },[focusCell,busy,writable,cells]);
 const patch=update=>onChange(id,typeof update==='function'?update:old=>({...old,...update}));
 const changeLegacyCell=(cellId,update)=>patch(old=>({...old,notebookCells:(old.notebookCells||[]).map(cell=>cell.id===cellId?{...cell,...update}:cell)}));
 const add=()=>{
  if(cells.length>=NOTEBOOK_LIMIT)return;
  const created=notebookCell();
  if(separate)store.notebookStructure?.(id,{type:'add',cell:created});
  else patch(old=>({...old,notebookCells:[...(old.notebookCells||[]),created]}));
 };
 const run=async(cellId=null,operation='execute')=>{
  if(!canExecute||busy||remoteBusy)return;setBusy(cellId||operation);setMessage('');
  try{
   const currentCells=getCellItems();
   const snapshot=latest.current.notebookCellIds?currentCells.map(entry=>entry.item?.notebookCell).filter(Boolean):latest.current.notebookCells||[];
   const targets=operation==='execute'?snapshot.filter(cell=>cell.cellType==='code'&&(!cellId||cell.id===cellId)):[null];
   for(const cell of targets){
    const result=await store.notebook(id,{operation,code:cell?.source||'',cellId:cell?.id});
    if(result.error||result.exitCode){setMessage(result.error||result.output||ui('셀 실행에 실패했습니다.'));break;}
    if(operation==='prepare')setMessage(ui('주피터 환경을 준비했습니다.'));
    if(operation==='reset')setMessage(ui('커널을 초기화했습니다.'));
   }
  }catch(error){setMessage(error.message);}finally{
   setBusy(null);
   if(cellId&&operation==='execute'&&writable&&!separate){
    const current=latest.current.notebookCells||[],index=current.findIndex(cell=>cell.id===cellId),next=current.slice(index+1).find(cell=>cell.cellType==='code');
    if(next)setFocusCell(next.id);
    else if(current.length<NOTEBOOK_LIMIT){const created=notebookCell();patch(old=>({...old,notebookCells:(old.notebookCells||[]).length<NOTEBOOK_LIMIT?[...(old.notebookCells||[]),created]:old.notebookCells}));setFocusCell(created.id);}
   }else if(cellId&&operation==='execute'&&writable&&separate){
    const index=cells.findIndex(cell=>cell.id===cellId),next=cells.slice(index+1).find(cell=>cell.cellType==='code');if(next)for(const editor of document.querySelectorAll('textarea[data-cell-id]'))if(editor.dataset.cellId===next.id){editor.focus({preventScroll:true});break;}
   }
  }
 };
 const structure=async(operation)=>{
  if(separate){const accepted=await store.notebookStructure?.(id,operation);if(accepted===false)throw Error(ui('노트북 셀 변경을 저장하지 못했습니다.'));return;}
  if(operation.type==='clear-results')patch({notebookResults:{}});
  else if(operation.type==='replace')patch({...importNotebook({nbformat:4,cells:operation.cells.map(cell=>({cell_type:cell.cellType,source:cell.source}))})});
 };
 const download=()=>{const blob=new Blob([JSON.stringify(exportNotebook(item,getCellItems()),null,2)],{type:'application/x-ipynb+json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='notebook.ipynb';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const importFile=async event=>{const f=event.target.files?.[0];event.target.value='';if(!f)return;try{if(f.size>NOTEBOOK_FILE_LIMIT_BYTES)throw Error(ui('노트북 파일은 1MB 이하로 선택하세요.'));const parsed=importNotebook(JSON.parse(await f.text()));if(separate)await structure({type:'replace',cells:parsed.notebookCells});else patch(parsed);}catch(error){setMessage(error.message);}};
 const clearResults=()=>separate?void structure({type:'clear-results'}):patch({notebookResults:{}});
 return <section ref={root} className={`notebook-content${separate?' notebook-controls-only':''}${remoteBusy?' is-running':''}`} data-object-action onPointerDown={event=>{if(selected)event.stopPropagation();}} onWheel={event=>{if(selected)event.stopPropagation();}} onKeyDown={event=>{event.stopPropagation();if(event.shiftKey&&event.key==='Enter'&&!event.nativeEvent.isComposing&&event.keyCode!==229&&event.target.dataset.cellId){event.preventDefault();void run(event.target.dataset.cellId);}}}>
  <header><strong>Jupyter Notebook</strong><span>Python</span><button disabled={!canExecute||busy||remoteBusy} onClick={()=>run()}>{ui('모두 실행')}</button></header>
  <nav aria-label={ui('노트북 도구')}><button title={ui('새 기능 적용 시 VM이 다시 시작될 수 있으며 파일은 유지됩니다.')} disabled={!canExecute||readOnly||busy||remoteBusy} onClick={()=>run(null,'prepare')}>{busy==='prepare'?ui('환경 준비 중…'):ui('환경 준비')}</button><button disabled={!canExecute||busy||remoteBusy} onClick={()=>run(null,'reset')}>{ui('커널 초기화')}</button><button disabled={!writable||busy||remoteBusy} onClick={()=>file.current?.click()}>{ui('ipynb 가져오기')}</button><button disabled={!writable||busy||remoteBusy} onClick={clearResults}>{ui('출력 지우기')}</button><button onClick={download}>{ui('ipynb 내보내기')}</button><input hidden ref={file} type="file" accept=".ipynb,application/json" onChange={importFile}/></nav>
  {!separate&&<div className="notebook-cells legacy-notebook-cells" style={{pointerEvents:selected?'auto':'none'}}>{cells.map((cell,index)=><article key={cell.id} data-status={results[cell.id]?results[cell.id].exitCode?'error':'success':undefined} className={`notebook-cell${cell.cellType==='markdown'?' is-markdown':''}${editingMarkdown===cell.id?' is-editing':''}${busy===cell.id||remoteBusy&&item.runtimeState?.detail===cell.id?' is-running':''}`}><div className="notebook-cell-toolbar"><small>{cell.cellType==='code'?`In [${results[cell.id]?.executionCount??' '}]`:`${index+1}`}</small><select aria-label={ui('셀 유형')} disabled={!writable||busy||remoteBusy} value={cell.cellType} onChange={event=>changeLegacyCell(cell.id,{cellType:event.target.value})}><option value="code">Code</option><option value="markdown">Markdown</option></select><button aria-label={ui('셀 실행')} disabled={!canExecute||busy||remoteBusy||cell.cellType!=='code'} onClick={()=>run(cell.id)}>▶</button><button aria-label={ui('셀 삭제')} disabled={!writable||busy||remoteBusy} onClick={()=>patch(old=>({...old,notebookCells:old.notebookCells.filter(value=>value.id!==cell.id),notebookResults:Object.fromEntries(Object.entries(old.notebookResults||{}).filter(([key])=>key!==cell.id))}))}>×</button></div>{cell.cellType==='code'&&<NotebookCodeInput cell={cell} index={index+1} active={activeCodeCell===cell.id} onActivate={()=>setActiveCodeCell(cell.id)} onDeactivate={()=>setActiveCodeCell(current=>current===cell.id?null:current)} editable={writable&&!busy&&!remoteBusy} onChange={source=>changeLegacyCell(cell.id,{source})} onRun={()=>run(cell.id)} factor={fontFactor}/>}
{editingMarkdown===cell.id&&<textarea autoFocus={cell.cellType==='markdown'} onBlur={()=>{if(cell.cellType==='markdown')setEditingMarkdown(null);}} data-cell-id={cell.id} aria-label={`${ui('노트북 셀')} ${index+1}`} spellCheck={false} readOnly={!writable||busy||remoteBusy} value={cell.source} onChange={event=>changeLegacyCell(cell.id,{source:event.target.value})} style={{minHeight:Math.min(320,Math.max(76,cell.source.split('\n').length*19+20))*fontFactor}}/>}{cell.cellType==='markdown'?<div className="notebook-markdown" tabIndex={writable&&!busy?0:undefined} role={writable&&!busy?'button':undefined} aria-label={ui('마크다운 편집')} onDoubleClick={()=>{if(writable&&!busy)setEditingMarkdown(cell.id);}} onKeyDown={event=>{if(writable&&!busy&&event.key==='Enter'){event.preventDefault();setEditingMarkdown(cell.id);}}}>{editingMarkdown!==cell.id&&<MarkdownText source={cell.source||ui('더블 클릭하여 마크다운 편집')}/>}</div>:<div className="notebook-outputs">{results[cell.id]?.outputs?.map((output,index)=><Output key={index} output={output} fontSize={13*fontFactor}/>)}{results[cell.id]?.truncated&&<small>{ui('출력 일부가 생략되었습니다.')}</small>}{results[cell.id]?.error&&<p role="alert">{results[cell.id].error}</p>}</div>}</article>)}</div>}
  <footer><button disabled={!writable||busy||remoteBusy||cells.length>=NOTEBOOK_LIMIT} onClick={add}>+ {ui('셀 추가')}</button><span role="status">{busy||remoteBusy?ui('노트북 실행 중…'):message||runtime?.error||ui('Shift + Enter로 셀 실행')}</span></footer>
 </section>;
}
