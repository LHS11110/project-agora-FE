import {contentMode,contentSource} from './contentPresentation.js';
export const webLanguage=item=>['text','code'].includes(item?.kind)&&contentMode(item)==='code'?item.language:null;
export function createWebAssetStore(){
 let items={};const connections=new Map(),incoming=new Map(),outgoing=new Map(),cache=new Map(),listeners=new Map();
 const add=(map,key,id)=>{if(!map.has(key))map.set(key,new Set());map.get(key).add(id);};
 const remove=(map,key,id)=>{const set=map.get(key);set?.delete(id);if(!set?.size)map.delete(key);};
 const empty=Object.freeze({css:[],js:[]});
 return {
  subscribe(id,fn){add(listeners,id,fn);return()=>remove(listeners,id,fn);},
  get(id){if(cache.has(id))return cache.get(id);if(webLanguage(items[id])!=='html')return empty;
   const css=[],js=[],seen=new Set();
   for(const key of [...(incoming.get(id)||[])].sort()){
    const edge=connections.get(key),source=edge&&items[edge.from],language=webLanguage(source);
    if(!source||seen.has(edge.from))continue;seen.add(edge.from);
    if(language==='css')css.push(contentSource(source));else if(['javascript','js'].includes(language))js.push(contentSource(source));
   }
   const value={css,js};cache.set(id,value);return value;
  },
  update(next,ids){const changed=ids||[...new Set([...Object.keys(items),...Object.keys(next)])],affected=new Set();
   for(const id of changed){
    affected.add(id);for(const key of outgoing.get(id)||[])affected.add(connections.get(key).to);
    const old=connections.get(id);if(old){affected.add(old.to);remove(incoming,old.to,id);remove(outgoing,old.from,id);connections.delete(id);}
    const item=next[id];if(item?.kind==='connector'){const edge={from:String(item.from),to:String(item.to)};connections.set(id,edge);add(incoming,edge.to,id);add(outgoing,edge.from,id);affected.add(edge.to);}
   }
   items=next;for(const id of affected){const previous=cache.get(id);cache.delete(id);const value=this.get(id);if(previous&&JSON.stringify(previous)===JSON.stringify(value)){cache.set(id,previous);continue;}for(const fn of listeners.get(id)||[])fn();}
  },
 };
}
