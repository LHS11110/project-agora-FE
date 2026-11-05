const MAX_DECODED=128*1024*1024;
async function decode(data){
 if(typeof data!=='string'){
  const bytes=data instanceof Blob?await data.arrayBuffer():data;
  const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),parts=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_DECODED){await reader.cancel();throw Error('Canvas message is too large');}parts.push(value);}
  data=await new Blob(parts).text();
 }
 return JSON.parse(data);
}
let incoming=Promise.resolve(),outgoing=Promise.resolve(),gzip=false;
self.onmessage=event=>{
 const request=event.data;
 if(request.type==='decode')incoming=incoming.then(async()=>{
  const message=await decode(request.data);if(message.type==='transport_ready'&&message.encoding==='gzip-v1')gzip=true;
  self.postMessage({type:'decoded',message});
 }).catch(()=>self.postMessage({type:'error'}));
 if(request.type==='encode')outgoing=outgoing.then(async()=>{
  const text=typeof request.data==='string'?request.data:JSON.stringify(request.data),raw=new TextEncoder().encode(text);
  let data=text,bytes=raw.length;
  if(gzip&&raw.length>=1024){const compressed=await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();if(compressed.byteLength<raw.length*.9){data=compressed;bytes=data.byteLength;}}
  self.postMessage({type:'encoded',id:request.id,data,rawBytes:raw.length,wireBytes:bytes},data instanceof ArrayBuffer?[data]:[]);
 }).catch(()=>self.postMessage({type:'error'}));
};
