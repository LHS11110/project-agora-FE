import {api,apiUrl} from '../../api/client.js';
import {canvasPasswordGrantKey,readCanvasPasswordGrant} from '../canvasAccess.js';
export async function openTerminalSocket({canvasId,token,user,objectId,cols,rows,offset,onFrame,onClose}){
 const issued=await api(`/api/canvases/${encodeURIComponent(canvasId)}/runtime/terminal/ticket`,{method:'POST',token,body:{objectId,passwordGrant:readCanvasPasswordGrant(canvasPasswordGrantKey(canvasId,user))}});
 // Only a short-lived, single-use ticket goes in a WS frame; never in a URL.
 if(issued.path!=='/api/terminal/ws'||typeof issued.ticket!=='string')throw Error('Invalid terminal ticket');
 const address=new URL(apiUrl(issued.path));address.protocol='wss:';
 return new Promise((resolve,reject)=>{
  const socket=new WebSocket(address.href);let opened=false;
  const timer=setTimeout(()=>{socket.close();reject(Error('Terminal connection timed out'));},10000);
  socket.onopen=()=>{opened=true;clearTimeout(timer);socket.send(JSON.stringify({type:'attach',ticket:issued.ticket,cols,rows,offset}));resolve(socket);};
  socket.onmessage=event=>{try{onFrame(JSON.parse(event.data));}catch{socket.close(1002,'Invalid terminal frame');}};
  socket.onerror=()=>{if(!opened){clearTimeout(timer);reject(Error('Terminal WebSocket connection failed'));}};
  socket.onclose=event=>{clearTimeout(timer);if(opened)onClose(event);else reject(Error('Terminal WebSocket connection closed'));};
 });
}
