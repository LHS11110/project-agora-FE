// RFC 6902 subset emitted by nlohmann::json::diff; never resolve prototype keys.
export function applyItemDelta(item,operations){
 if(!item||!Array.isArray(operations))throw Error('DELTA_BASE_MISSING');
 const next=structuredClone(item);
 for(const op of operations){
  if(!['add','remove','replace','text'].includes(op.op)||typeof op.path!=='string'||!op.path.startsWith('/'))throw Error('DELTA_INVALID');
  const path=op.path.slice(1).split('/').map(p=>p.replace(/~1/g,'/').replace(/~0/g,'~'));
  if(path.some(p=>['__proto__','constructor','prototype'].includes(p)))throw Error('DELTA_INVALID');
  let target=next;for(const key of path.slice(0,-1)){if(!Object.hasOwn(target,key))throw Error('DELTA_BASE_MISSING');target=target[key];}
  const key=path.at(-1);
  if(Array.isArray(target)){
   const index=key==='-'?target.length:Number(key);
   if(!Number.isInteger(index)||index<0||index>(op.op==='add'?target.length:target.length-1))throw Error('DELTA_INVALID');
   if(op.op==='add')target.splice(index,0,op.value);else if(op.op==='remove')target.splice(index,1);else target[index]=op.op==='text'?applyTextDelta(target[index],op.value):op.value;
  }else{
   if(!target||typeof target!=='object'||op.op!=='add'&&!Object.hasOwn(target,key))throw Error('DELTA_BASE_MISSING');
   if(op.op==='remove')delete target[key];else target[key]=op.op==='text'?applyTextDelta(target[key],op.value):op.value;
  }
 }
 return next;
}

// Keep the local full value for rebasing; transmit only edited cells when order is unchanged.
export function notebookEdits(before,after){
 if(!Array.isArray(before)||!Array.isArray(after)||before.length!==after.length||before.some((c,i)=>c.id!==after[i].id))return null;
 return after.flatMap((cell,i)=>{const patch={};for(const field of ['source','cellType'])if(before[i][field]!==cell[field])patch[field]=cell[field];return Object.keys(patch).length?[{id:cell.id,patch}]:[];});
}
export function operationForWire(operation,deltaSupported=true){
 const {doc,base,notebookBase,notebookResultBase,textBase,knownChanges,snapshotKnown,...wire}=operation;
 if(!deltaSupported)return wire;
 wire.patch={...wire.patch};
 if(snapshotKnown)delete wire.patch.automerge_snapshot;
 if(knownChanges&&wire.patch.automerge_changes){const seen=new Set(knownChanges.map(c=>c.change));wire.patch.automerge_changes=wire.patch.automerge_changes.filter(c=>!seen.has(c.change));}
 if(textBase&&Object.keys(textBase).length){wire.text_edits={};for(const [field,before] of Object.entries(textBase)){if(typeof wire.patch[field]==='string'){wire.text_edits[field]=textDelta(before,wire.patch[field]);delete wire.patch[field];}}}
 if(operation.action==='patch'&&Array.isArray(notebookBase)&&Array.isArray(wire.patch?.notebookCells)){
  const after=wire.patch.notebookCells,byId=new Map(notebookBase.map(cell=>[cell.id,cell]));
  const edits=after.filter(cell=>byId.has(cell.id)).flatMap(cell=>{
   const before=byId.get(cell.id),patch={};if(before.cellType!==cell.cellType)patch.cellType=cell.cellType;
   return before.source!==cell.source?[{id:cell.id,patch,source_delta:textDelta(before.source,cell.source)}]:Object.keys(patch).length?[{id:cell.id,patch}]:[];
  });
  wire.patch={...wire.patch};delete wire.patch.notebookCells;
  if(edits.length)wire.notebook_edits=edits;
  if(notebookBase.length!==after.length||notebookBase.some((cell,index)=>cell.id!==after[index]?.id)){
   const ids=new Set(after.map(cell=>cell.id));wire.notebook_structure={order:after.map(cell=>cell.id),insert:after.filter(cell=>!byId.has(cell.id)),remove:notebookBase.filter(cell=>!ids.has(cell.id)).map(cell=>cell.id)};
  }
 }
 if(operation.action==='patch'&&notebookResultBase&&wire.patch?.notebookResults){
  const after=wire.patch.notebookResults,set={};for(const [id,result] of Object.entries(after))if(JSON.stringify(notebookResultBase[id])!==JSON.stringify(result))set[id]=result;
  wire.notebook_results={set,remove:Object.keys(notebookResultBase).filter(id=>!Object.hasOwn(after,id))};delete wire.patch.notebookResults;
 }
 return wire;
}

const utf8=new TextEncoder();
export function textDelta(before,after){
 let at=0,end=0;while(at<before.length&&at<after.length&&before[at]===after[at])at++;
 if(at&&at<before.length&&/[\uDC00-\uDFFF]/.test(before[at]))at--;
 while(end<before.length-at&&end<after.length-at&&before[before.length-1-end]===after[after.length-1-end])end++;
 if(end&&/[\uDC00-\uDFFF]/.test(before[before.length-end]))end--;
 let hash=14695981039346656037n;for(const c of utf8.encode(before))hash=BigInt.asUintN(64,(hash^BigInt(c))*1099511628211n);
 return {at:utf8.encode(before.slice(0,at)).length,remove:utf8.encode(before.slice(at,before.length-end)).length,insert:after.slice(at,after.length-end),base:hash.toString()};
}
export function applyTextDelta(before,edit){
 const bytes=utf8.encode(before);if(textDelta(before,before).base!==edit.base)throw Error('DELTA_BASE_MISSING');
 if(!Number.isSafeInteger(edit.at)||!Number.isSafeInteger(edit.remove)||edit.at<0||edit.remove<0||edit.at+edit.remove>bytes.length)throw Error('DELTA_INVALID');
 const decoder=new TextDecoder('utf-8',{fatal:true});
 return decoder.decode(bytes.slice(0,edit.at))+edit.insert+decoder.decode(bytes.slice(edit.at+edit.remove));
}

export function mergeNotebookCells(current,before,after){
 const previous=new Map(before.map(cell=>[cell.id,cell])),desired=new Set(after.map(cell=>cell.id));
 const byId=new Map(current.filter(cell=>!previous.has(cell.id)||desired.has(cell.id)).map(cell=>[cell.id,cell]));
 for(const cell of after){
  const old=previous.get(cell.id);
  if(!old){byId.set(cell.id,cell);continue;}
  if(!byId.has(cell.id))continue;
  const patch={};for(const field of ['source','cellType'])if(old[field]!==cell[field])patch[field]=cell[field];
  byId.set(cell.id,{...byId.get(cell.id),...patch});
 }
 const result=[];for(const cell of after)if(byId.has(cell.id)){result.push(byId.get(cell.id));byId.delete(cell.id);}
 return [...result,...byId.values()];
}
