import {managementError} from './managementError.js';
import {useEffect,useState} from 'react';
import {ui} from '../../i18n/locale.js';
import './canvas-access-management.css';
const handle=person=>JSON.stringify([person.nickname,person.tag_number]);
export default function GroupManagementControls({settings,pending,onRequest}){
 const groups=settings?.groups||{};
 const [selected,setSelected]=useState(settings?.initial_group||'default'),[name,setName]=useState(''),[renamed,setRenamed]=useState(''),[members,setMembers]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmDelete,setConfirmDelete]=useState(false);
 const blocked=pending||busy||!settings?.can_manage;
 useEffect(()=>{if(!Object.hasOwn(groups,selected))setSelected(Object.keys(groups)[0]||'default');setMembers((groups[selected]||[]).map(handle));setRenamed(selected);setConfirmDelete(false);},[settings,selected]);
 if(!settings?.can_manage)return null;
 const run=async(field,value,done)=>{setBusy(true);setError('');try{await onRequest(field,value);done?.();}catch(e){setError(e);}finally{setBusy(false);}};
 return <section className="canvas-access-management" aria-label={ui('그룹 관리')}><h3>{ui('그룹 관리')}</h3><p>{ui('그룹을 만들고 이름, 참여자와 새 참여자의 초기 그룹을 관리합니다.')}</p>
  <form className="setting-row" onSubmit={e=>{e.preventDefault();if(name.trim())run('group_create',{name:name.trim()},()=>{setName('');setSelected(name.trim());});}}>
   <input className="plain-input" aria-label={ui('새 그룹 이름')} placeholder={ui('새 그룹 이름')} value={name} maxLength={80} disabled={blocked} onChange={e=>setName(e.target.value)}/><button className="button button-outline" disabled={blocked||!name.trim()}>{ui('그룹 추가')}</button>
  </form><small>{ui('새 그룹은 읽기만 허용됩니다. 아래 권한 표에서 쓰기·실행을 추가할 수 있습니다.')}</small>
  <label className="form-field"><span>{ui('초기 참여 그룹')}</span><select className="plain-input" aria-label={ui('초기 참여 그룹')} disabled={blocked} value={settings.initial_group||'default'} onChange={e=>run('group_initial',{name:e.target.value})}>{Object.keys(groups).filter(group=>group!=='admin-group').map(group=><option key={group} value={group} disabled={settings.group_permissions?.[group]?.read!==true}>{group}</option>)}</select></label>
  <small>{ui('공개 캔버스에서는 초기 그룹의 권한이 로그인한 방문자에게도 적용됩니다.')}</small>
  <label className="form-field"><span>{ui('관리할 그룹')}</span><select className="plain-input" aria-label={ui('관리할 그룹')} value={selected} disabled={blocked} onChange={e=>setSelected(e.target.value)}>{Object.keys(groups).map(group=><option key={group} value={group}>{group} · {groups[group].length}</option>)}</select></label>
  <details className="access-management-details"><summary>{ui('그룹 참여자와 이름 편집')}</summary>
   <div className="setting-row"><input className="plain-input" aria-label={ui('그룹 이름 변경')} disabled={blocked||selected==='admin-group'} value={renamed} maxLength={80} onChange={e=>setRenamed(e.target.value)}/><button className="button button-outline" disabled={blocked||selected==='admin-group'||!renamed.trim()||renamed.trim()===selected} onClick={()=>run('group_rename',{name:selected,new_name:renamed.trim()},()=>setSelected(renamed.trim()))}>{ui('이름 변경')}</button></div>
   <div className="access-management-members">{(settings.participants||[]).map(person=><label key={handle(person)}><input type="checkbox" checked={members.includes(handle(person))} disabled={blocked||(selected==='admin-group'&&settings.owner&&handle(settings.owner)===handle(person))} onChange={e=>setMembers(current=>e.target.checked?[...current,handle(person)]:current.filter(key=>key!==handle(person)))}/><span>{person.nickname}#{person.tag_number}</span></label>)}</div>
   <button className="button button-outline" disabled={blocked||JSON.stringify([...members].sort())===JSON.stringify((groups[selected]||[]).map(handle).sort())} onClick={()=>run('group_members',{name:selected,members:(settings.participants||[]).filter(person=>members.includes(handle(person)))})}>{ui('그룹 참여자 저장')}</button>
   <small>{ui('소유자는 관리자 그룹에서 제외할 수 없습니다. 여러 그룹의 권한은 합산됩니다.')}</small>
   {confirmDelete?<div className="access-management-confirm"><p>{ui('그룹을 삭제하면 소속 참여자는 해당 그룹의 권한을 잃습니다. 계속할까요?')}</p><button className="button button-outline" disabled={blocked} onClick={()=>run('group_delete',{name:selected})}>{ui('그룹 삭제 확인')}</button><button className="button button-outline" disabled={blocked} onClick={()=>setConfirmDelete(false)}>{ui('취소')}</button></div>:<button className="button button-outline" disabled={blocked||selected==='admin-group'||selected===settings.initial_group} onClick={()=>setConfirmDelete(true)}>{ui('그룹 삭제')}</button>}
   <small>{ui('초기 그룹과 객체가 사용 중인 그룹은 삭제할 수 없습니다. 이름 변경 시 객체 권한도 함께 변경됩니다.')}</small>
  </details>{error&&<p className="access-management-error" role="alert">{managementError(error)}</p>}
 </section>;
}
