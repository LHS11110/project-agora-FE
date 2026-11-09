import {canvasPasswordGrantKey,readCanvasPasswordGrant} from '../canvasAccess.js';
import {api,canvasSocketUrl} from '../../api/client.js';
import {ServerCanvasSession} from '../sync/ServerCanvasSession.js';
import {exportManifest,stable} from '../asCode/manifest.js';
import {canvasSnapshot} from './githubCanvas.js';
import {restoreOperations} from './branchRestore.js';

/** A short-lived authenticated writer; waits for durable broker commits, not local drafts. */
export async function syncBranchCanvas({canvasId,token,user,source,expected,signal}){
 const grant=user?readCanvasPasswordGrant(canvasPasswordGrantKey(canvasId,user)):null;
 const access=await api(`/api/canvases/${canvasId}/access`,{method:'POST',body:grant?{canvas_password_token:grant}:{},token});
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 return new Promise((resolve,reject)=>{
  let settled=false,timer,timeout,started=false,socket;
  const finish=(error,value)=>{if(settled)return;settled=true;clearInterval(timer);clearTimeout(timeout);signal?.removeEventListener('abort',abort);socket.close();error?reject(error):resolve(value);};
  const abort=()=>finish(new DOMException('Aborted','AbortError'));
  const session=new ServerCanvasSession({available:()=>socket.readyState===WebSocket.OPEN,send:data=>{if(socket.readyState!==WebSocket.OPEN)return false;socket.send(JSON.stringify(data));return true;},publish:()=>{},status:state=>{if(state.blocked)finish(new Error(state.message));},reject:message=>finish(new Error(message))});
  socket=new WebSocket(`${canvasSocketUrl(canvasId,access.ws_port,access.canvas_access_token)}&client_id=${encodeURIComponent(session.clientId)}`);
  socket.onmessage=({data})=>{try{
   const packet=JSON.parse(data);
   if(packet.type==='init_items')session.seed(packet.items,packet);else session.receiveServer(packet);
   if(packet.type==='error')throw new Error(packet.code||'캔버스 연결을 거부했습니다.');
   if(session.ready&&!started){
    started=true;const snapshot=canvasSnapshot(exportManifest(session.items));
    if(expected&&stable(JSON.parse(snapshot).items)!==stable(JSON.parse(expected).items))throw new Error('대상 캔버스에 커밋하지 않은 변경이 있습니다. 먼저 해당 브랜치에 저장해주세요.');
    if(!source){finish(null,snapshot);return;}
    const operations=restoreOperations(JSON.parse(source),session.items);
    if(!operations.length){finish(null,snapshot);return;}
    if(!session.submit(operations))throw new Error('복원할 변경을 전송하지 못했습니다.');
    session.flushMoves();
   }else if(started&&session.ready&&!session.pendingOperations.length){finish(null,canvasSnapshot(exportManifest(session.items)));}
  }catch(error){finish(error);}};
  socket.onerror=()=>finish(new Error('브랜치 캔버스에 연결하지 못했습니다.'));
  socket.onclose=()=>finish(new Error('저장 확인 전에 연결이 종료되었습니다. 다시 연결해 결과를 확인해주세요.'));
  signal?.addEventListener('abort',abort,{once:true});
  timeout=setTimeout(()=>finish(new Error('캔버스 저장 확인 시간이 초과되었습니다. 다시 연결해 상태를 확인해주세요.')),55000);
  timer=setInterval(()=>session.tick(),50);
 });
}
