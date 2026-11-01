import {useEffect,useState} from 'react';
import {ui} from '../../i18n/locale.js';
import './group-permissions.css';
export default function GroupPermissionsControls({settings,pending,onUpdate}){
 const [policies,setPolicies]=useState(settings?.group_permissions||{});
 useEffect(()=>setPolicies(settings?.group_permissions||{}),[settings]);
 const update=(group,key,enabled)=>setPolicies(current=>{
  const next={...current[group],[key]:enabled};
  if(key==='read'&&!enabled){next.write=false;next.execute=false;}
  if(key!=='read'&&enabled)next.read=true;
  return {...current,[group]:next};
 });
 if(!Object.keys(policies).length)return null;
 return <section className="group-permissions-controls" aria-label={ui('그룹 접근 권한')}><h3>{ui('그룹 접근 권한')}</h3><p>{ui('그룹별로 읽기·쓰기·실행 권한을 설정합니다.')}</p>
  <div className="group-permissions-table"><div className="group-permissions-header"><span>{ui('그룹')}</span>{['읽기','쓰기','실행'].map(label=><span key={label}>{ui(label)}</span>)}</div>
   {Object.entries(policies).map(([group,policy])=><div className="group-permissions-row" key={group}><span title={group}>{group}</span>{[['read','읽기'],['write','쓰기'],['execute','실행']].map(([key,label])=><label key={key}><input type="checkbox" checked={policy[key]===true} disabled={pending||!settings.can_manage||group==='admin-group'} aria-label={ui('{group} {permission} 권한',{group,permission:ui(label)})} onChange={event=>update(group,key,event.target.checked)}/></label>)}</div>)}
  </div><small>{ui('여러 그룹에 속하면 허용된 권한을 합산합니다. 관리자 그룹의 권한은 유지됩니다.')}</small>
  <button type="button" className="button button-outline" disabled={pending||!settings.can_manage||JSON.stringify(policies)===JSON.stringify(settings.group_permissions)} onClick={()=>onUpdate('group_permissions',policies)}>{ui('그룹 권한 저장')}</button>
 </section>;
}
