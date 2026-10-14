import * as Automerge from '@automerge/automerge/slim';
import { collaborativeField,createActorId,decodeBase64,encodeBase64 } from '../collaborativeSync.js';
const encoded=new Map(),items=new WeakMap(),saved=new WeakMap();let bytes=0;
const fork=doc=>Automerge.clone(doc,{actor:createActorId()});
const changeBytes=entry=>typeof entry==='string'?entry:entry?.change;
function remember(encodedValue,doc){
 if(encoded.has(encodedValue))return;
 encoded.set(encodedValue,fork(doc));bytes+=encodedValue.length;
 while(encoded.size>32||bytes>8*1024*1024){const key=encoded.keys().next().value;bytes-=key.length;encoded.delete(key);}
}
export function encodeDocument(doc){
 let value=saved.get(doc);if(!value){value=encodeBase64(Automerge.save(doc));saved.set(doc,value);remember(value,doc);}return value;
}
export function loadEncodedDocument(value){
 const cached=encoded.get(value);if(cached){encoded.delete(value);encoded.set(value,cached);return fork(cached);}
 const doc=Automerge.load(decodeBase64(value),{actor:createActorId()});remember(value,doc);return doc;
}
export function rememberItemDocument(item,doc){items.set(item,{snapshot:item.automerge_snapshot,changes:item.automerge_changes,text:item[collaborativeField(item)],doc:fork(doc)});}
export function cachedItemDocument(item){
 const cache=items.get(item);return cache&&cache.snapshot===item.automerge_snapshot&&cache.changes===item.automerge_changes&&cache.text===item[collaborativeField(item)]?fork(cache.doc):null;
}
// Incoming commits normally extend the history already parsed for the previous
// record. Divergent histories use the normal complete validation/load path.
export function inheritItemDocument(before,after){
 if(!before||!after||items.has(after)||before.kind!==after.kind||before.automerge_snapshot!==after.automerge_snapshot)return;
 const old=items.get(before),previous=before.automerge_changes||[],next=after.automerge_changes||[];
 if(!old||next.length<previous.length||previous.some((entry,i)=>changeBytes(entry)!==changeBytes(next[i])))return;
 try{let doc=fork(old.doc);for(const entry of next.slice(previous.length))doc=Automerge.loadIncremental(doc,decodeBase64(changeBytes(entry)));rememberItemDocument(after,doc);}catch{ /* Malformed state is handled by the ordinary loader. */ }
}

export function includesDocument(next,previous){
 try{return Automerge.hasHeads(loadEncodedDocument(next),Automerge.getHeads(loadEncodedDocument(previous)));}catch{return false;}
}
