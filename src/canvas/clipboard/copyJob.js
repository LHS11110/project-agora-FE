import {CANVAS_ITEM_FIELDS} from '../asCode/manifest.js';
import {serializeCopyObjects} from './objectClipboard.js';
import {yieldPasteFrame} from './pasteJob.js';
export function estimatedCopySize(item){
 let size=256;
 for(const [key,value] of Object.entries(item))if(typeof value==='string'&&(CANVAS_ITEM_FIELDS.has(key)||(item.kind==='text'&&key.startsWith('automerge_'))))size+=value.length*2;
 return size+(item.points?.length||0)*64+(item.rows?.length||0)*Math.max(1,item.columns?.length||1)*128+(item.runtimeResults?.length||0)*65536+(item.notebookCells?.length||0)*65536+(item.notebookCell?.source?.length||0)*2+(item.notebookResult?JSON.stringify(item.notebookResult).length*2:0);
}
export function quickCopy(snapshot){
 const entries=Object.values(snapshot.originals);
 return entries.length<=32&&entries.reduce((size,item)=>size+estimatedCopySize(item),0)<=128*1024;
}
export function sameCopy(a,b){
 if(!a||a.canvasId!==b.canvasId)return false;
 const ids=Object.keys(a.originals);return ids.length===Object.keys(b.originals).length&&ids.every(id=>(a.originals[id] instanceof WeakRef?a.originals[id].deref():a.originals[id])===b.originals[id]);
}
export function cacheCopy(snapshot){return {...snapshot,originals:Object.fromEntries(Object.entries(snapshot.originals).map(([id,item])=>[id,new WeakRef(item)]))};}
export class CopyJob{
 constructor(){this.sequence=0;this.waiters=new Map();}
 ensure(){
  if(this.worker)return;
  this.worker=new Worker(new URL('./copyWorker.js',import.meta.url),{type:'module'});
  this.worker.onmessage=event=>{const data=event.data,waiter=this.waiters.get(data.sequence);if(!waiter)return;clearTimeout(waiter.timer);this.waiters.delete(data.sequence);if(data.error)waiter.reject(Error(data.error));else waiter.resolve(data);};
  this.worker.onerror=()=>this.dispose(Error('복사 데이터를 준비하지 못했습니다. 다시 시도해주세요.'));
 }
 ask(data){this.ensure();return new Promise((resolve,reject)=>{const sequence=++this.sequence,timer=setTimeout(()=>this.dispose(Error('복사 준비 시간이 초과되었습니다. 다시 시도해주세요.')),30000);this.waiters.set(sequence,{resolve,reject,timer});try{this.worker.postMessage({...data,sequence});}catch(error){this.dispose(error);}});}
 async run(snapshot,index,isCurrent){
  const bounds={};for(const [id,item] of Object.entries(snapshot.originals)){const entry=index?.entries.get(id);if(entry?.item===item)bounds[id]=entry.bounds;}
  if(quickCopy(snapshot)||typeof Worker==='undefined')return serializeCopyObjects(snapshot,bounds);
  await this.ask({type:'start',canvasId:snapshot.canvasId});
  let entries=[],estimated=0,lastYield=performance.now();
  const flush=async()=>{if(!entries.length)return;if(!isCurrent())throw Error('캔버스가 변경되어 복사를 취소했습니다.');const batch=entries;entries=[];estimated=0;await this.ask({type:'batch',entries:batch,bounds:Object.fromEntries(batch.filter(([id])=>bounds[id]).map(([id])=>[id,bounds[id]]))});if(performance.now()-lastYield>8){await yieldPasteFrame();lastYield=performance.now();}};
  for(const [id,item] of Object.entries(snapshot.originals)){
   const size=estimatedCopySize(item);if(entries.length&&(entries.length>=32||estimated+size>256*1024))await flush();
   // Avoid cloning unrelated CRDT envelopes for code/note objects. Text color
   // marks are decoded in the worker from the immutable text document only.
   const copy=Object.fromEntries(Object.entries(item).filter(([key])=>CANVAS_ITEM_FIELDS.has(key)||(item.kind==='text'&&['automerge_snapshot','automerge_changes','__initialTextColors'].includes(key))));
   entries.push([id,copy]);estimated+=size;
  }
  await flush();if(!isCurrent())throw Error('캔버스가 변경되어 복사를 취소했습니다.');
  const result=await this.ask({type:'finish'});return {...snapshot,text:result.text};
 }
 dispose(error=Error('복사가 취소되었습니다.')){this.worker?.terminate();this.worker=null;for(const waiter of this.waiters.values()){clearTimeout(waiter.timer);waiter.reject(error);}this.waiters.clear();}
}
// Create the promise-backed ClipboardItem during the user gesture (Safari also
// requires this), before worker preparation completes. Small native copies use
// clipboardData directly and never need asynchronous clipboard permission.
export function writeCopyPromise(prepared){
 try{
  if(navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){
   const blob=prepared.then(s=>new Blob([s.text],{type:'text/plain'}));blob.catch(()=>{});
   return Promise.resolve(navigator.clipboard.write([new ClipboardItem({'text/plain':blob})])).then(()=>true,()=>false);
  }
 }catch{}
 return prepared.then(s=>navigator.clipboard?.writeText(s.text)).then(()=>Boolean(navigator.clipboard?.writeText),()=>false);
}
