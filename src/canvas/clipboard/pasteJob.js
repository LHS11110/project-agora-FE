// Pull one bounded batch at a time: the worker cannot outrun rendering/network storage.
export async function* pasteBatches(text,options,getItems){
 const worker=new Worker(new URL('./pasteWorker.js',import.meta.url),{type:'module'});
 let waiting;const messages=[];
 const next=()=>messages.length?Promise.resolve(messages.shift()):new Promise((resolve,reject)=>{waiting={resolve,reject};});
 worker.onmessage=event=>{if(waiting){waiting.resolve(event.data);waiting=null;}else messages.push(event.data);};
 worker.onerror=event=>{const error={type:'error',message:event.message||'붙여넣기를 준비하지 못했습니다.'};if(waiting){waiting.resolve(error);waiting=null;}else messages.push(error);};
 try{
  worker.postMessage({type:'start',text,options});let ready;
  while(!ready){
   const message=await next();if(message.type==='error')throw Error(message.message);
   if(message.type==='references'){
    const current=getItems(),items={};
    for(const id of message.ids)if(Object.hasOwn(current,id))items[id]={kind:current[id].kind,...(current[id].shapeType?{shapeType:current[id].shapeType}:{})};
    worker.postMessage({type:'references',items});
   }else if(message.type==='ready')ready=message;
  }
  do{
   worker.postMessage({type:'next'});const batch=await next();if(batch.type==='error')throw Error(batch.message);
   yield {...batch,total:ready.total,skipped:ready.skipped};if(batch.done)break;
  }while(true);
 }finally{worker.terminate();}
}
// A timer after rAF yields a paint, instead of continuing inside the same frame.
export function yieldPasteFrame(){return new Promise(resolve=>{if(document.hidden)setTimeout(resolve,16);else requestAnimationFrame(()=>setTimeout(resolve,0));});}
