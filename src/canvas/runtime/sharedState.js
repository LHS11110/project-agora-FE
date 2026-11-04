export function isRuntimeStateTarget(item){return item?.kind==='code'||item?.kind==='text'&&item.renderMode==='code'||item?.kind==='shape'&&['executor','notebook'].includes(item.runtimeRole);}
export function isRuntimeOnlyOperation(item,operation){
 if(operation?.action!=='patch'||(operation.unset||[]).length||Object.keys(operation.patch||{}).length!==1)return false;
 return item?.runtimeRole==='notebook'&&Object.hasOwn(operation.patch,'notebookResults')||item?.runtimeRole==='output'&&Object.hasOwn(operation.patch,'runtimeResults')||isRuntimeStateTarget(item)&&Object.hasOwn(operation.patch,'runtimeState');
}
export function validMediaState(state){return Boolean(state&&typeof state==='object'&&!Array.isArray(state)&&Object.keys(state).every(k=>['paused','time','updatedAt','actor'].includes(k))&&typeof state.paused==='boolean'&&Number.isFinite(state.time)&&state.time>=0&&state.time<=31536000&&Number.isSafeInteger(state.updatedAt)&&state.updatedAt>=0&&typeof state.actor==='string'&&state.actor.length<=128);}
export function validRuntimeState(item){
 const state=item.runtimeState;if(!isRuntimeStateTarget(item))return false;if(state===null)return true;
 if(!state||typeof state!=='object'||Array.isArray(state)||JSON.stringify(state).length>120000)return false;
 const booleans=['running','building','completed','failed','built','reset'],strings=['status','phase','runId','source','language','detail','error'];
 if(Object.keys(state).some(k=>!booleans.includes(k)&&!strings.includes(k)&&k!=='updatedAt'))return false;
 if(booleans.some(k=>state[k]!==undefined&&typeof state[k]!=='boolean')||strings.some(k=>state[k]!==undefined&&typeof state[k]!=='string'))return false;
 return Number.isSafeInteger(state.updatedAt)&&state.updatedAt>=0&&(state.status===undefined||['running','queued','success','error','skipped'].includes(state.status));
}
