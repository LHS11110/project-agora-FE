import {managementError} from '../../canvas/permissions/managementError.js';
import {useEffect,useState} from 'react';
import {api} from '../../api/client.js';
import {ui} from '../../i18n/locale.js';
import '../../canvas/permissions/canvas-access-management.css';
export default function CanvasBotControls({canvasId,token,settings,pending,onRequest}){
 const [bots,setBots]=useState([]),[name,setName]=useState(''),[group,setGroup]=useState(settings?.initial_group||'default'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[secret,setSecret]=useState(null),[visible,setVisible]=useState(false),[copied,setCopied]=useState(false),[confirm,setConfirm]=useState(null);
 const root='/api/canvases/'+canvasId+'/bots';
 const groups=Object.keys(settings?.group_permissions||{}).filter(key=>key!=='admin-group'&&settings.group_permissions[key].read===true);
 const load=()=>api(root,{token}).then(data=>setBots(Array.isArray(data)?data:[]));
 useEffect(()=>{let active=true;if(settings?.can_manage)api(root,{token}).then(data=>{if(active)setBots(Array.isArray(data)?data:[]);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[root,token,settings?.can_manage]);
 useEffect(()=>{if(!groups.includes(group))setGroup(groups.includes(settings?.initial_group)?settings.initial_group:groups[0]||'');},[settings,group]);
 if(!settings?.can_manage)return null;
 const failure=e=>setError(e);
 const create=async e=>{
  e.preventDefault();setBusy(true);setError('');let created;
  try{
   created=await api(root,{method:'POST',token,body:{name:name.trim()}});
   await onRequest('participant_add',null,{nickname:created.bot.nickname,tag_number:created.bot.tag_number,group});
   setSecret(created);setVisible(false);setCopied(false);setName('');await load();
  }catch(e){
   if(created)try{await api(root+'/'+created.bot.user_id,{method:'DELETE',token});}catch{}
   failure(e);
  }finally{setBusy(false);}
 };
 const rotate=async bot=>{setBusy(true);setError('');try{const created=await api(root+'/'+bot.user_id+'/rotate',{method:'POST',token});setSecret(created);setVisible(false);setCopied(false);}catch(e){failure(e);}finally{setBusy(false);}};
 const revoke=async bot=>{
  setBusy(true);setError('');
  try{
   await api(root+'/'+bot.user_id,{method:'DELETE',token});
   if(settings.participants?.some(p=>p.nickname===bot.nickname&&p.tag_number===bot.tag_number))await onRequest('participant_remove',null,{nickname:bot.nickname,tag_number:bot.tag_number});
   if(secret?.bot.user_id===bot.user_id)setSecret(null);setConfirm(null);await load();
  }catch(e){failure(e);await load().catch(()=>{});}finally{setBusy(false);}
 };
 const download=()=>{
  const blob=new Blob([JSON.stringify({version:1,base_url:window.location.origin,...secret},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='agora-bot-'+canvasId+'-'+secret.bot.user_id+'.token.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <section className="canvas-access-management" aria-label={ui('봇 참여자 관리')}><h3>{ui('봇 참여자 관리')}</h3><p>{ui('봇을 생성하고 접속 그룹을 선택합니다. 봇은 이 캔버스에서 선택한 그룹의 권한으로만 작업합니다.')}</p>
  <form className="bot-management-create" onSubmit={create}>
   <input className="plain-input" aria-label={ui('봇 이름')} placeholder={ui('봇 이름')} maxLength={80} value={name} disabled={busy||pending||Boolean(secret)} onChange={e=>setName(e.target.value)}/>
   <select className="plain-input" aria-label={ui('봇 참여 그룹')} value={group} disabled={busy||pending||Boolean(secret)} onChange={e=>setGroup(e.target.value)}>{groups.map(key=><option key={key} value={key}>{key}</option>)}</select>
   <button className="button button-outline" disabled={busy||pending||Boolean(secret)||!name.trim()||!group}>{ui('봇 생성')}</button>
  </form>
  {secret&&<div className="bot-secret-card" role="region" aria-label={ui('새 봇 자격 증명')}><strong>{secret.bot.nickname}#{secret.bot.tag_number}</strong><p>{ui('토큰은 이번 응답에서만 확인할 수 있습니다. 복사하거나 파일로 저장한 뒤 확인 완료를 누르세요.')}</p><input className="plain-input" aria-label={ui('봇 접속 토큰')} type={visible?'text':'password'} readOnly value={secret.token}/>
   <div className="bot-secret-actions"><button className="button button-outline" onClick={()=>setVisible(v=>!v)}>{ui(visible?'토큰 숨기기':'토큰 보기')}</button><button className="button button-outline" onClick={async()=>{try{await navigator.clipboard.writeText(secret.token);setCopied(true);}catch{setError('복사하지 못했습니다. 토큰을 선택해 복사하거나 파일로 저장하세요.');}}}>{ui(copied?'복사됨':'토큰 복사')}</button><button className="button button-outline" onClick={download}>{ui('자격 증명 저장')}</button><button className="button button-outline" onClick={()=>setSecret(null)}>{ui('확인 완료')}</button></div>
  </div>}
  {error&&<p className="access-management-error" role="alert">{managementError(error)}</p>}
  <div className="bot-management-list">{bots.map(bot=><div className="bot-management-row" role="group" aria-label={bot.nickname+'#'+bot.tag_number} key={bot.user_id}><div><strong>{bot.nickname}#{bot.tag_number}</strong><small>{ui(bot.active?'활성 봇':'폐기된 봇')}</small><small>{ui('참여 그룹')}: {Object.entries(settings.groups||{}).filter(([,people])=>people.some(p=>p.nickname===bot.nickname&&p.tag_number===bot.tag_number)).map(([name])=>name).join(' · ')||ui('미참여')}</small></div>
   <button className="button button-outline" disabled={busy||pending||!bot.active||Boolean(secret)} onClick={()=>rotate(bot)}>{ui('토큰 교체')}</button>
   {confirm===bot.user_id?<><button className="button button-outline" disabled={busy||pending} onClick={()=>revoke(bot)}>{ui('봇 폐기 확인')}</button><button className="button button-outline" disabled={busy} onClick={()=>setConfirm(null)}>{ui('취소')}</button></>:<button className="button button-outline" disabled={busy||pending||(!bot.active&&!settings.participants?.some(p=>p.nickname===bot.nickname&&p.tag_number===bot.tag_number))} onClick={()=>setConfirm(bot.user_id)}>{ui('봇 폐기')}</button>}
  </div>)}</div>
  {!bots.length&&<small>{ui('아직 생성된 봇이 없습니다.')}</small>}
 </section>;
}
