import {useEffect,useRef,useState} from 'react';
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {ui} from '../../i18n/locale.js';
import './terminal.css';

export default function TerminalObject({id,item,store,selected,canExecute}) {
 const root=useRef(null),session=useRef(null),latest=useRef({store,selected,canExecute});latest.current={store,selected,canExecute};
 const [state,setState]=useState('disconnected'),[error,setError]=useState('');
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const disconnect=async(closeRemote=true)=>{
  const s=session.current;if(!s)return;session.current=null;s.closed=true;clearTimeout(s.timer);s.observer.disconnect();s.input.dispose();s.resize.dispose();
  if(s.socket?.readyState===WebSocket.OPEN&&closeRemote){s.socket.send(JSON.stringify({operation:'close',data:'',cols:Math.min(300,Math.max(2,s.term.cols)),rows:Math.min(150,Math.max(2,s.term.rows))}));setTimeout(()=>s.socket?.close(),1500);}else s.socket?.close();
  s.term.dispose();if(mounted.current)setState('disconnected');
 };
 useEffect(()=>()=>{void disconnect(false);},[id,store]);
 useEffect(()=>{const s=session.current;if(s){s.term.options.disableStdin=!selected||!canExecute;if(selected&&canExecute&&s.ready)s.term.focus();if(!canExecute)void disconnect();}},[selected,canExecute]);
 const connect=async()=>{
  if(session.current||!canExecute)return;
  setState('connecting');setError('');
  const term=new Terminal({fontSize:Math.max(10,Math.min(28,item.fontSize||13)),fontFamily:'ui-monospace, SFMono-Regular, Consolas, monospace',scrollback:3000,convertEol:false,disableStdin:!selected,theme:{background:'#11141e',foreground:'#e3e7f1',cursor:'#ae9aff'},allowProposedApi:false});
  const fit=new FitAddon();term.loadAddon(fit);term.open(root.current);fit.fit();
  const s={term,offset:0,closed:false,inputQueue:'',ready:false,retries:0,retryable:true};session.current=s;
  const render=result=>{
   if(s.closed)return;
   if(result.expired)throw Error(ui('터미널 세션이 만료되었습니다. 다시 연결해주세요.'));
   if(result.truncated)term.writeln('\r\n'+ui('이전 출력 일부가 생략되었습니다.'));
   if(result.data)term.write(Uint8Array.from(atob(result.data),c=>c.charCodeAt(0)));
   if(Number.isSafeInteger(result.offset))s.offset=result.offset;
   if(result.exited){s.ready=false;setState('exited');term.options.disableStdin=true;}
  };
  const dimensions=()=>({cols:Math.min(300,Math.max(2,term.cols)),rows:Math.min(150,Math.max(2,term.rows))});
  const send=(operation,data='')=>{
   if(s.closed||!s.ready||s.socket?.readyState!==WebSocket.OPEN)return;
   if(s.socket.bufferedAmount>32768){setError(ui('입력이 너무 많습니다. 잠시 후 다시 입력해주세요.'));return;}
   s.socket.send(JSON.stringify({operation,data,...dimensions()}));
  };
  s.input=term.onData(data=>{
   if(!s.ready||!latest.current.selected||!latest.current.canExecute)return;
   if(data.length>32768){setError(ui('입력이 너무 많습니다. 잠시 후 다시 입력해주세요.'));return;}
   // Send keys immediately; split large pastes without separating surrogate pairs.
   while(data){let length=Math.min(1024,data.length);if(/[\uD800-\uDBFF]/.test(data[length-1]))length--;if(!length)break;send('input',data.slice(0,length));data=data.slice(length);}
  });
  s.resize=term.onResize(()=>send('resize'));
  s.observer=new ResizeObserver(()=>{if(!s.closed)try{fit.fit();}catch{}});s.observer.observe(root.current);
  const attach=async()=>{
   if(s.closed)return;
   setState('connecting');term.options.disableStdin=true;
   try{
    const socket=await latest.current.store.connectTerminal(id,{...dimensions(),offset:s.offset,
     onFrame:result=>{
      if(result.type==='closed'){s.socket?.close();return;}
      if(s.closed)return;
      if(result.type==='error'){s.retryable=result.retryable!==false;setError(result.message);s.socket?.close();return;}
      render(result);
      if(result.type==='ready'){s.ready=true;s.retries=0;setError('');setState('connected');term.options.disableStdin=!latest.current.selected;send('resize');if(latest.current.selected)term.focus();}
      if(result.exited){s.retryable=false;s.socket?.close();}
     },onClose:event=>{
      if(s.closed)return;s.ready=false;term.options.disableStdin=true;
      if(event.code!==1008&&s.retryable&&s.retries<3){s.retries++;s.timer=setTimeout(attach,200*2**(s.retries-1));}
      else if(s.retryable||event.code===1008){setState('error');setError(ui('터미널 연결이 종료되었습니다. 다시 연결해주세요.'));}
     }});
    s.socket=socket;if(s.closed)socket.close();
   }catch(failure){if(!s.closed){s.ready=false;setError(failure.message);setState('error');}}
  };
  void attach();

 };
 return <div className="canvas-terminal" data-terminal-state={state}>
  <header><strong>›_ {ui('VM 터미널')}</strong><span role="status">{ui(state==='connected'?'연결됨':state==='connecting'?'연결 중':state==='exited'?'종료됨':state==='error'?'연결 오류':'연결 해제')}</span>
   {['disconnected','error','exited'].includes(state)?<button data-object-action="terminal" disabled={!canExecute} onPointerDown={e=>e.stopPropagation()} onClick={async()=>{await disconnect(false);void connect();}}>{ui('연결')}</button>:<button data-object-action="terminal" onPointerDown={e=>e.stopPropagation()} onClick={()=>void disconnect()}>{ui('연결 종료')}</button>}
  </header>
  <div className="canvas-terminal-body" ref={root} onPointerDown={e=>{if(selected&&session.current)e.stopPropagation();}} onDoubleClick={e=>e.stopPropagation()} onWheel={e=>{if(selected&&session.current)e.stopPropagation();}} onKeyDown={e=>e.stopPropagation()}/>
  {state==='disconnected'&&<div className="canvas-terminal-empty">{ui(canExecute?'연결하면 캔버스 VM의 셸이 열립니다.':'터미널을 사용하려면 실행 권한이 필요합니다.')}</div>}
  <footer>{error?<span role="alert">{error}</span>:ui('개인 셸 · /workspace 공유 · Ctrl+C로 명령 중단')}</footer>
 </div>;
}
