import {useEffect,useRef,useState} from 'react';
import {ui} from '../../i18n/locale.js';
import {canvasSnapshot,githubCanvasClient,normalizeRepositoryIdentity} from './githubCanvas.js';
import './canvas-github.css';
import CanvasBranchPanel from './CanvasBranchPanel.jsx';
import {syncBranchCanvas} from './canvasBranchSync.js';
import {useAuth} from '../../state/AuthContext.jsx';
import {api as request} from '../../api/client.js';
export default function CanvasGithubPanel({api,canvasId,onLoad}){
 const {token:agoraToken,user}=useAuth();
 const [config,setConfig]=useState(()=>{try{return {...{owner:'',repo:'',branch:'',path:`canvases/${canvasId}.canvas.json`},...JSON.parse(localStorage.getItem(`frelog.github.canvas.${canvasId}`)||'{}')};}catch{return {owner:'',repo:'',branch:'',path:`canvases/${canvasId}.canvas.json`};}});
 const [tab,setTab]=useState('history');
 const [token,setToken]=useState(''),[connection,setConnection]=useState(null),[prepared,setPrepared]=useState(null),[history,setHistory]=useState([]),[page,setPage]=useState(1),[more,setMore]=useState(false),[message,setMessage]=useState(`Update canvas ${canvasId}`),[status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[commitSha,setCommitSha]=useState('');
 const feedback=useRef(null);
 useEffect(()=>{if(error||status)feedback.current?.scrollIntoView({block:'nearest'});},[error,status]);
 const configEdits=useRef(0);
 useEffect(()=>{let active=true;const revision=configEdits.current;request(`/api/canvases/${canvasId}/github`,{token:agoraToken}).then(data=>{if(active&&revision===configEdits.current&&data.project?.target&&data.currentBranch)setConfig({...data.project.target,branch:data.currentBranch});}).catch(()=>{});return()=>{active=false;};},[canvasId,agoraToken]);
 const running=useRef(false),controller=useRef(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[]);
 const work=async action=>{
  if(running.current)return;running.current=true;setBusy(true);setError('');setStatus('');setCommitSha('');
  const abort=new AbortController();controller.current=abort;const timeout=setTimeout(()=>abort.abort(),60000);
  try{await action(githubCanvasClient(token,{signal:abort.signal}),abort.signal);}catch(e){if(alive.current)setError(e.name==='AbortError'?ui('요청 시간이 초과되었습니다. GitHub 이력에서 결과를 확인한 뒤 다시 시도해주세요.'):e.message);}
  finally{clearTimeout(timeout);if(alive.current)setBusy(false);running.current=false;}
 };
 const update=(field,value)=>{configEdits.current++;setConfig(c=>({...c,[field]:value}));setConnection(null);setPrepared(null);setHistory([]);setStatus('');setError('');setCommitSha('');};
 const connect=()=>{setConnection(null);setPrepared(null);setHistory([]);return work(async client=>{
  const result=await client.connect(config);if(!alive.current)return;
  if(result.file)canvasSnapshot(JSON.parse(result.file.source));
  setConnection(result);setConfig(result.target);setPrepared(null);setPage(1);
  try{localStorage.setItem(`frelog.github.canvas.${canvasId}`,JSON.stringify(result.target));}catch{}
  const entries=result.file?await client.history(result.target):[];if(!alive.current)return;setHistory(entries);setMore(entries.length===20);setTab('history');setStatus(result.empty?ui('빈 저장소에 연결했습니다. 현재 캔버스를 커밋하면 첫 파일과 기본 브랜치가 생성됩니다.'):result.file?ui('저장소를 연결했습니다. 현재 캔버스를 검토한 뒤 커밋하세요.'):ui('새 캔버스 파일을 생성할 준비가 되었습니다.'));
 });};
 const prepare=()=>{try{const source=canvasSnapshot(api.read());setPrepared(source);setError('');setStatus(ui('현재 캔버스 스냅샷을 준비했습니다. 코드와 저장 대상을 확인해주세요.'));}catch(e){setError(e.message);}};
 const save=()=>work(async client=>{
  if(!prepared||!connection)return;
  const snapshot=prepared;
  if(canvasSnapshot(api.read())!==snapshot)throw new Error(ui('검토 후 캔버스가 변경되었습니다. 현재 캔버스를 다시 검토해주세요.'));
  if(connection.file?.source===snapshot){setStatus(ui('저장소와 같은 내용입니다. 새 커밋을 만들지 않았습니다.'));return;}
  let result;
  try{
   result=await client.commit(connection.target,snapshot,message,connection.file?.sha,{empty:connection.empty});if(!alive.current)return;
  }catch(e){if(alive.current){setPrepared(null);setConnection(null);}throw e;}
  setConnection({...connection,empty:false,file:{sha:result.content.sha,source:snapshot}});setPrepared(null);setCommitSha(result.commit.sha);setStatus(ui('캔버스를 GitHub에 커밋했습니다.'));
  try{const entries=await client.history(connection.target);if(alive.current){setHistory(entries);setPage(1);setMore(entries.length===20);}}
  catch{if(alive.current)setError(ui('커밋은 완료됐지만 이력을 불러오지 못했습니다. 저장소를 다시 연결해주세요.'));}
 });
 const load=entry=>work(async client=>{const source=await client.read(connection.target,entry.sha);const parsed=JSON.parse(source);canvasSnapshot(parsed);if(!alive.current)return;onLoad(JSON.stringify({...parsed,mode:'replace',remove:[]},null,2));setPrepared(null);setStatus(ui('선택한 버전을 편집기로 불러왔습니다. 변경 검토 후 적용하세요.'));});
 const restore=entry=>work(async(client,signal)=>{const source=await client.read(connection.target,entry.sha);canvasSnapshot(JSON.parse(source));await syncBranchCanvas({canvasId,token:agoraToken,user,source,signal});if(alive.current){setPrepared(null);setStatus(ui('커밋 내용으로 캔버스를 복구하고 서버 저장을 확인했습니다.'));}});
 const contextLoaded=data=>{if(data?.project?.target&&data.currentBranch){const target={...data.project.target,branch:data.currentBranch};setConfig(target);setConnection(old=>old&&Object.keys(target).some(k=>old.target[k]!==target[k])?null:old);}};
 const next=()=>work(async client=>{const entries=await client.history(connection.target,page+1);if(alive.current){setHistory(old=>[...new Map([...old,...entries].map(entry=>[entry.sha,entry])).values()]);setPage(page+1);setMore(entries.length===20);}});
 const tabs=[['history','변경 이력'],['connection','저장소 연결'],['branches','브랜치 관리']];
 const connectionPrompt=<div className="canvas-version-empty"><strong>{ui('GitHub 저장소를 연결해 시작하세요.')}</strong><p>{ui('연결 후 현재 캔버스를 저장하고 이전 버전으로 복구할 수 있습니다.')}</p><button onClick={()=>setTab('connection')}>{ui('GitHub 저장소 연결')}</button></div>;
 return <section className="canvas-github" aria-label={ui('GitHub 버전 관리')}>
  <nav className="canvas-version-tabs" role="tablist" aria-label={ui('버전 관리 메뉴')} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const current=tabs.findIndex(([id])=>id===tab),index=e.key==='Home'?0:e.key==='End'?2:(current+(e.key==='ArrowRight'?1:2))%3;setTab(tabs[index][0]);e.currentTarget.querySelectorAll('[role="tab"]')[index]?.focus();}}>
   {tabs.map(([id,label])=><button key={id} id={`version-tab-${id}`} role="tab" aria-selected={tab===id} aria-controls={`version-panel-${id}`} tabIndex={tab===id?0:-1} onClick={()=>setTab(id)}>{ui(label)}</button>)}
  </nav>
  <div ref={feedback} className="canvas-github-feedback" aria-atomic="true">
   {busy?<p role="status">{ui('GitHub 요청 중…')}</p>:connection?<p className="canvas-github-connected">{ui('연결됨')} · {connection.target.owner}/{connection.target.repo} · {connection.target.branch}</p>:<small>{ui('아직 저장소에 연결되지 않았습니다.')}</small>}
   {status&&<p role="status">{status}</p>}{error&&<p role="alert" className="canvas-as-code-error">{ui(error)}</p>}
   {commitSha&&connection&&/^[a-f\d]{40,64}$/i.test(commitSha)&&<a href={`https://github.com/${encodeURIComponent(connection.target.owner)}/${encodeURIComponent(connection.target.repo)}/commit/${commitSha}`} target="_blank" rel="noreferrer">{ui('GitHub에서 커밋 보기')}</a>}
  </div>
  <section id="version-panel-connection" role="tabpanel" aria-labelledby="version-tab-connection" hidden={tab!=='connection'}>
   <fieldset disabled={busy}>
    <div className="canvas-github-fields">
     {[['owner','GitHub 소유자'],['repo','저장소 이름 또는 URL']].map(([field,label])=><label key={field}>{ui(label)}<input value={config[field]} onChange={e=>update(field,e.target.value)} placeholder={field==='owner'?'octocat':ui('Hello-World 또는 저장소 URL')} onBlur={()=>{try{const normalized=normalizeRepositoryIdentity(config.owner,config.repo);setConfig(c=>({...c,...normalized}));}catch(e){setError(e.message);}}} autoComplete="off" spellCheck={false}/></label>)}
     <label className="canvas-github-token">{ui('GitHub 토큰')}<input type="password" autoComplete="off" value={token} onChange={e=>{setToken(e.target.value);setConnection(null);setPrepared(null);setHistory([]);}}/></label>
    </div>
    <small>{ui('예: github.com/octocat/Hello-World → GitHub 소유자 octocat · 저장소 Hello-World')}</small>
    <small>{ui('대상 저장소의 Contents 읽기·쓰기 권한이 있는 Fine-grained 토큰을 사용하세요. 토큰은 이 창의 메모리에만 유지됩니다.')}</small>
    <details className="canvas-github-advanced"><summary>{ui('고급 연결 설정')}</summary><div className="canvas-github-fields">{[['branch','브랜치'],['path','파일 경로']].map(([field,label])=><label key={field}>{ui(label)}<input value={config[field]} onChange={e=>update(field,e.target.value)} placeholder={field==='branch'?ui('기본 브랜치'):undefined}/></label>)}</div></details>
    <button type="button" className="canvas-github-save" onClick={connect} aria-busy={busy}>{ui(busy?'GitHub 요청 중…':'저장소 연결 · 새로고침')}</button>
   </fieldset>
  </section>
  <section id="version-panel-history" role="tabpanel" aria-labelledby="version-tab-history" hidden={tab!=='history'}>
   {!connection?connectionPrompt:<div className="canvas-version-history-layout">
    <section className="canvas-version-save-card"><strong>{ui('현재 캔버스 저장')}</strong><p>{ui('현재 보이는 객체를 JSON 스냅샷으로 저장합니다. 이미지·PDF 원본, VM 파일과 계정 설정은 포함하지 않습니다.')}</p>
     <fieldset disabled={busy}><button onClick={prepare}>{ui('현재 캔버스 검토')}</button>
      {prepared&&<details className="canvas-github-preview"><summary>{ui('커밋할 캔버스 코드')} · {new TextEncoder().encode(prepared).length.toLocaleString()} bytes</summary><pre>{prepared}</pre></details>}
      <label>{ui('커밋 메시지')}<input value={message} onChange={e=>setMessage(e.target.value)} maxLength={500}/></label>
      <button className="canvas-github-save" onClick={save} disabled={!prepared||!message.trim()}>{ui('검토한 캔버스를 GitHub에 커밋')}</button>
     </fieldset>
    </section>
    <section className="canvas-github-history"><strong>{ui('저장 이력')}</strong>
     {!history.length&&<p className="canvas-version-history-empty">{ui('저장된 버전이 없습니다. 첫 캔버스 버전을 커밋해보세요.')}</p>}
     {history.map(entry=><article key={entry.sha}><div className="canvas-version-commit-heading"><strong>{entry.message.split('\n')[0]}</strong><code>{entry.sha.slice(0,7)}</code></div><small>{entry.author} · {entry.date?new Date(entry.date).toLocaleString():''}</small><div className="canvas-github-actions"><button disabled={busy} onClick={()=>restore(entry)}>{ui('이 커밋으로 캔버스 복구')}</button><button disabled={busy} onClick={()=>load(entry)}>{ui('코드로 검토')}</button></div></article>)}
     {more&&<button disabled={busy} onClick={next}>{ui('이전 커밋 더 보기')}</button>}
    </section>
   </div>}
  </section>
  <section id="version-panel-branches" role="tabpanel" aria-labelledby="version-tab-branches" hidden={tab!=='branches'}>
   {!connection?connectionPrompt:connection.empty?<div className="canvas-version-empty"><p>{ui('첫 캔버스 버전을 커밋한 뒤 브랜치를 관리할 수 있습니다.')}</p><button onClick={()=>setTab('history')}>{ui('변경 이력으로 이동')}</button></div>:<fieldset disabled={busy}><CanvasBranchPanel api={api} canvasId={canvasId} connection={connection} work={work} onContext={contextLoaded} onConnected={result=>{setConnection(result);setPrepared(null);}}/></fieldset>}
  </section>
 </section>;
}
