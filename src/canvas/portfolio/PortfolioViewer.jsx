import {useEffect,useState} from 'react';
import {ui} from '../../i18n/locale.js';
// Status-only presentation bar. Space advances; every other key is swallowed so
// viewers can only run code, play media and enter values by clicking objects.
const typing=target=>target?.closest?.('input,textarea,select,[contenteditable=true],.canvas-code-editor,.monaco-editor');
export default function PortfolioViewer({portfolio,index,onExit,onAdvance,sending=false,busyUntil=0,step=0,totalSteps=0,remainingFrames=0,canAdvance=true,locked=false}){
  const pages=portfolio.portfolioPages||[],page=pages[index],[now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),150);return()=>clearInterval(timer);},[]);
  const busy=sending||now<busyUntil;
  useEffect(()=>{
    const keys=e=>{
      if(typing(e.target))return;
      if(e.key==='Escape'&&!locked){e.preventDefault();e.stopImmediatePropagation();onExit();return;}
      e.preventDefault();e.stopImmediatePropagation();
      if(e.code==='Space'&&!e.repeat&&!busy&&canAdvance)onAdvance?.();
    };
    const block=e=>{e.preventDefault();e.stopImmediatePropagation();};
    window.addEventListener('keydown',keys,true);window.addEventListener('wheel',block,{capture:true,passive:false});window.addEventListener('contextmenu',block,true);
    return()=>{window.removeEventListener('keydown',keys,true);window.removeEventListener('wheel',block,{capture:true});window.removeEventListener('contextmenu',block,true);};
  },[onExit,onAdvance,busy,canAdvance,locked]);
  const remaining=Math.max(0,totalSteps-step);
  const status=sending?ui('동기화 중'):busy?ui('애니메이션 재생 중'):remaining?ui('다음 애니메이션'):page?.nextFrameId?ui('다음 프레임'):ui('발표 완료');
  return <div className="portfolio-viewer portfolio-status-bar" aria-live="polite">
    <div className="portfolio-viewer-title"><strong>{page?.title||portfolio.title}</strong></div>
    <i className="portfolio-nav-divider"/>
    <div className="portfolio-step-hint"><kbd>Space</kbd><span>{status}</span></div>
    <i className="portfolio-nav-divider"/>
    <dl className="portfolio-status-counts"><div><dt>{ui('다음 애니메이션')}</dt><dd>{remaining}</dd></div><div><dt>{ui('다음 프레임')}</dt><dd>{remainingFrames}</dd></div></dl>
  </div>;
}
