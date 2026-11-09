import {useEffect,useState} from 'react';
import {ui} from '../../i18n/locale.js';
const actions=[['commit','커밋'],['push','푸시'],['pr','PR 생성'],['create_branch','브랜치 생성'],['switch_branch','브랜치 이동']];
export default function GithubGroupPermissions({context,onSave,busy}){
 const [policy,setPolicy]=useState(context?.project?.permissions||{});
 useEffect(()=>setPolicy(context?.project?.permissions||{}),[context?.project?.permissions]);
 return <details className="canvas-github-policy"><summary>{ui('그룹별 GitHub 작업 권한')}</summary><p>{ui('일반 그룹은 기본 거부입니다. 브랜치 생성에는 캔버스 쓰기 권한도 필요합니다.')}</p><div className="canvas-github-policy-scroll"><table><thead><tr><th>{ui('그룹')}</th>{actions.map(([id,label])=><th key={id}>{ui(label)}</th>)}</tr></thead><tbody>{(context?.groups||[]).filter(g=>g!=='admin-group').map(group=><tr key={group}><th>{group}</th>{actions.map(([id,label])=><td key={id}><input type="checkbox" aria-label={`${group} · ${ui(label)}`} checked={(policy[group]||[]).includes(id)} disabled={busy} onChange={e=>setPolicy(old=>({...old,[group]:e.target.checked?[...new Set([...(old[group]||[]),id])]:(old[group]||[]).filter(v=>v!==id)}))}/></td>)}</tr>)}</tbody></table></div><button disabled={busy} onClick={()=>onSave(policy)}>{ui('GitHub 권한 저장')}</button></details>;
}
