import {useEffect,useRef,useState} from 'react';
import QRCode from 'qrcode';
import {api} from '../../api/client.js';
import {ui} from '../../i18n/locale.js';
import './qr-login.css';
export default function QrLoginPanel({onComplete,onCancel}){
 const [session,setSession]=useState(null),[image,setImage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[terminal,setTerminal]=useState(false),[now,setNow]=useState(Date.now());
 const initial=useRef(null),generation=useRef(0),current=useRef(null);
 const install=async(result,active)=>{const qr=await QRCode.toDataURL(result.qrUrl,{width:232,margin:2,errorCorrectionLevel:'M'});if(!active())return;current.current=result;setSession({...result,deadline:Date.now()+result.expiresInSeconds*1000});setImage(qr);setTerminal(false);};
 useEffect(()=>{let live=true;setBusy(true);if(!initial.current)initial.current=api('/api/auth/qr/start',{method:'POST'});initial.current.then(result=>install(result,()=>live)).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setBusy(false);});return()=>{live=false;};},[]);
 useEffect(()=>{if(!session||terminal)return;let live=true,timer;const tick=setInterval(()=>setNow(Date.now()),1000);
  const poll=async()=>{if(!live)return;if(Date.now()>=session.deadline){setTerminal(true);setError('QR 코드가 만료되었습니다. 새 QR 코드를 만들어주세요.');return;}
   try{const result=await api('/api/auth/qr/poll',{method:'POST',body:{requestId:session.requestId,secret:session.pollingToken}});if(!live)return;
    if(result.status==='COMPLETE'&&result.login){setTerminal(true);onComplete(result.login);return;}
    if(['DENIED','USED','CANCELLED'].includes(result.status)){setTerminal(true);setError(result.status==='DENIED'?'다른 기기에서 로그인을 거절했습니다.':'이미 처리되었거나 취소된 QR 코드입니다.');return;}
   }catch(e){if(live){setError(e.message);setTerminal(true);}return;}
   if(live)timer=setTimeout(poll,(document.hidden?5:session.pollingIntervalSeconds)*1000);
  };timer=setTimeout(poll,session.pollingIntervalSeconds*1000);return()=>{live=false;clearTimeout(timer);clearInterval(tick);};
 },[session,terminal,onComplete]);
 const cancel=async()=>{const old=current.current;current.current=null;if(old)await api('/api/auth/qr/cancel',{method:'POST',body:{requestId:old.requestId,secret:old.pollingToken}}).catch(()=>{});};
 const refresh=async()=>{if(busy)return;const sequence=++generation.current;setBusy(true);setError('');setTerminal(true);setImage('');try{await cancel();const result=await api('/api/auth/qr/start',{method:'POST'});await install(result,()=>generation.current===sequence);}catch(e){setError(e.message);}finally{setBusy(false);}};
 const remaining=session?Math.max(0,Math.ceil((session.deadline-now)/1000)):0;
 return <div className="qr-login-panel">
  <p>{ui('이미 로그인된 기기의 카메라로 QR 코드를 스캔하고 로그인을 승인해주세요.')}</p>
  <div className={'qr-login-image '+(terminal?'inactive':'')}>{image?<img src={image} width="232" height="232" alt={ui('새 기기 로그인용 일회용 QR 코드')}/>:<span role="status">{ui(busy?'QR 코드 준비 중…':'QR 코드를 다시 만들어주세요.')}</span>}</div>
  {session&&!terminal&&<><span className="qr-code-label">{ui('기기 확인 코드')}</span><strong className="qr-device-code">{session.displayCode}</strong><small>{ui('스캔한 기기에 위 코드를 입력하세요.')} · {remaining}{ui('초')}</small></>}
  {error&&<p className="form-error" role="alert">{ui(error)}</p>}
  <div className="qr-login-actions"><button type="button" disabled={busy} onClick={refresh}>{ui('새 QR 코드')}</button><button type="button" disabled={busy} onClick={async()=>{setTerminal(true);await cancel();onCancel();}}>{ui('다른 방법으로 로그인')}</button></div>
 </div>;
}
