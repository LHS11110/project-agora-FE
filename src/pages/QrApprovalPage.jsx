import {useEffect,useState} from 'react';
import {useAuth} from '../state/AuthContext.jsx';
import {api} from '../api/client.js';
import {Link} from '../routing.jsx';
import {ui} from '../i18n/locale.js';
import {useUiLocale} from '../i18n/useUiLocale.js';
import FreLogBrand from '../components/frelog/FreLogBrand.jsx';
import '../components/account/qr-login.css';
export default function QrApprovalPage(){
 useUiLocale();const {token,user,isAuthenticated}=useAuth();
 const [intent]=useState(()=>{const values=new URLSearchParams(window.location.hash.slice(1)),id=values.get('request'),secret=values.get('approval');return /^[a-f0-9-]{36}$/.test(id||'')&&/^[A-Za-z0-9_-]{43}$/.test(secret||'')?{requestId:id,secret}:null;});
 const [preview,setPreview]=useState(null),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState('');
 useEffect(()=>{window.history.replaceState(window.history.state,'',window.location.pathname);},[]);
 useEffect(()=>{if(!intent||!isAuthenticated)return;let live=true;api('/api/auth/qr/preview',{method:'POST',token,body:intent}).then(value=>{if(live)setPreview(value);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[intent,isAuthenticated,token]);
 const decide=async approve=>{if(busy)return;setBusy(true);setError('');try{await api('/api/auth/qr/decide',{method:'POST',token,body:{...intent,code,approve}});setResult(approve?'로그인을 승인했습니다. 새 기기에서 계속해주세요.':'로그인을 거절했습니다.');}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <main className="qr-approval-page"><header><FreLogBrand/><Link to="/">{ui('홈으로 돌아가기')}</Link></header><section className="qr-approval-card"><h1>{ui('새 기기 로그인 승인')}</h1>
 {result?<p role="status">{ui(result)}</p>:!intent?<p role="alert">{ui('올바른 QR 코드가 아닙니다. 로그인할 기기에서 새 QR 코드를 스캔해주세요.')}</p>:!isAuthenticated?<><p>{ui('이미 로그인된 기기에서 이 QR 코드를 스캔해주세요. 이 브라우저에 로그인이 필요하면 로그인 후 다시 스캔해주세요.')}</p><Link className="button button-dark" to="/login">{ui('로그인')}</Link></>:<>
 <p>{ui('본인이 로그인하려는 기기인지 확인해주세요. 다른 사람이 보낸 QR 코드는 승인하지 마세요.')}</p>
 <div className="qr-approval-account"><strong>{user?.nickname}</strong><span>{user?.email}</span></div>
 {preview&&<><dl><dt>{ui('로그인할 기기')}</dt><dd>{preview.deviceLabel}</dd><dt>IP</dt><dd>{preview.requesterIp}</dd></dl>
 {preview.status==='PENDING'?<form onSubmit={e=>{e.preventDefault();decide(true);}}><label>{ui('새 기기에 표시된 6자리 코드')}<input aria-label={ui('기기 확인 코드')} inputMode="numeric" autoComplete="off" maxLength={6} pattern="[0-9]{6}" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} required disabled={busy}/></label><div className="qr-approval-actions"><button className="button button-dark" disabled={busy||code.length!==6}>{ui('이 기기 로그인 승인')}</button><button className="button" type="button" disabled={busy} onClick={()=>decide(false)}>{ui('거절')}</button></div></form>:<p>{ui('이미 처리되었거나 취소된 QR 코드입니다.')}</p>}</>}
 </>}{error&&<p className="form-error" role="alert">{ui(error)}</p>}
 </section></main>;
}
