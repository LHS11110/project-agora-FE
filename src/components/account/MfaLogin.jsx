import {useState} from 'react';
import {ui} from '../../i18n/locale.js';
import Icon from '../Icon.jsx';
import './mfa.css';

export default function MfaLogin({onVerify,onCancel}){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[recovery,setRecovery]=useState(false);
 return <form className="mfa-login auth-form" data-mode={recovery?'recovery':'totp'} onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await onVerify(code);}catch(e){setError(e.message);setCode('');}finally{setBusy(false);}}}>
  <div className="mfa-login-intro"><span className="mfa-login-symbol" aria-hidden="true"><Icon name="lock" size={18}/></span><p>{ui(recovery?'저장해 둔 일회용 복구 코드를 입력해주세요.':'인증앱에 표시된 6자리 코드를 입력해주세요.')}</p></div>
  <label className="form-field"><span>{ui(recovery?'복구 코드':'인증 코드')}</span><div className="input-wrap"><input autoFocus autoComplete="one-time-code" inputMode={recovery?'text':'numeric'} value={code} onChange={e=>setCode(e.target.value)} maxLength={recovery?24:6} pattern={recovery?undefined:'[0-9]{6}'} required aria-label={ui(recovery?'복구 코드':'인증 코드')}/></div></label>
  {error&&<div className="form-error" role="alert">{ui(error)}</div>}
  <button className="button button-dark button-submit" disabled={busy}>{ui(busy?'확인 중…':'인증하고 로그인')}<Icon name="arrow" size={16}/></button>
  <div className="mfa-login-options">
   <button className="mfa-text-button" type="button" disabled={busy} onClick={()=>{setRecovery(!recovery);setCode('');setError('');}}>{ui(recovery?'인증앱 코드 사용':'복구 코드 사용')}</button>
   <button className="mfa-text-button" type="button" disabled={busy} onClick={onCancel}>{ui('다시 로그인하기')}</button>
  </div>
 </form>;
}
