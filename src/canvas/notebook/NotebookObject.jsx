import {useRef,useState} from 'react';
import MarkdownText from '../../components/MarkdownText.jsx';
import {ui} from '../../i18n/locale.js';
import {exportNotebook,importNotebook,notebookCell,notebookHtml,NOTEBOOK_LIMIT} from './notebookData.js';
import './notebook.css';
function Output({output}){
 const o=output||{},d=o.data||{},plain=value=>Array.isArray(value)?value.join(''):String(value??'');
 if(o.output_type==='error')return <pre className="notebook-error">{plain(o.traceback?.join('\n')||`${o.ename}: ${o.evalue}`).replace(/\u001b\[[0-9;]*m/g,'')}</pre>;
 if(o.output_type==='stream')return <pre>{plain(o.text)}</pre>;
 const image=d['image/png']||d['image/jpeg'];
 if(image)return <img alt={ui('노트북 출력')} src={`data:${d['image/png']?'image/png':'image/jpeg'};base64,${plain(image)}`}/>;
 if(d['text/html'])return <iframe title={ui('노트북 HTML 출력')} sandbox="" referrerPolicy="no-referrer" srcDoc={notebookHtml(plain(d['text/html']))}/>;
 if(d['image/svg+xml'])return <iframe title={ui('노트북 그래프')} sandbox="" referrerPolicy="no-referrer" srcDoc={notebookHtml(plain(d['image/svg+xml']))}/>;
 return <pre>{plain(d['text/plain'])}</pre>;
}
export default function NotebookObject({id,item,store,readOnly,canExecute,selected,onChange}){
 const [busy,setBusy]=useState(null),[message,setMessage]=useState('');const file=useRef(null),latest=useRef(item);latest.current=item;
 const cells=item.notebookCells||[],results=item.notebookResults||{},remoteBusy=item.runtimeState?.running&&Date.now()-item.runtimeState.updatedAt<240000;
 const disabled=Boolean(busy||remoteBusy),writable=!readOnly&&selected;
 const patch=update=>onChange(id,typeof update==='function'?update:old=>({...old,...update}));
 const changeCell=(cellId,update)=>patch(old=>({...old,notebookCells:(old.notebookCells||[]).map(c=>c.id===cellId?{...c,...update}:c)}));
 const add=()=>{if(cells.length<NOTEBOOK_LIMIT)patch(old=>({...old,notebookCells:[...(old.notebookCells||[]),notebookCell()]}));};
 const run=async(cellId=null,operation='execute')=>{
  if(!canExecute||disabled)return;setBusy(cellId||operation);setMessage('');
  try{
   const snapshot=latest.current.notebookCells||[],targets=operation==='execute'?snapshot.filter(c=>c.cellType==='code'&&(!cellId||c.id===cellId)):[null];
   for(const cell of targets){
    const result=await store.notebook(id,{operation,code:cell?.source||'',cellId:cell?.id});
    if(result.error||result.exitCode){setMessage(result.error||result.output||ui('셀 실행에 실패했습니다.'));break;}
    if(operation==='prepare')setMessage(ui('주피터 환경을 준비했습니다.'));
    if(operation==='reset')setMessage(ui('커널을 초기화했습니다.'));
   }
  }catch(error){setMessage(error.message);}finally{setBusy(null);}
 };
 const download=()=>{const blob=new Blob([JSON.stringify(exportNotebook(item),null,2)],{type:'application/x-ipynb+json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='notebook.ipynb';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <section className={`notebook-content${remoteBusy?' is-running':''}`} data-object-action onPointerDown={e=>{if(selected)e.stopPropagation();}} onWheel={e=>{if(selected)e.stopPropagation();}} onKeyDown={e=>{e.stopPropagation();if(e.shiftKey&&e.key==='Enter'&&e.target.dataset.cellId){e.preventDefault();void run(e.target.dataset.cellId);}}}>
  <header><strong>Jupyter Notebook</strong><span>Python</span><button disabled={!canExecute||disabled} onClick={()=>run()}>{ui('모두 실행')}</button></header>
  <nav aria-label={ui('노트북 도구')}><button disabled={!canExecute||disabled} onClick={()=>run(null,'prepare')}>{busy==='prepare'?ui('환경 준비 중…'):ui('환경 준비')}</button><button disabled={!canExecute||disabled} onClick={()=>run(null,'reset')}>{ui('커널 초기화')}</button><button disabled={!writable||disabled} onClick={()=>file.current?.click()}>{ui('ipynb 가져오기')}</button><button onClick={download}>{ui('ipynb 내보내기')}</button><input hidden ref={file} type="file" accept=".ipynb,application/json" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{if(f.size>512*1024)throw Error(ui('노트북 파일은 512KB 이하로 선택하세요.'));patch(importNotebook(JSON.parse(await f.text())));}catch(error){setMessage(error.message);}}}/></nav>
  <div className="notebook-cells" style={{pointerEvents:selected?'auto':'none'}}>{cells.map((cell,index)=><article key={cell.id} className={`notebook-cell${busy===cell.id?' is-running':''}`}><div className="notebook-cell-toolbar"><small>{cell.cellType==='code'?`In [${results[cell.id]?.executionCount??' '}]`:`${index+1}`}</small><select aria-label={ui('셀 유형')} disabled={!writable||disabled} value={cell.cellType} onChange={e=>changeCell(cell.id,{cellType:e.target.value})}><option value="code">Code</option><option value="markdown">Markdown</option></select><button aria-label={ui('셀 실행')} disabled={!canExecute||disabled||cell.cellType!=='code'} onClick={()=>run(cell.id)}>▶</button><button aria-label={ui('셀 삭제')} disabled={!writable||disabled} onClick={()=>patch(old=>({...old,notebookCells:old.notebookCells.filter(c=>c.id!==cell.id),notebookResults:Object.fromEntries(Object.entries(old.notebookResults||{}).filter(([key])=>key!==cell.id))}))}>×</button></div>
   <textarea data-cell-id={cell.id} aria-label={`${ui('노트북 셀')} ${index+1}`} spellCheck={false} readOnly={!writable||disabled} value={cell.source} onChange={e=>changeCell(cell.id,{source:e.target.value})} style={{minHeight:Math.min(320,Math.max(76,cell.source.split('\n').length*19+20))}}/>
   {cell.cellType==='markdown'?<div className="notebook-markdown"><MarkdownText source={cell.source}/></div>:<div className="notebook-outputs">{results[cell.id]?.outputs?.map((output,i)=><Output key={i} output={output}/>)}{results[cell.id]?.truncated&&<small>{ui('출력 일부가 생략되었습니다.')}</small>}{results[cell.id]?.error&&<p role="alert">{results[cell.id].error}</p>}</div>}
  </article>)}</div>
  <footer><button disabled={!writable||disabled||cells.length>=NOTEBOOK_LIMIT} onClick={add}>+ {ui('셀 추가')}</button><span role="status">{disabled?ui('노트북 실행 중…'):message||ui('Shift + Enter로 셀 실행')}</span></footer>
 </section>;
}
