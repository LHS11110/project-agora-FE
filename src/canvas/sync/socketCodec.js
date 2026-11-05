export const canUseSocketCodec=()=>typeof Worker!=='undefined'&&typeof CompressionStream!=='undefined'&&typeof DecompressionStream!=='undefined';
export function canvasCodecUrl(address){const url=new URL(address);if(canUseSocketCodec())url.searchParams.set('compression','gzip-v1');return url.href;}
export function installSocketCodec(socket){
 if(!canUseSocketCodec())return socket;
 const worker=new Worker(new URL('./socketCodecWorker.js',import.meta.url),{type:'module'}),send=socket.send.bind(socket),sizes=new Map();let id=0,queued=0,closed=false;
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
   try{send(result.data);}catch{socket.close(1011,'Canvas transport failed');}
  }else if(result.type==='decoded'){if(!closed&&result.message.type!=='transport_ready')socket.onmessage?.(new MessageEvent('message',{data:result.message}));}
  else socket.close(1009,'Canvas transport message rejected');
 };
 worker.onerror=()=>socket.close(1011,'Canvas transport worker failed');
 socket.addEventListener('message',event=>{event.stopImmediatePropagation();worker.postMessage({type:'decode',data:event.data});});
 socket.addEventListener('close',()=>{closed=true;worker.terminate();sizes.clear();queued=0;},{once:true});
 return socket;
}
