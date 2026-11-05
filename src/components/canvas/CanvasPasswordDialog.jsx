import {useEffect,useRef,useState} from 'react';
import CanvasManagementDialog from './CanvasManagementDialog.jsx';
import Icon from '../Icon.jsx';
import {ui} from '../../i18n/locale.js';
import './canvas-password-dialog.css';

export default function CanvasPasswordDialog({prompt,theme}){
 const [password,setPassword]=useState(''),input=useRef(null);
 useEffect(()=>{input.current?.focus();},[]);
 const cancel=()=>prompt.finish(null);
 return <CanvasManagementDialog titleId="canvas-password-title" onClose={cancel} theme={theme}>
  <div className="canvas-password-dialog">
   <span className="canvas-password-icon" aria-hidden="true"><Icon name="lock" size={24}/></span>
   <h2 id="canvas-password-title">{ui('캔버스 비밀번호')}</h2>
   <p>{ui('캔버스에 입장하려면 비밀번호를 입력해 주세요.')}</p>
   {prompt.canvasName&&<strong className="canvas-password-name">{prompt.canvasName}</strong>}
   <form onSubmit={event=>{event.preventDefault();if(password){prompt.finish(password);setPassword('');}}}>
    <label htmlFor="canvas-entry-password">{ui('비밀번호')}</label>
    <div className="canvas-password-input"><Icon name="lock" size={17}/><input ref={input} id="canvas-entry-password" name="canvasPassword" type="password" autoComplete="current-password" autoCapitalize="none" spellCheck={false} required value={password} onChange={event=>setPassword(event.target.value)} aria-invalid={Boolean(prompt.error)} aria-describedby={prompt.error?'canvas-password-error':undefined} placeholder={ui('캔버스 비밀번호 입력')}/></div>
    {prompt.error&&<p id="canvas-password-error" className="canvas-password-error" role="alert">{ui(prompt.error)}</p>}
    <div className="canvas-password-actions"><button type="button" className="button button-outline" onClick={cancel}>{ui('취소')}</button><button type="submit" className="button button-dark" disabled={!password}>{ui('캔버스 입장')}<Icon name="arrow" size={16}/></button></div>
   </form>
  </div>
 </CanvasManagementDialog>;
}
