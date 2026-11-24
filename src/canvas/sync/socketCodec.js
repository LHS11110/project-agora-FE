export const canUseSocketCodec=()=>typeof Worker!=='undefined'&&typeof CompressionStream!=='undefined'&&typeof DecompressionStream!=='undefined';
export function canvasCodecUrl(address){const url=new URL(address);if(canUseSocketCodec())url.searchParams.set('compression','gzip-v1');return url.href;}
export function installSocketCodec(socket){
 if(!canUseSocketCodec())return socket;
 const worker=new Worker(new URL('./socketCodecWorker.js',import.meta.url),{type:'module'}),send=socket.send.bind(socket),sizes=new Map();let id=0,queued=0,closed=false;
 let pendingDecodes = 0;
 let finishClosing;
 const closeTransport = (reason) => {
  if (socket.readyState === WebSocket.OPEN) socket.close(4000, reason);
 };
 const stats={rawBytes:0,wireBytes:0,compressedFrames:0};socket.transportStats=stats;
 socket.pendingCodecBytes=()=>queued;
 const encode=(data,size)=>{if(closed||socket.readyState!==1)return false;const key=++id;queued+=size;sizes.set(key,size);worker.postMessage({type:'encode',id:key,data});return true;};
 socket.send=data=>{if(!encode(data,typeof data==='string'?new TextEncoder().encode(data).length:data.byteLength||0))throw Error('WebSocket is closed');};
 socket.sendObject=(data,size=32768)=>encode(data,size);
 worker.onmessage=event=>{
  const result=event.data;
  if(result.type==='encoded'){
   queued-=sizes.get(result.id)||0;sizes.delete(result.id);if(closed||socket.readyState!==1)return;
   stats.rawBytes+=result.rawBytes;stats.wireBytes+=result.wireBytes;if(result.data instanceof ArrayBuffer)stats.compressedFrames++;
   try{send(result.data);}catch{closeTransport('Canvas transport failed');}
  }else if(result.type==='decoded'||result.type==='decode_error'){
   pendingDecodes -= 1;
   try {
    if (result.type === 'decode_error') closeTransport('Canvas transport message rejected');
    else if (!closed && result.message.type !== 'transport_ready') socket.onmessage?.(new MessageEvent('message',{data:result.message}));
   } finally {
    if (pendingDecodes === 0) finishClosing?.();
   }
  } else closeTransport('Canvas transport message rejected');
 };
 worker.onerror=()=>{
  pendingDecodes = 0;
  closeTransport('Canvas transport worker failed');
  finishClosing?.();
 };
 socket.addEventListener('message',event=>{
  event.stopImmediatePropagation();
  worker.postMessage({type:'decode',data:event.data});
  pendingDecodes += 1;
 });
 socket.addEventListener('close',event=>{
  const dispose = () => { closed=true;worker.terminate();sizes.clear();queued=0; };
  if (pendingDecodes === 0) {
   dispose();
   return;
  }
  // A final runtime result can already be queued in the worker when the socket closes.
  event.stopImmediatePropagation();
  finishClosing = () => {
   clearTimeout(timer);
   finishClosing = undefined;
   dispose();
   socket.onclose?.(event);
  };
  const timer = setTimeout(finishClosing, 1000);
 },{once:true});
 return socket;
}
