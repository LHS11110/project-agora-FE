import {useState} from 'react';
import {useAuth} from '../../state/AuthContext.jsx';
import {ui} from '../../i18n/locale.js';
import EmailVerification from './EmailVerification.jsx';
import Icon from '../Icon.jsx';

export default function OAuthEnrollment({enrollment,onComplete,onCancel,onBusyChange}){
 const {completeOAuthEnrollment}=useAuth();
 const [email,setEmail]=useState(enrollment.email||''),[proof,setProof]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const submit=async event=>{
  event.preventDefault();if(busy||!proof||proof.email!==email.trim().toLowerCase())return;
  setBusy(true);onBusyChange?.(true);setError('');
  try{const result=await completeOAuthEnrollment(proof.email,proof.token);onComplete(result);}
  catch(e){if(e.code==='EMAIL_001'||e.code==='USER_001')setProof(null);setError(e.message);setBusy(false);onBusyChange?.(false);}
 };
 return <form className="auth-form oauth-enrollment" onSubmit={submit}>
  <p className="oauth-enrollment-note">{ui('처음 가입할 때 사용할 이메일을 확인해주세요. 이미 가입한 이메일은 기존 로그인 방식을 사용해주세요.')}</p>
  <label className="form-field"><span>{ui('이메일')}</span><div className="input-wrap"><Icon name="mail" size={18}/><input aria-label={ui('이메일')} type="email" autoComplete="email" maxLength={255} value={email} disabled={busy} onChange={e=>{const value=e.target.value;setEmail(value);setError('');if(proof?.email!==value.trim().toLowerCase())setProof(null);}} required/></div></label>
  <EmailVerification email={email} verified={Boolean(proof&&proof.email===email.trim().toLowerCase())} onVerified={(email,token)=>{setProof({email,token});setError('');}} disabled={busy} requestPath="/api/auth/oauth2/email/request" requestBody={{enrollmentToken:enrollment.enrollmentToken}}/>
  {error&&<p className="form-error" role="alert">{ui(error)}</p>}
  <button className="button button-dark button-submit" type="submit" disabled={busy||!proof}>{busy?ui('잠시만요…'):ui('인증하고 가입하기')}<Icon name="arrow" size={17}/></button>
  <button type="button" className="oauth-cancel" disabled={busy} onClick={onCancel}>{ui('다른 방법으로 로그인')}</button>
 </form>;
}
