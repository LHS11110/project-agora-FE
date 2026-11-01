import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../../state/AuthContext.jsx';
import {useNavigate} from '../../routing.jsx';
import {api} from '../../api/client.js';
import {ui} from '../../i18n/locale.js';
import {passkeysSupported,registerPasskey,passkeyError} from '../../auth/passkeys.js';
import Icon from '../Icon.jsx';
import './passkeys.css';

export default function PasskeySettings(){
 const {token,logout}=useAuth(),navigate=useNavigate();
 const [keys,setKeys]=useState(null),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const pending=useRef(null),mounted=useRef(false);
 useEffect(()=>{mounted.current=true;let cancelled=false;api('/api/auth/passkeys',{token}).then(value=>{if(!cancelled)setKeys(value);}).catch(e=>{if(!cancelled)setError(e.message);});return()=>{cancelled=true;mounted.current=false;pending.current?.abort();pending.current=null;};},[token]);
 const act=async operation=>{if(pending.current)return;const controller=new AbortController();pending.current=controller;setBusy(true);setError('');setNotice('');try{await operation(controller.signal);if(mounted.current&&!controller.signal.aborted)setKeys(await api('/api/auth/passkeys',{token}));}catch(e){if(mounted.current&&!controller.signal.aborted)setError(passkeyError(e));}finally{if(pending.current===controller)pending.current=null;if(mounted.current)setBusy(false);}};
 return <section className="profile-card passkey-settings" aria-labelledby="passkey-title">
  <div className="card-heading"><span className="settings-badge" aria-hidden="true"><Icon name="lock" size={18}/></span><div><h2 id="passkey-title">{ui('패스키')}</h2><p>{ui('지문, 얼굴 또는 기기 화면 잠금으로 로그인하세요.')}</p></div></div>
  <p className="passkey-description">{ui('기기에서 본인 확인을 완료하면 비밀번호나 추가 인증앱 코드 없이 로그인할 수 있습니다.')}</p>
  {!passkeysSupported()&&<p className="inline-notice info">{ui('이 브라우저에서는 패스키를 사용할 수 없습니다. 최신 브라우저와 HTTPS를 사용해주세요.')}</p>}
  {error&&<div className="form-error" role="alert">{ui(error)}{error==='보안 설정을 변경하려면 다시 로그인해주세요.'&&<button className="passkey-text-button" onClick={()=>{logout();navigate('/login',{state:{from:'/profile'}});}}>{ui('다시 로그인하기')}</button>}</div>}
  {notice&&<p className="inline-notice success" role="status">{ui(notice)}</p>}
  {keys?.length>0?<ul className="passkey-list">{keys.map(key=><li key={key.id}><span className="passkey-device" aria-hidden="true"><Icon name="lock" size={16}/></span><div><strong>{key.name==='패스키'?ui('패스키'):key.name}</strong><small>{ui('등록일')}: {new Date(key.createdAt+'Z').toLocaleDateString()}{key.lastUsedAt&&<> · {ui('최근 사용')}: {new Date(key.lastUsedAt+'Z').toLocaleDateString()}</>}</small></div><button type="button" className="passkey-remove" disabled={busy} aria-label={`${key.name} ${ui('삭제')}`} onClick={()=>act(async()=>{await api('/api/auth/passkeys/'+encodeURIComponent(key.id),{method:'DELETE',token});setNotice('패스키를 삭제했습니다.');})}>{ui('삭제')}</button></li>)}</ul>:keys&&<p className="passkey-empty">{ui('등록된 패스키가 없습니다.')}</p>}
  <form className="passkey-register" onSubmit={e=>{e.preventDefault();act(async signal=>{await registerPasskey(token,name.trim(),signal);if(!signal.aborted&&mounted.current){setName('');setNotice('패스키를 등록했습니다. 다음 로그인부터 사용할 수 있습니다.');}});}}>
   <label className="form-field"><span>{ui('패스키 이름')} <small>{ui('선택 사항')}</small></span><input className="plain-input" aria-label={ui('패스키 이름')} value={name} onChange={e=>setName(e.target.value)} maxLength={80} placeholder={ui('예: 개인 노트북')} disabled={busy}/></label>
   <button className="button button-dark" disabled={busy||!keys||keys.length>=10||!passkeysSupported()} type="submit"><Icon name="plus" size={15}/>{busy?ui('기기에서 인증해주세요…'):ui('패스키 추가')}</button>
  </form>
 </section>;
}
