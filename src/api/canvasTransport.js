let active=null;
export function installCanvasTransport(options){
 active?.dispose?.();
 const entry={...options,owner:Symbol(),queue:[],running:0};
 const pump=()=>{while(active===entry&&entry.running<2&&entry.queue.length){
  const task=entry.queue.shift();entry.running++;
  (async()=>{for(let attempt=0;;attempt++){
   if(active!==entry)throw Error('캔버스 연결이 변경되었습니다.');
   try{return await options.request(task.request);}catch(error){
    if(error.code!=='RUNTIME_BUSY'||attempt>=5)throw error;
    await new Promise(resolve=>setTimeout(resolve,Math.min(100*2**attempt,1600)));
   }
  }})().then(task.resolve,task.reject).finally(()=>{entry.running--;pump();});
 }};
 entry.request=request=>new Promise((resolve,reject)=>{
  if(active!==entry){reject(Error('캔버스 연결이 변경되었습니다.'));return;}
  if(entry.queue.length>=256){reject(Error('캔버스 서비스 요청이 많습니다. 잠시 후 다시 시도해주세요.'));return;}
  entry.queue.push({request,resolve,reject});pump();
 });
 entry.dispose=()=>{if(active===entry)active=null;for(const task of entry.queue.splice(0))task.reject(Error('캔버스 연결이 변경되었습니다.'));};
 active=entry;return entry.dispose;
}
function target(path){
 if(!active)return null;const url=new URL(path,window.location.href);
 if(url.origin!==active.origin)return null;
 const prefix=`/api/canvases/${encodeURIComponent(active.canvasId)}`;
 if(url.pathname===prefix||url.pathname.startsWith(prefix+'/'))return {entry:active,path:url.pathname.slice(prefix.length)};
 const linked=url.pathname.match(/^\/api\/canvases\/([1-9][0-9]*)(\/(?:media|pdfs)\/[^?]+|\/image)$/);
 if(linked)return {entry:active,path:`/linked-resource/${linked[1]}${linked[2]}`};
 if(url.pathname==='/api/link-preview')return {entry:active,path:'/link-preview'};
 if(url.pathname.startsWith('/api/users/profiles/'))return {entry:active,path:url.pathname.slice('/api/users'.length)};
 if(/^\/api\/users\/profile-images\/[1-9][0-9]*$/.test(url.pathname))return {entry:active,path:url.pathname.slice('/api/users'.length)};
 return null;
}
const resourcePath=path=>/^\/(media|pdfs|profile-images|linked-resource)\//.test(path)||path==='/image';
const encode=bytes=>{let text='';for(let at=0;at<bytes.length;at+=8192)text+=String.fromCharCode(...bytes.subarray(at,at+8192));return btoa(text);};
const decode=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
const abort=signal=>{if(signal?.aborted)throw new DOMException('The request was aborted','AbortError');};
export function canvasApiRequest(path,options){
 const destination=target(path);if(!destination)return null;
 const {entry,path:relative}=destination;
 return (async()=>{
  if(options.token&&options.token!==entry.token)throw Error('캔버스 인증 정보가 변경되었습니다.');
  if(options.body instanceof FormData){
   const files=[...options.body.entries()].filter(([,file])=>file instanceof Blob);
   if(files.length!==[...options.body.keys()].length)throw Error('지원하지 않는 파일 업로드 형식입니다.');
   const started=await entry.request({operation:'upload_begin',path:relative,files:files.map(([field,file])=>({field,name:file.name||'upload',type:file.type,size:file.size}))});
   if(typeof started.uploadId!=='string'||!Number.isInteger(started.chunkSize)||started.chunkSize<=0||started.chunkSize>96*1024)throw Error('업로드 세션 응답이 올바르지 않습니다.');
   try{
    for(let index=0;index<files.length;index++){
     const file=files[index][1];for(let offset=0;offset<file.size;offset+=started.chunkSize){
      const bytes=new Uint8Array(await file.slice(offset,offset+started.chunkSize).arrayBuffer());
      await entry.request({operation:'upload_chunk',path:relative,uploadId:started.uploadId,index,offset,data:encode(bytes)});
     }
    }
    return await entry.request({operation:'upload_finish',path:relative,uploadId:started.uploadId});
   }catch(error){entry.request({operation:'upload_cancel',path:relative,uploadId:started.uploadId}).catch(()=>{});throw error;}
  }
  return entry.request({operation:'api',path:relative,method:options.method||'GET',body:options.body||{},...(relative==='/runtime/terminal/ticket'?{authorization:`Bearer ${entry.token}`}:{})});
 })();
}
export async function canvasFetch(input,options={}){
 const destination=target(typeof input==='string'?input:input.href||input.url);
 if(!destination||!resourcePath(destination.path)||options.method&&options.method!=='GET')return fetch(input,options);
 const {entry,path}=destination;const authorization=new Headers(options.headers||{}).get('Authorization');if(authorization&&authorization!==`Bearer ${entry.token}`)throw Error('캔버스 인증 정보가 변경되었습니다.');let offset=0,size=null,type,version;const chunks=[];
 do{
  abort(options.signal);const part=await entry.request({operation:'resource',path,offset,...(version?{version}:{})});abort(options.signal);
  const bytes=decode(part.data);
  if(part.offset!==offset||!Number.isSafeInteger(part.size)||part.size<0||part.size>100*1024*1024||size!==null&&part.size!==size||offset+bytes.length>part.size||version!==undefined&&part.version!==version||bytes.length===0&&offset<part.size)throw Error('리소스 전송 상태가 올바르지 않습니다.');
  size=part.size;type=part.type;version=part.version;chunks.push(bytes);offset+=bytes.length;
 }while(offset<size);
 return new Response(new Blob(chunks,{type}),{status:200,headers:{'Content-Type':type,'Content-Length':String(size),'Cache-Control':'no-store'}});
}
