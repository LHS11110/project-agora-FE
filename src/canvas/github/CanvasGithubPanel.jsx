import {splitCanvas} from './canvasRepository.js';
import {stable} from '../asCode/manifest.js';
import CanvasRepositoryPreview from './CanvasRepositoryPreview.jsx';
import CanvasCommitGraph from './CanvasCommitGraph.jsx';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ui} from '../../i18n/locale.js';
import {canvasSnapshot,githubCanvasClient,normalizeRepositoryIdentity} from './githubCanvas.js';
import './canvas-github.css';
import GithubGroupPermissions from './GithubGroupPermissions.jsx';
import {tokenScope,storedRepositoryToken,rememberRepositoryToken,forgetRepositoryToken,draftScope,createLocalCommit,localCommits,removeLocalCommit} from './browserRepositoryStore.js';
import {canPeerAccessItem} from '../collaborativeSync.js';
import CanvasBranchPanel from './CanvasBranchPanel.jsx';
import {syncBranchCanvas} from './canvasBranchSync.js';
import {useAuth} from '../../state/AuthContext.jsx';
import {api as request} from '../../api/client.js';
export default function CanvasGithubPanel({api,canvasId,onLoad,active=true}){
 const {token:agoraToken,user}=useAuth();
 const [config,setConfig]=useState(()=>{try{return {...{owner:'',repo:'',branch:'',path:`canvases/${canvasId}.canvas.json`},...JSON.parse(localStorage.getItem(`frelog.github.canvas.${canvasId}`)||'{}')};}catch{return {owner:'',repo:'',branch:'',path:`canvases/${canvasId}.canvas.json`};}});
 const [tab,setTab]=useState('history');
 const [historyPath,setHistoryPath]=useState('');
 const [connectionExpiry,setConnectionExpiry]=useState(null);
 useEffect(()=>{if(!connectionExpiry)return;const timer=setTimeout(()=>{setConnection(null);setPrepared(null);setHistory([]);setGraphRefs([]);setConnectionExpiry(null);setStatus(ui('브랜치 연결의 30분 유지 기간이 만료되었습니다. 다시 연결해주세요.'));},Math.max(0,connectionExpiry-Date.now()));return()=>clearTimeout(timer);},[connectionExpiry]);
 const [graphRefs,setGraphRefs]=useState([]);
 const adoptHistory=result=>{setHistory(result.entries);setGraphRefs(result.refs);setMore(result.more);setPage(1);};
 const [context,setContext]=useState(null),[drafts,setDrafts]=useState([]),[tokenExpiry,setTokenExpiry]=useState(null),[tokenNotice,setTokenNotice]=useState('');
 const cachedToken=useRef(null),tokenEdited=useRef(false);
 const caps=context?.capabilities||{},allowed=action=>caps[action]===true;
 const [token,setToken]=useState(''),[connection,setConnection]=useState(null),[prepared,setPrepared]=useState(null),[history,setHistory]=useState([]),[page,setPage]=useState(1),[more,setMore]=useState(false),[message,setMessage]=useState(`Update canvas ${canvasId}`),[status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[commitSha,setCommitSha]=useState('');
 const feedback=useRef(null);
 useEffect(()=>{if(error||status)feedback.current?.scrollIntoView({block:'nearest'});},[error,status]);
 const configEdits=useRef(0);
 const adopt=data=>{setContext(data);if(data.project?.target&&data.currentBranch)setConfig({...data.project.target,branch:data.currentBranch});};
 useEffect(()=>{if(!active)return;let mounted=true;const revision=configEdits.current;request(`/api/canvases/${canvasId}/github`,{token:agoraToken}).then(data=>{if(mounted){setContext(data);if(revision===configEdits.current&&data.project?.target&&data.currentBranch)setConfig({...data.project.target,branch:data.currentBranch});}}).catch(()=>{});return()=>{mounted=false;};},[canvasId,agoraToken,active]);
 const scope=tokenScope(user,{owner:typeof config.owner==='string'?config.owner:'',repo:typeof config.repo==='string'?config.repo:''});
 useEffect(()=>{let active=true;tokenEdited.current=false;cachedToken.current=null;setToken('');setTokenExpiry(null);storedRepositoryToken(scope).then(saved=>{if(active&&!tokenEdited.current&&saved){cachedToken.current={...saved,scope};setToken(saved.token);setTokenExpiry(saved.expiresAt);setTokenNotice('저장된 GitHub 토큰을 불러왔습니다.');}}).catch(()=>{});return()=>{active=false;};},[scope]);
 useEffect(()=>{if(!tokenExpiry)return;const timer=setTimeout(()=>{forgetRepositoryToken(scope).catch(()=>{});setToken('');setTokenExpiry(null);setConnection(null);cachedToken.current=null;setTokenNotice('GitHub 토큰의 24시간 보관 기간이 만료되었습니다. 다시 입력해주세요.');},Math.max(0,tokenExpiry-Date.now()));return()=>clearTimeout(timer);},[tokenExpiry,scope]);
 const refreshDrafts=()=>localCommits(draftScope(user,canvasId)).then(setDrafts).catch(()=>{});
 useEffect(()=>{refreshDrafts();},[canvasId,user?.email]);
 const authorize=async action=>{const data=await request(`/api/canvases/${canvasId}/github/authorize`,{method:'POST',token:agoraToken,body:{...connection?.target||config,action}});setContext(data);return data;};
 const snapshot=()=>{const current=api.read();if(!allowed('manage')&&connection?.file){const remote=JSON.parse(connection.file.source);const hidden=Object.fromEntries(Object.entries(remote.items||{}).filter(([,item])=>!canPeerAccessItem(item,{groups:context?.readGroups||[]})));current.items={...hidden,...current.items};}return canvasSnapshot(current);};

 const running=useRef(false),controller=useRef(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[]);
 const work=async action=>{
  if(running.current)return;running.current=true;setBusy(true);setError('');setStatus('');setCommitSha('');
  const abort=new AbortController();controller.current=abort;const timeout=setTimeout(()=>abort.abort(),60000);
  try{await action(githubCanvasClient(token,{signal:abort.signal}),abort.signal);}catch(e){if(e.service==='github'&&e.status===401){forgetRepositoryToken(scope).catch(()=>{});cachedToken.current=null;setTokenExpiry(null);setToken('');}if(alive.current)setError(e.name==='AbortError'?ui('요청 시간이 초과되었습니다. GitHub 이력에서 결과를 확인한 뒤 다시 시도해주세요.'):e.message);}
  finally{clearTimeout(timeout);if(alive.current)setBusy(false);running.current=false;}
 };
 const update=(field,value)=>{configEdits.current++;setConfig(c=>({...c,[field]:value}));setConnection(null);setPrepared(null);setHistory([]);setStatus('');setError('');setCommitSha('');};
 const connect=()=>{setConnection(null);setPrepared(null);setHistory([]);return work(async client=>{
  const latest=await request(`/api/canvases/${canvasId}/github`,{token:agoraToken});setContext(latest);
  const manage=latest.capabilities?.manage===true;
  if(!manage&&!latest.project?.target)throw new Error('관리자가 먼저 GitHub 저장소를 연결해야 합니다.');
  const selected=manage?config:{...latest.project.target,branch:latest.currentBranch};
  const result=await client.connect(selected);if(!alive.current)return;
  const bound=manage?await request(`/api/canvases/${canvasId}/github/bind`,{method:'POST',token:agoraToken,body:result.target}):latest;adopt(bound);
  if(result.file)canvasSnapshot(JSON.parse(result.file.source));
  setConnection(result);setConnectionExpiry(Date.now()+30*60*1000);setConfig(result.target);setPrepared(null);setPage(1);
  const key=tokenScope(user,result.target);
  if(cachedToken.current?.scope!==key||cachedToken.current?.token!==token){try{const expiresAt=await rememberRepositoryToken(key,token);cachedToken.current={scope:key,token,expiresAt};setToken(token);setTokenExpiry(expiresAt);setTokenNotice('GitHub 토큰을 이 출처에 24시간 보관합니다.');}catch{setTokenNotice('브라우저 보관을 사용할 수 없어 현재 창에서만 토큰을 사용합니다.');}}
  try{localStorage.setItem(`frelog.github.canvas.${canvasId}`,JSON.stringify(result.target));}catch{}
  const graph=result.empty?{entries:[],refs:[],more:false}:await client.graphHistory(result.target);if(!alive.current)return;adoptHistory(graph);setHistoryPath('');setTab('history');setStatus(result.empty?ui('빈 저장소에 연결했습니다. 현재 캔버스를 커밋하면 첫 파일과 기본 브랜치가 생성됩니다.'):result.file?ui('저장소를 연결했습니다. 현재 캔버스를 검토한 뒤 커밋하세요.'):ui('새 캔버스 파일을 생성할 준비가 되었습니다.'));
 });};
 const prepare=async()=>{try{await authorize('commit');const source=snapshot();splitCanvas(source,connection.target.path);setPrepared(source);setError('');setStatus(ui('현재 캔버스 스냅샷을 준비했습니다. 코드와 저장 대상을 확인해주세요.'));}catch(e){setError(e.message);}};
 const snapshotForSave=snapshot;
 const save=()=>work(async client=>{
  await authorize('commit');await authorize('push');
  if(!prepared||!connection)return;
  const snapshot=prepared;
  if(snapshotForSave()!==snapshot)throw new Error(ui('검토 후 캔버스가 변경되었습니다. 현재 캔버스를 다시 검토해주세요.'));
  if(connection.file?.split&&stable(JSON.parse(connection.file.source))===stable(JSON.parse(snapshot))){setStatus(ui('저장소와 같은 내용입니다. 새 커밋을 만들지 않았습니다.'));return;}
  let result;
  try{
   result=await client.commitSplit(connection.target,snapshot,message,connection.file?.sha,{empty:connection.empty,baseSource:connection.file?.source});if(!alive.current)return;
  }catch(e){if(alive.current){setPrepared(null);setConnection(null);}throw e;}
  setConnection({...connection,empty:false,file:result.file||{sha:result.content.sha,source:snapshot}});setPrepared(null);setCommitSha(result.commit.sha);setStatus(ui('캔버스를 GitHub에 커밋했습니다.'));
  try{const graph=await client.graphHistory(connection.target,1,{path:historyPath});if(alive.current)adoptHistory(graph);}
  catch{if(alive.current)setError(ui('커밋은 완료됐지만 이력을 불러오지 못했습니다. 저장소를 다시 연결해주세요.'));}
 });
 const load=entry=>work(async client=>{const source=await client.read(connection.target,entry.sha);const parsed=JSON.parse(source);canvasSnapshot(parsed);if(!alive.current)return;onLoad(JSON.stringify({...parsed,mode:'replace',remove:[]},null,2));setPrepared(null);setStatus(ui('선택한 버전을 편집기로 불러왔습니다. 변경 검토 후 적용하세요.'));});
 const restore=entry=>work(async(client,signal)=>{await authorize('restore');const source=await client.read(connection.target,entry.sha);canvasSnapshot(JSON.parse(source));await syncBranchCanvas({canvasId,token:agoraToken,user,source,signal});if(alive.current){setPrepared(null);setStatus(ui('커밋 내용으로 캔버스를 복구하고 서버 저장을 확인했습니다.'));}});
 const saveLocal=async()=>{try{await authorize('commit');if(!prepared||snapshot()!==prepared)throw new Error('현재 캔버스를 다시 검토해주세요.');await createLocalCommit(draftScope(user,canvasId),{source:prepared,message,target:connection.target,sha:connection.file?.sha,empty:connection.empty,baseSource:connection.file?.source});setPrepared(null);await refreshDrafts();setStatus('로컬 커밋을 저장했습니다. 푸시 권한이 있으면 GitHub에 전송할 수 있습니다.');}catch(e){setError(e.message);}};
 const pushDraft=draft=>work(async client=>{await authorize('push');if(JSON.stringify(draft.target)!==JSON.stringify(connection.target))throw new Error('이 커밋은 다른 저장소나 브랜치에 속합니다.');const result=await client.commitSplit(draft.target,draft.source,draft.message,draft.sha,{empty:draft.empty,baseSource:draft.baseSource});await removeLocalCommit(draft.id);await refreshDrafts();setConnection({...connection,empty:false,file:result.file||{sha:result.content.sha,source:draft.source}});setCommitSha(result.commit.sha);setStatus('로컬 커밋을 GitHub에 푸시했습니다.');adoptHistory(await client.graphHistory(connection.target,1,{path:historyPath}));});
 const savePolicy=async groups=>{try{setError('');const data=await request(`/api/canvases/${canvasId}/github/permissions`,{method:'POST',body:{groups},token:agoraToken});adopt(data);setStatus('GitHub 그룹 권한을 저장했습니다.');}catch(e){setError(e.message);}};
 const discardDraft=async id=>{try{await removeLocalCommit(id);await refreshDrafts();}catch(e){setError(e.message);}};
 const forgetToken=async()=>{try{await forgetRepositoryToken(scope);cachedToken.current=null;setToken('');setTokenExpiry(null);setConnection(null);setTokenNotice('저장된 GitHub 토큰을 삭제했습니다.');}catch(e){setError(e.message);}};
 const contextLoaded=data=>{setContext(data);};
 const refresh=()=>work(async client=>{adoptHistory(await client.graphHistory(connection.target,1,{path:historyPath}));});
 const next=()=>work(async client=>{const graph=await client.graphHistory(connection.target,page+1,{path:historyPath});if(alive.current){setHistory(old=>{const merged=new Map(old.map(entry=>[entry.sha,entry]));for(const entry of graph.entries)merged.set(entry.sha,{...entry,branches:[...new Set([...(merged.get(entry.sha)?.branches||[]),...(entry.branches||[])])]});return [...merged.values()];});setGraphRefs(graph.refs);setPage(page+1);setMore(graph.more);}});
 const filterHistory=path=>work(async client=>{const graph=await client.graphHistory(connection.target,1,{path});adoptHistory(graph);setHistoryPath(path);});
 const historyFiles=useMemo(()=>{try{return connection?.file?Object.keys(splitCanvas(connection.file.source,connection.target.path)).sort():[];}catch{return [];}},[connection?.file?.source,connection?.target.path]);
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
     {[['owner','GitHub 소유자'],['repo','저장소 이름 또는 URL']].map(([field,label])=><label key={field}>{ui(label)}<input value={config[field]} disabled={!allowed('manage')} onChange={e=>update(field,e.target.value)} placeholder={field==='owner'?'octocat':ui('Hello-World 또는 저장소 URL')} onBlur={()=>{try{const normalized=normalizeRepositoryIdentity(config.owner,config.repo);setConfig(c=>({...c,...normalized}));}catch(e){setError(e.message);}}} autoComplete="off" spellCheck={false}/></label>)}
     <label className="canvas-github-token">{ui('GitHub 토큰')}<input type="password" autoComplete="off" value={token} onChange={e=>{tokenEdited.current=true;setTokenExpiry(null);setTokenNotice('');setToken(e.target.value);setConnection(null);setPrepared(null);setHistory([]);}}/></label>
    </div>
    <small>{ui('예: github.com/octocat/Hello-World → GitHub 소유자 octocat · 저장소 Hello-World')}</small>
    <small>{ui('대상 저장소의 Contents 읽기·쓰기 권한이 있는 Fine-grained 토큰을 사용하세요. 토큰은 이 출처의 브라우저 저장소에 24시간 암호화하여 보관합니다.')}</small>
    {!allowed('manage')&&<p>{ui('저장소 설정은 관리자만 변경할 수 있습니다. 연결된 저장소를 불러와 작업하세요.')}</p>}
    {tokenNotice&&<small>{ui(tokenNotice)}{tokenExpiry?' · '+new Date(tokenExpiry).toLocaleString():''}</small>}
    <button type="button" onClick={forgetToken}>{ui('저장된 GitHub 토큰 삭제')}</button>
    <details className="canvas-github-advanced"><summary>{ui('고급 연결 설정')}</summary><div className="canvas-github-fields">{[['branch','브랜치'],['path','파일 경로']].map(([field,label])=><label key={field}>{ui(label)}<input value={config[field]} disabled={!allowed('manage')} onChange={e=>update(field,e.target.value)} placeholder={field==='branch'?ui('기본 브랜치'):undefined}/></label>)}</div></details>
    <button type="button" className="canvas-github-save" onClick={connect} aria-busy={busy}>{ui(busy?'GitHub 요청 중…':allowed('manage')?'저장소 연결 · 새로고침':'연결된 저장소 불러오기')}</button>
   </fieldset>
   {allowed('manage')&&<GithubGroupPermissions context={context} busy={busy} onSave={savePolicy}/>}
  </section>
  <section id="version-panel-history" role="tabpanel" aria-labelledby="version-tab-history" hidden={tab!=='history'}>
   {!connection?connectionPrompt:<div className="canvas-version-history-layout">
    <section className="canvas-version-save-card"><strong>{ui('현재 캔버스 저장')}</strong><p>{ui('현재 보이는 객체를 JSON 스냅샷으로 저장합니다. 이미지·PDF 원본, VM 파일과 계정 설정은 포함하지 않습니다.')}</p>
     <fieldset disabled={busy}><button disabled={!allowed('commit')} onClick={prepare}>{ui('현재 캔버스 검토')}</button>
      {prepared&&<CanvasRepositoryPreview source={prepared} previous={connection.file?.source} previousSplit={connection.file?.split} path={connection.target.path}/>}
      <label>{ui('커밋 메시지')}<input value={message} onChange={e=>setMessage(e.target.value)} maxLength={500}/></label>
      <button onClick={saveLocal} disabled={!allowed('commit')||!prepared||!message.trim()}>{ui('로컬 커밋 저장')}</button>
      <button className="canvas-github-save" onClick={save} disabled={!allowed('commit')||!allowed('push')||!prepared||!message.trim()}>{ui('검토한 캔버스를 GitHub에 커밋')}</button>
     </fieldset>
     {drafts.length>0&&<div className="canvas-github-drafts"><strong>{ui('푸시 대기 중인 로컬 커밋')}</strong>{drafts.map(draft=><div key={draft.id}><span>{draft.message}</span><button disabled={busy||!allowed('push')} onClick={()=>pushDraft(draft)}>{ui('푸시')}</button><button onClick={()=>discardDraft(draft.id)}>{ui('로컬 커밋 삭제')}</button></div>)}</div>}
    </section>
    <section className="canvas-github-history"><div className="canvas-commit-graph-heading"><strong>{ui('저장 이력')}</strong><button disabled={busy||connection.empty} onClick={refresh}>{ui('새로고침')}</button></div><small>{ui('공통 조상부터 커밋 수에 따라 아래에서 위로 배치합니다. 브랜치마다 필요한 행만 사용합니다.')}</small><small>{ui(historyPath?'선택한 파일의 변경 이력입니다. 복구 시에는 해당 커밋의 전체 캔버스를 적용합니다.':'현재 브랜치의 이력만 표시합니다. 이미 병합된 커밋은 포함됩니다.')}</small>
     <label>{ui('변경 이력 범위')}<select aria-label={ui('변경 이력 범위')} value={historyPath} disabled={busy} onChange={e=>filterHistory(e.target.value)}><option value="">{ui('전체 파일')}</option>{historyFiles.map(path=><option key={path} value={path}>{path.endsWith('/permissions.json')?ui('객체 그룹 권한'):path.includes('/objects/')?path.split('/').at(-1):ui('캔버스 구성')}</option>)}</select></label>
     {!history.length&&<p className="canvas-version-history-empty">{ui(historyPath?'이 파일의 변경 이력이 없습니다.':'저장된 버전이 없습니다. 첫 캔버스 버전을 커밋해보세요.')}</p>}
     <CanvasCommitGraph entries={history} refs={graphRefs} branch={connection.target.branch} busy={busy} canRestore={allowed('restore')} onRestore={restore} onInspect={load}/>
     {more&&<button disabled={busy} onClick={next}>{ui('이전 커밋 더 보기')}</button>}
    </section>
   </div>}
  </section>
  <section id="version-panel-branches" role="tabpanel" aria-labelledby="version-tab-branches" hidden={tab!=='branches'}>
   {!connection?connectionPrompt:connection.empty?<div className="canvas-version-empty"><p>{ui('첫 캔버스 버전을 커밋한 뒤 브랜치를 관리할 수 있습니다.')}</p><button onClick={()=>setTab('history')}>{ui('변경 이력으로 이동')}</button></div>:<fieldset disabled={busy}><CanvasBranchPanel context={context} authorize={authorize} caps={caps} api={api} canvasId={canvasId} connection={connection} work={work} onContext={contextLoaded} onConnected={result=>{setConnection(result);setPrepared(null);}}/></fieldset>}
  </section>
 </section>;
}
