import {ensureCanvasPasswordGrant} from '../canvasPasswordSession.js';
import {useEffect,useRef,useState} from 'react';
import {api as request} from '../../api/client.js';
import {useAuth} from '../../state/AuthContext.jsx';
import {useNavigate} from '../../routing.jsx';
import {ui} from '../../i18n/locale.js';
import {syncBranchCanvas} from './canvasBranchSync.js';
import {stable} from '../asCode/manifest.js';
import {canvasPasswordGrantKey,readCanvasPasswordGrant,saveCanvasPasswordGrant} from '../canvasAccess.js';
import {canvasSnapshot} from './githubCanvas.js';

export default function CanvasBranchPanel({canvasId,api,connection,work,onConnected,onContext,context:projectContext,authorize,caps={}}){
 const {token,user}=useAuth(),navigate=useNavigate();
 const [context,setContext]=useState(projectContext),[branches,setBranches]=useState([]),[selected,setSelected]=useState(''),[name,setName]=useState(''),[status,setStatus]=useState('');
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>setContext(projectContext),[projectContext]);
 const [prTitle,setPrTitle]=useState('Canvas changes'),[prBody,setPrBody]=useState(''),[prUrl,setPrUrl]=useState('');

 const target=connection.target;
 const bind=async()=>{const data=await request(`/api/canvases/${canvasId}/github`,{token});if(alive.current){setContext(data);onContext?.(data);}return data;};
 const checkout=(create=false)=>work(async(client,signal)=>{
  setStatus('');await authorize(create?'create_branch':'switch_branch');const project=await bind();const branch=create?name.trim():selected;
  if(!branch)throw new Error('브랜치를 선택해주세요.');
  if(create)await client.createBranch(target,branch);
  const remote=await client.connect({...target,branch});if(!remote.file)throw new Error('선택한 브랜치에 캔버스 파일이 없습니다. 먼저 현재 캔버스를 커밋해주세요.');
  canvasSnapshot(JSON.parse(remote.file.source));
  const binding=await request(`/api/canvases/${canvasId}/github/branches`,{method:'POST',body:{branch,canvas_password_token:await ensureCanvasPasswordGrant(canvasPasswordGrantKey(canvasId,user))},token});
  if(binding.canvas_password_token)saveCanvasPasswordGrant(canvasPasswordGrantKey(binding.canvasId,user),binding.canvas_password_token);
  if(!binding.initialized){await syncBranchCanvas({canvasId:binding.canvasId,token,user,source:remote.file.source,signal});await request(`/api/canvases/${canvasId}/github/initialized`,{method:'POST',body:{branch},token});}
  const config={...remote.target};localStorage.setItem(`frelog.github.canvas.${binding.canvasId}`,JSON.stringify(config));
  if(alive.current){if(caps.switch_branch)navigate(`/canvases/${binding.canvasId}`);else setStatus('브랜치와 캔버스를 생성했습니다. 이동 권한이 없어 현재 캔버스를 유지합니다.');}
 });
 const list=()=>work(async client=>{const p=await bind();const values=await client.branches(target);if(alive.current){setContext(p);setBranches(values);setSelected(values.find(b=>b!==target.branch)||values[0]||'');setStatus('브랜치 목록을 불러왔습니다.');}});
 const latest=()=>work(async(client,signal)=>{
  await authorize('restore');await bind();const remote=await client.connect(target);if(!remote.file)throw new Error('브랜치에 캔버스 파일이 없습니다.');
  await syncBranchCanvas({canvasId,token,user,source:remote.file.source,signal});if(alive.current){onConnected(remote);setStatus('최신 커밋을 캔버스에 복구하고 서버 저장을 확인했습니다.');}
 });
 const merge=()=>work(async(client,signal)=>{
  await authorize('merge');const project=await bind();if(!selected||selected===target.branch)throw new Error('병합할 다른 브랜치를 선택해주세요.');
  if(connection.file&&stable(api.read().items)!==stable(JSON.parse(connection.file.source).items))throw new Error('현재 캔버스의 변경을 먼저 커밋한 뒤 병합해주세요.');
  const head=await client.connect({...target,branch:selected});if(!head.file||!connection.file)throw new Error('두 브랜치에 캔버스 파일이 필요합니다.');
  const sourceRoom=project.project.branches?.[selected];
  if(sourceRoom?.initialized)await syncBranchCanvas({canvasId:sourceRoom.canvasId,token,user,expected:head.file.source,signal});
  await syncBranchCanvas({canvasId,token,user,expected:connection.file.source,signal});
  // GitHub rejects textual conflicts instead of choosing one user's version.
  const merged=await client.merge(target,selected);if(!merged.file)throw new Error('병합 결과에 캔버스 파일이 없습니다.');
  try{await syncBranchCanvas({canvasId,token,user,source:merged.file.source,expected:connection.file.source,signal});}
  catch(e){throw new Error('GitHub 병합은 완료됐지만 캔버스 반영은 완료되지 않았습니다. 최신 커밋 복구로 다시 적용해주세요. '+e.message);}
  if(alive.current){onConnected(merged);setStatus('브랜치를 병합하고 변경사항을 대상 캔버스에 저장·공유했습니다.');}
 });
 const pr=()=>work(async client=>{await authorize('pr');const result=await client.pullRequest(target,{base:selected,title:prTitle,body:prBody});if(alive.current){setPrUrl(`https://github.com/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/pull/${Number(result.number)}`);setStatus('PR을 생성했습니다.');}});
 const current=context?.currentBranch;
 return <div className="canvas-github-branches">
  <strong>{ui('브랜치별 캔버스')}</strong><p>{ui('브랜치마다 별도 캔버스와 실시간 편집 방을 사용합니다. 브랜치 전환은 다른 방의 내용을 바꾸지 않습니다.')}</p>
  {current&&<small>{ui('현재 브랜치')} · {current} · #{canvasId}</small>}
  <div className="canvas-github-actions"><button onClick={list}>{ui('브랜치 연결 · 목록 갱신')}</button><button disabled={!caps.restore} onClick={latest}>{ui('브랜치 최신 커밋 복구')}</button></div>
  <label>{ui('대상 브랜치')}<select aria-label={ui('대상 브랜치')} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">{ui('브랜치 선택')}</option>{branches.map(b=><option key={b}>{b}</option>)}</select></label>
  <div className="canvas-github-actions"><button disabled={!caps.switch_branch||!selected||(!caps.create_branch&&!context?.project?.branches?.[selected])} onClick={()=>checkout(false)}>{ui('별도 브랜치 캔버스로 이동')}</button><button disabled={!caps.merge||!selected||selected===target.branch} onClick={merge}>{ui('선택 브랜치를 현재 브랜치에 병합')}</button></div>
  <label>{ui('새 브랜치 이름')}<input value={name} onChange={e=>setName(e.target.value)} placeholder="feature/canvas"/></label><button disabled={!caps.create_branch||!name.trim()} onClick={()=>checkout(true)}>{ui('새 브랜치와 캔버스 만들기')}</button>
  <section className="canvas-github-pr"><strong>{ui('Pull Request')}</strong><small>{ui('PR 생성에는 GitHub 토큰의 Pull requests 쓰기 권한도 필요합니다.')}</small><label>{ui('PR 제목')}<input value={prTitle} onChange={e=>setPrTitle(e.target.value)}/></label><label>{ui('PR 설명')}<textarea value={prBody} onChange={e=>setPrBody(e.target.value)}/></label><button disabled={!caps.pr||!selected||selected===target.branch||!prTitle.trim()} onClick={pr}>{ui('선택 브랜치로 PR 생성')}</button>{prUrl&&<a href={prUrl} target="_blank" rel="noreferrer">{ui('PR 보기')}</a>}</section>
  {status&&<p role="status">{ui(status)}</p>}
 </div>;
}
