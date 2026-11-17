import {ui} from '../../i18n/locale.js';
import './canvas-watch.css';
export default function CanvasWatchOverlay({watch}){
 const {state}=watch,target=state.users.find(user=>user.id===state.watching_id);
 return <>{state.watching_id&&<div className="canvas-watch-shield" aria-label={ui('관전 중인 캔버스')} onPointerDown={event=>event.stopPropagation()} onWheel={event=>event.stopPropagation()}/>}{target&&<div data-canvas-ui="true" className="canvas-watch-banner" role="status"><i/><span><strong>{ui('{name} 관전 중',{name:target.nickname})}</strong><small>{ui('관전을 종료하면 원래 시점으로 돌아갑니다.')}</small></span><button type="button" onClick={watch.leave}>{ui('관전 종료')}</button></div>}{watch.error&&<p data-canvas-ui="true" className="canvas-watch-error" role="alert">{ui(watch.error)}</p>}</>;
}
