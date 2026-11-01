import {useEffect,useRef,useState} from 'react';
import {api} from '../../api/client.js';
import {ui} from '../../i18n/locale.js';
import './email-verification.css';

export default function EmailVerification({email,verified,onVerified,disabled,requestPath='/api/auth/email/request',requestBody={},allowExistingAccounts=false}){
 const normalized=email.trim().toLowerCase();const [available,setAvailable]=useState(null),[challenge,setChallenge]=useState(null),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false),[deadline,setDeadline]=useState(0),[cooldown,setCooldown]=useState(0),[now,setNow]=useState(Date.now());
 const version=useRef(0),input=useRef(null);
 useEffect(()=>{let cancelled=false;api('/api/auth/email/status').then(r=>{if(!cancelled)setAvailable(r.available===true);}).catch(()=>{if(!cancelled)setAvailable(false);});return()=>{cancelled=true;};},[]);
 useEffect(()=>{version.current++;setChallenge(null);setCode('');setBusy(false);setError('');setSent(false);setDeadline(0);setCooldown(0);},[normalized]);
 useEffect(()=>{if(!challenge&&!cooldown)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[challenge,cooldown]);
 useEffect(()=>()=>{version.current++;},[]);
 const send=async()=>{
  if(busy||disabled||available!==true)return;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)){setError('올바른 이메일 주소를 입력해주세요.');return;}
  const current=++version.current;setBusy(true);setError('');
  try{const result=await api(requestPath,{method:'POST',body:{email:normalized,...requestBody}});if(current!==version.current)return;const time=Date.now();setNow(time);setChallenge(result.challengeId);setDeadline(time+result.expiresInSeconds*1000);setCooldown(time+result.resendAfterSeconds*1000);setCode('');setSent(true);setTimeout(()=>input.current?.focus(),0);}
  catch(error){if(current===version.current){setError(error.message);if(error.code==='USER_001'){setChallenge(null);setCode('');setSent(false);setDeadline(0);setCooldown(0);}if(error.status===429)setCooldown(Date.now()+60000);}}
  finally{if(current===version.current)setBusy(false);}
 };
 const verify=async()=>{
  if(busy||disabled||!challenge||!/^\d{6}$/.test(code))return;
  const current=++version.current;setBusy(true);setError('');
  try{const result=await api('/api/auth/email/verify',{method:'POST',body:{email:normalized,challengeId:challenge,code}});if(current!==version.current)return;onVerified(normalized,result.emailVerificationToken);setChallenge(null);setCode('');setDeadline(0);setCooldown(0);}
  catch(error){if(current===version.current)setError(error.message);}
  finally{if(current===version.current)setBusy(false);}
 };
 const seconds=Math.max(0,Math.ceil((cooldown-now)/1000)),remaining=Math.max(0,Math.ceil((deadline-now)/1000));
 return <div className="email-verification" aria-label={ui('회원가입 이메일 인증')}>
  {verified?<p className="email-verification-done" role="status">✓ {ui('이메일 인증이 완료되었습니다.')}</p>:<>
   <button type="button" className="email-send-button" disabled={busy||disabled||available!==true||seconds>0||!normalized} onClick={send}>{ui(busy?'처리 중…':sent?'인증 메일 다시 보내기':'인증 메일 보내기')}{seconds>0&&` (${seconds}${ui('초')})`}</button>
   {available===false&&<p className="email-verification-hint">{ui('이메일 인증을 사용할 수 없습니다. 잠시 후 다시 시도하거나 다른 로그인 방식을 사용해주세요.')}</p>}
   {sent&&<p className="email-verification-hint" role="status">{ui('이메일로 받은 6자리 코드를 입력해주세요. 메일이 없다면 스팸함도 확인해주세요.')} {!allowExistingAccounts&&ui('이미 가입한 이메일이라면 로그인해주세요.')}</p>}
   {challenge&&<div className="email-code-entry"><label className="form-field"><span>{ui('이메일 인증 코드')}</span><div className="input-wrap"><input ref={input} aria-label={ui('이메일 인증 코드')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();verify();}}}/></div></label><button type="button" className="email-send-button" disabled={busy||disabled||code.length!==6||remaining===0} onClick={verify}>{ui('인증 코드 확인')}</button><small>{remaining?`${ui('남은 시간')}: ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:ui('인증 코드가 만료되었습니다. 메일을 다시 요청해주세요.')}</small></div>}
  </>}
  {error&&<p className="form-error" role="alert">{ui(error)}</p>}
 </div>;
}
