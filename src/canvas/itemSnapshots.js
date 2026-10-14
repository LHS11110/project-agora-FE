// Structurally shared, read-only item dictionaries. Updating one item copies one
// small hash bucket; Object.keys/entries and JSON export retain dictionary APIs.
const states = new WeakMap(), BUCKETS = 256, CHUNK = 1024;
const depth = item => Number.isSafeInteger(Number(item?.depth))?Number(item.depth):0;
const hash = id => { let h=2166136261;for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);return h>>>24; };
function record(state,id){return typeof id==='string'?state.buckets[hash(id)]?.[id]:undefined;}
function wrap(state){
  const value=new Proxy({}, {
    get:(_,id)=>{const r=record(state,id);return r?r.value:Reflect.get(Object.prototype,id);},
    has:(_,id)=>Boolean(record(state,id)),
    ownKeys:()=>state.keys ||= (()=>{const keys=state.chunks.flat().filter(id=>id!==null),numeric=keys.filter(id=>String(Number(id)>>>0)===id && Number(id)<4294967295).sort((a,b)=>Number(a)-Number(b)),numbers=new Set(numeric);return [...numeric,...keys.filter(id=>!numbers.has(id))];})(),
    getOwnPropertyDescriptor:(_,id)=>{const r=record(state,id);return r?{value:r.value,enumerable:true,configurable:true,writable:false}:undefined;},
    set:()=>false,deleteProperty:()=>false,defineProperty:()=>false,
  });states.set(value,state);return value;
}
export function itemSnapshot(items){
  if(states.has(items))return items;
  const state={buckets:Array.from({length:BUCKETS},()=>Object.create(null)),chunks:[],size:0,keys:null,parent:null,changes:null,depths:new Map()};
  for(const [id,value] of Object.entries(items || {})){
    if(value?.kind)state.depths.set(depth(value),(state.depths.get(depth(value))||0)+1);
    const index=state.size++;if(index%CHUNK===0)state.chunks.push([]);
    state.chunks.at(-1).push(id);state.buckets[hash(id)][id]={value,index};
  }
  return wrap(state);
}
export function itemCount(items){return states.get(items)?.size ?? Object.keys(items || {}).length;}
export function changeItems(items,changes,removed=[]){
  const base=itemSnapshot(items),before=states.get(base),pairs=changes instanceof Map?[...changes]:Object.entries(changes || {});
  const updates=new Map(pairs);for(const id of removed)updates.set(String(id),null);
  const state={...before,buckets:before.buckets.slice(),chunks:before.chunks.slice(),parent:new WeakRef(base),changes:[],keys:before.keys,depths:new Map(before.depths)};
  const copied=new Set(),chunks=new Set();
  for(const [key,value] of updates){
    const id=String(key);
    const old=record(before,id);if((!old && value==null)||old?.value===value)continue;
    state.changes.push(id);const bucket=hash(id);
    if(old?.value?.kind){const d=depth(old.value),count=state.depths.get(d)-1;if(count)state.depths.set(d,count);else state.depths.delete(d);}
    if(value?.kind)state.depths.set(depth(value),(state.depths.get(depth(value))||0)+1);
    if(!copied.has(bucket)){state.buckets[bucket]=Object.assign(Object.create(null),state.buckets[bucket]);copied.add(bucket);}
    if(value==null){
      delete state.buckets[bucket][id];state.size--;
      const at=Math.floor(old.index/CHUNK);if(!chunks.has(at)){state.chunks[at]=state.chunks[at].slice();chunks.add(at);}
      state.chunks[at][old.index%CHUNK]=null;state.keys=null;
    }else if(old)state.buckets[bucket][id]={value,index:old.index};
    else{
      const last=state.chunks.length-1;
      if(last<0 || state.chunks[last].length===CHUNK){state.chunks.push([]);chunks.add(state.chunks.length-1);}
      const at=state.chunks.length-1;if(!chunks.has(at)){state.chunks[at]=state.chunks[at].slice();chunks.add(at);}
      const index=at*CHUNK+state.chunks[at].length;state.chunks[at].push(id);
      state.buckets[bucket][id]={value,index};state.size++;state.keys=null;
    }
  }
  return state.changes.length?wrap(state):base;
}
// A rebased view can share data with committed state while its visible diff is
// relative to the previous React view. Only weak links retain past revisions.
export function linkItemChanges(items,previous,ids){
  const state=states.get(items);if(state && items!==previous){state.parent=previous?new WeakRef(previous):null;state.changes=ids;}return items;
}
export function changedItemIds(before,after){
  if(before===after)return [];
  let value=after;const result=new Set();
  for(let i=0;i<64;i++){
    const state=states.get(value);if(!state || !state.changes)return null;
    for(const id of state.changes)result.add(id);
    value=state.parent?.deref();if(value===before)return [...result];if(!value)return null;
  }
  return null;
}

export function itemDepthRange(items){const counts=states.get(items)?.depths;if(counts)return{min:Math.min(0,...counts.keys()),max:Math.max(0,...counts.keys())};return Object.values(items).reduce((range,item)=>item?.kind?{min:Math.min(range.min,depth(item)),max:Math.max(range.max,depth(item))}:range,{min:0,max:0});}
