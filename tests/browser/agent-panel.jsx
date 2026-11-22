import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import CanvasAgentPanel from '../../src/components/CanvasAgentPanel.jsx';
import CanvasAgentLauncher from '../../src/components/CanvasAgentLauncher.jsx';
window.agentCalls=[];
const userId=Number(new URLSearchParams(location.search).get('user')||7);
const telemetry={limits:{second:{limit:1,remaining:0},minute:{limit:60,remaining:59},day:{limit:100,remaining:91}},limits_observed_at:Date.now()/1000,status:200};
const dbKey='fixture-agent-sessions-v1';
function draft(id,owner){return {id,owner_id:owner,nickname:`사용자 ${owner}`,title:'',status:'draft',created_at:Date.now(),updated_at:Date.now(),messages:[]};}
function read(){const saved=localStorage.getItem(dbKey);if(saved)return JSON.parse(saved);const value={next:1,drafts:{7:'draft-7',8:'draft-8'},sessions:{'draft-7':draft('draft-7',7),'draft-8':draft('draft-8',8),'peer-session':{id:'peer-session',owner_id:8,nickname:'사용자 8',title:'공유된 대화',status:'complete',messages:[{id:'peer-prompt',role:'user',content:'다른 참가자의 공유 프롬프트',status:'complete',nickname:'사용자 8'},{id:'peer-answer',role:'assistant',content:'공유된 응답입니다.',status:'complete'}]}},index:['peer-session']};write(value);return value;}
function write(db){localStorage.setItem(dbKey,JSON.stringify(db));}
function summary(s){const {messages,...value}=s;return {...value,can_delete:s.owner_id===userId&&!['draft','running'].includes(s.status),can_continue:s.owner_id===userId};}
function notice(){window.dispatchEvent(new CustomEvent('agora:agent-sessions-changed',{detail:{canvasId:'1'}}));}
window.agentFixture={failNext429:false,disconnectNext:false,omitSession:null,read,notice};
async function request(payload,output){
 window.agentCalls.push(payload);
 if(payload.operation==='status')return {ready:true,configured:true,model:'claude-opus-5-5',credential_source:'server',default_configured:true,telemetry};
 const db=read();
 if(payload.operation==='sessions')return {sessions:db.index.filter(id=>id!==window.agentFixture.omitSession).map(id=>summary(db.sessions[id])),draft:summary(db.sessions[db.drafts[userId]]),user_id:userId,next_offset:null};
 if(payload.operation==='session_delete'){const session=db.sessions[payload.session_id];if(!session||session.owner_id!==userId)throw Error('Delete denied');delete db.sessions[payload.session_id];db.index=db.index.filter(id=>id!==payload.session_id);write(db);notice();return {deleted:true};}
 if(payload.operation==='session_get'){const s=db.sessions[payload.session_id];if(!s){const error=Error('Session not found');error.code='AGENT_SESSION_NOT_FOUND';throw error;}return {session:summary(s),messages:s.messages,before:0,has_more:false};}
 const s=db.sessions[payload.session_id];if(s.owner_id!==userId)throw Error('Read only');
 s.messages.push({id:payload.turn_id,turn_id:payload.turn_id,role:'user',content:payload.message,created_at:Date.now(),options:payload.options,status:'running',nickname:`사용자 ${userId}`});s.status='running';s.updated_at=Date.now();
 if(db.drafts[userId]===s.id){s.title=payload.message;db.index.unshift(s.id);const next=`next-draft-${db.next++}`;db.sessions[next]=draft(next,userId);db.drafts[userId]=next;}
 write(db);notice();output('객체 수정 중');
 const finish=()=>{const latest=read(),current=latest.sessions[s.id],failed=window.agentFixture.failNext429;window.agentFixture.failNext429=false;
 const answer=failed?'요청이 너무 많습니다. 잠시 후 다시 시도해주세요.':'코드를 수정했습니다. 객체 ID: code-a';
 current.messages[current.messages.length-1].status=failed?'failed':'complete';current.status=failed?'failed':'complete';current.updated_at=Date.now();current.messages.push({id:payload.turn_id+':result',turn_id:payload.turn_id,role:'assistant',created_at:Date.now(),content:answer,status:current.status,kind:failed?'error':'answer',code:failed?'AGENT_PROVIDER_BUSY':''});write(latest);notice();
 const result={answer,telemetry,session_id:s.id,next_draft_id:latest.drafts[userId]};
 if(failed){const error=Error(answer);error.code='AGENT_PROVIDER_BUSY';error.payload={result:{...result,error:error.code,message:answer}};throw error;}
 return result;};
 if(window.agentFixture.disconnectNext){window.agentFixture.disconnectNext=false;setTimeout(()=>{try{finish();}catch{}},350);const failure=Error('Test socket closed');failure.code='CANVAS_SOCKET_CLOSED';throw failure;}
 await new Promise(resolve=>setTimeout(resolve,100));return finish();
}

function App(){const [open,setOpen]=useState(true),[busy,setBusy]=useState(false);return <div className="canvas-app-page" style={{position:'relative',height:'100vh','--surface':'#fff','--line':'#e7e7ec','--ink-strong':'#302c3e','--ink-muted':'#827c93','--canvas-panel-top':'16px'}}><div className="board-topline" style={{position:'absolute',bottom:16,right:16,height:40,border:'1px solid #ddd',padding:8,borderRadius:10}}>요약 · 확대 · 캔버스 설정</div><CanvasAgentLauncher open={open} busy={busy} onClick={()=>setOpen(value=>!value)}/><CanvasAgentPanel open={open} onClose={()=>setOpen(false)} onBusyChange={setBusy} canvasId="1" selectedIds={['code-a']} anchor={{x:.2,y:.3}} request={request}/></div>};
createRoot(document.getElementById('root')).render(<App/>);
