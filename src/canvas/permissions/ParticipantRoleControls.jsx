import {useId,useMemo,useState} from 'react';
import {ui} from '../../i18n/locale.js';
import {useUiLocale} from '../../i18n/useUiLocale.js';
import {managementError} from './managementError.js';
import './canvas-access-management.css';
const handle=person=>JSON.stringify([person.nickname,person.tag_number]);
const display=person=>`${person.nickname}#${person.tag_number}`;
export default function ParticipantRoleControls({settings,pending,onRequest,onRemoveParticipant}){
 useUiLocale();
 const id=useId(),[query,setQuery]=useState(''),[roleQuery,setRoleQuery]=useState(''),[selected,setSelected]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const memberships=useMemo(()=>{
  const map=new Map();for(const [group,people] of Object.entries(settings?.groups||{}))for(const person of people){const key=handle(person);if(!map.has(key))map.set(key,[]);map.get(key).push(group);}return map;
 },[settings?.groups]);
 if(!settings?.can_manage)return null;
 const groups=Object.keys(settings.groups||{}),participants=(settings.participants||[]).filter(person=>display(person).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const blocked=pending||busy;
 const change=async(person,group,enabled)=>{
  const roles=new Set(memberships.get(handle(person))||[]);if(enabled)roles.add(group);else roles.delete(group);
  setBusy(true);setError('');try{await onRequest('participant_groups',{nickname:person.nickname,tag_number:person.tag_number,groups:[...roles]});}catch(e){setError(e);}finally{setBusy(false);}
 };
 return <section className="participant-roles" aria-label={ui('참여자 역할')} aria-busy={busy}><h3>{ui('참여자 역할')}</h3><p>{ui('역할 배지를 눌러 그룹을 추가하거나 제거하세요. 그룹 권한과 소속은 캔버스 관리자만 변경할 수 있습니다.')}</p>
  <input className="plain-input" aria-label={ui('참여자 검색')} placeholder={ui('닉네임 또는 태그로 검색')} value={query} onChange={e=>setQuery(e.target.value)}/>
  <div className="participant-role-list">{participants.map(person=>{
   const key=handle(person),roles=memberships.get(key)||[],owner=settings.owner&&handle(settings.owner)===key;
   const implicit=settings.visibility==='public'&&!roles.includes(settings.initial_group)?settings.initial_group:null;
   return <div className="participant-role-row" key={key} role="group" aria-label={display(person)}><div className="participant-role-person"><span className="participant-role-avatar" aria-hidden="true">{person.nickname.slice(0,1)}</span><strong>{display(person)}</strong>{onRemoveParticipant&&<button type="button" className="participant-role-remove" disabled={blocked||owner} aria-label={ui('{v0} 참여자 제외',{v0:person.nickname})} title={ui('참여자 제외')} onClick={()=>onRemoveParticipant(person)}>×</button>}</div>
    <div className="participant-role-badges">{roles.map(group=><span className={`canvas-role-badge${group==='admin-group'?' is-admin':''}`} key={group}><i aria-hidden="true"/>{group}<button type="button" disabled={blocked||(owner&&group==='admin-group')} aria-label={ui('{person}의 {group} 역할 제거',{person:display(person),group})} onClick={()=>change(person,group,false)}>×</button></span>)}
     {implicit&&<span className="canvas-role-badge is-inherited" title={ui('공개 캔버스의 기본 역할')}>{implicit} · {ui('기본')}</span>}
     <button type="button" className="participant-role-add" disabled={blocked} aria-label={ui('{person} 역할 지정',{person:display(person)})} aria-expanded={selected===key} aria-controls={id} onClick={()=>{setSelected(selected===key?null:key);setRoleQuery('');}}>＋ <span>{ui('역할')}</span></button>
    </div>{selected===key&&<div className="participant-role-picker" id={id}><input className="plain-input" autoFocus aria-label={ui('역할 검색')} placeholder={ui('그룹 이름 검색')} value={roleQuery} onChange={e=>setRoleQuery(e.target.value)}/>
     <div>{groups.filter(group=>group.toLocaleLowerCase().includes(roleQuery.toLocaleLowerCase())).map(group=><label key={group}><input type="checkbox" checked={roles.includes(group)||implicit===group} disabled={blocked||(owner&&group==='admin-group')||implicit===group} aria-label={ui('{person} {group} 역할',{person:display(person),group})} onChange={e=>change(person,group,e.target.checked)}/><span>{group}</span><small>{['read','write','execute'].filter(cap=>settings.group_permissions?.[group]?.[cap]).map(cap=>ui({read:'읽기',write:'쓰기',execute:'실행'}[cap])).join(' · ')||ui('접근 불가')}</small></label>)}</div>
     <button type="button" className="participant-role-close" onClick={()=>setSelected(null)}>{ui('완료')}</button>
    </div>}
   </div>;
  })}{!participants.length&&<p>{ui('일치하는 참여자가 없습니다.')}</p>}</div>
  <small>{ui('새 객체는 생성자의 모든 소속 그룹에 공유됩니다. 같은 그룹이 하나라도 있으면 읽기 권한에 따라 볼 수 있습니다. 캔버스 관리자는 모든 객체를 볼 수 있습니다.')}</small>
  {error&&<p className="access-management-error" role="alert">{managementError(error)}</p>}
 </section>;
}
