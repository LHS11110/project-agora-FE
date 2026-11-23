import {useState} from 'react';
import {useAuth} from '../../state/AuthContext.jsx';
import {useNavigate} from '../../routing.jsx';
import {ui} from '../../i18n/locale.js';
import Icon from '../Icon.jsx';

export default function SessionSettings(){
 const {logoutEverywhere}=useAuth(),navigate=useNavigate();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const signOutEverywhere=async()=>{
  if(busy||!window.confirm(ui('이 기기를 포함한 모든 기기에서 로그아웃할까요?')))return;
  setBusy(true);setError('');
  try{await logoutEverywhere();navigate('/login');}
  catch(e){setError(e.message);setBusy(false);}
 };
 return <section className="profile-card session-settings" aria-labelledby="session-title">
  <div className="card-heading"><span className="settings-badge" aria-hidden="true"><Icon name="logout" size={18}/></span><div><h2 id="session-title">{ui('로그인 세션')}</h2><p>{ui('다른 기기에 남아 있는 로그인을 종료합니다.')}</p></div></div>
  <p className="passkey-description">{ui('기기를 분실했거나 다른 사람이 로그인했을 수 있다면 모든 기기에서 로그아웃하세요. 비밀번호를 변경하면 다른 기기의 로그인은 자동으로 종료됩니다.')}</p>
  {error&&<div className="form-error" role="alert">{ui(error)}</div>}
  <div className="form-actions">
   <button type="button" className="button button-dark" onClick={signOutEverywhere} disabled={busy}>{busy?ui('로그아웃하는 중…'):ui('모든 기기에서 로그아웃')}</button>
  </div>
 </section>;
}
