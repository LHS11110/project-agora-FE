import {CLIPBOARD_TYPE,preparePastePayload} from './objectClipboard.js';
let source,options,plan,cursor=0;
self.onmessage=event=>{
 try{
  const request=event.data;
  if(request.type==='start'){
   if(typeof request.text!=='string'||request.text.length>16*1024*1024)throw Error('클립보드 데이터가 너무 큽니다.');
   source=JSON.parse(request.text);options=request.options;
   if(source?.type!==CLIPBOARD_TYPE||source.version!==1||!source.items||Array.isArray(source.items)||typeof source.items!=='object')throw Error('지원하지 않는 객체 클립보드 형식입니다.');
   const own=new Set(Object.keys(source.items)),references=new Set();
   for(const item of Object.values(source.items))if(item?.kind==='connector')for(const id of [item.from,item.to])if(!own.has(String(id)))references.add(String(id));
   self.postMessage({type:'references',ids:[...references]});
  }else if(request.type==='references'){
   plan=preparePastePayload(source,request.items,options.canvasId,options.permission,options.point,options.repeat);source=null;
   self.postMessage({type:'ready',total:plan.creates.length,skipped:plan.skipped});
  }else if(request.type==='next'){
   const creates=[];let bytes=0;
   while(cursor<plan.creates.length&&creates.length<32){
    const next=plan.creates[cursor],size=JSON.stringify(next).length;
    if(creates.length&&bytes+size>128*1024)break;
    creates.push(next);cursor++;bytes+=size;
   }
   self.postMessage({type:'batch',creates,done:cursor===plan.creates.length});
  }
 }catch(error){self.postMessage({type:'error',message:error.message});}
};
