import * as Automerge from '@automerge/automerge/slim';
import automergeWasmUrl from '@automerge/automerge/automerge.wasm?url';
import {exportManifest} from '../asCode/manifest.js';
import {objectBounds} from '../../components/CanvasSpatialBTree.js';
import {CANVAS_SPACE} from '../canvasSpace.js';
import {CLIPBOARD_TYPE,MAX_COPY_BYTES} from './objectClipboard.js';
let parts=[],size=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,canvasId,chain=Promise.resolve(),wasm;
self.onmessage=event=>{
 const request=event.data;
 chain=chain.then(async()=>{
  if(request.type==='start'){parts=[];size=0;minX=minY=Infinity;maxX=maxY=-Infinity;canvasId=request.canvasId;}
  else if(request.type==='batch'){
   if(request.entries.some(([,item])=>item.kind==='text'&&item.automerge_snapshot)){
    wasm ||= Automerge.initializeWasm(automergeWasmUrl);await wasm;
   }
   const items=Object.fromEntries(request.entries),converted=exportManifest(items).items;
   for(const [id,item] of request.entries){
    if(item.kind!=='connector'){const b=request.bounds[id]||objectBounds(item,items,CANVAS_SPACE.width,CANVAS_SPACE.height);minX=Math.min(minX,b.minX);minY=Math.min(minY,b.minY);maxX=Math.max(maxX,b.maxX);maxY=Math.max(maxY,b.maxY);}
    const part=JSON.stringify(id)+':'+JSON.stringify(converted[id]);size+=part.length+1;if(size>MAX_COPY_BYTES)throw Error('복사할 데이터가 너무 큽니다. 선택한 객체 수를 줄여주세요.');parts.push(part);
   }
  }else if(request.type==='finish'){
   const anchor=Number.isFinite(minX)?{x:(minX+maxX)/2*CANVAS_SPACE.width,y:(minY+maxY)/2*CANVAS_SPACE.height}:{x:0,y:0};
   const header=JSON.stringify({type:CLIPBOARD_TYPE,version:1,canvasId,anchor});
   const text=header.slice(0,-1)+',"items":{'+parts.join(',')+'}}';parts=[];
   if(text.length>MAX_COPY_BYTES)throw Error('복사할 데이터가 너무 큽니다. 선택한 객체 수를 줄여주세요.');
   self.postMessage({sequence:request.sequence,text});return;
  }
  self.postMessage({sequence:request.sequence,ok:true});
 }).catch(error=>{parts=[];self.postMessage({sequence:request.sequence,error:error.message});});
};
