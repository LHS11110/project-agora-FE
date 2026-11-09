import {useEffect,useRef} from 'react';
import {ui} from '../../i18n/locale.js';
import {useUiLocale} from '../../i18n/useUiLocale.js';
import CanvasGithubPanel from './CanvasGithubPanel.jsx';
import '../asCode/canvas-as-code.css';
export default function CanvasVersionDialog({api,canvasId,onClose,onInspect,open=true}){
 useUiLocale();const close=useRef(null);
 useEffect(()=>{if(!open)return;const previous=document.activeElement;close.current?.focus();return()=>previous?.focus?.();},[open]);
 return <div hidden={!open} style={!open?{display:'none'}:undefined} className="canvas-as-code-overlay canvas-version-overlay" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{
  e.stopPropagation();if(e.key==='Escape'){e.preventDefault();onClose();}
  if(e.key==='Tab'){const controls=[...e.currentTarget.querySelectorAll('button:not(:disabled),input:not([type="file"]),select,summary,a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.closest('[hidden],fieldset:disabled'));const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 }}><section className="canvas-as-code-dialog canvas-version-dialog" role="dialog" aria-modal={open?true:undefined} aria-labelledby="canvas-version-title">
  <header><div><small>FRELOG · VERSION CONTROL</small><h2 id="canvas-version-title">{ui('변경 이력 관리')}</h2><p>{ui('캔버스 버전을 저장하고 복구하거나 브랜치별로 작업하세요.')}</p></div><button ref={close} onClick={onClose} aria-label={ui('변경 이력 닫기')}>{ui('닫기')}</button></header>
  <CanvasGithubPanel active={open} api={api} canvasId={canvasId} onLoad={onInspect}/>
 </section></div>;
}
