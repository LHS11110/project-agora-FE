const DB='frelog-repository-client',DAY=24*60*60*1000;
export const TOKEN_TTL=DAY;
function open(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{for(const name of ['tokens','drafts'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function transaction(store,mode,fn){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);const r=fn(tx.objectStore(store));let value;r.onsuccess=()=>value=r.result;r.onerror=()=>reject(r.error);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
export const repositoryIdentity=user=>String(user?.user_id??user?.userId??user?.email??`${user?.nickname}#${user?.tag_number}`);
export function tokenScope(user,target){return `${location.origin}|${repositoryIdentity(user)}|${target.owner.toLowerCase()}/${target.repo.toLowerCase()}`;}
export async function rememberRepositoryToken(scope,token){
 if(location.protocol!=='https:'||!crypto.subtle)throw new Error('토큰 보관은 HTTPS에서만 사용할 수 있습니다.');
 const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']),iv=crypto.getRandomValues(new Uint8Array(12)),expiresAt=Date.now()+DAY;
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(scope)},key,new TextEncoder().encode(token));
 await transaction('tokens','readwrite',s=>s.put({id:scope,key,iv,data,expiresAt}));return expiresAt;
}
export async function storedRepositoryToken(scope){
 const entry=await transaction('tokens','readonly',s=>s.get(scope));if(!entry)return null;
 if(entry.expiresAt<=Date.now()||entry.expiresAt>Date.now()+DAY){await forgetRepositoryToken(scope);return null;}
 try{const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:entry.iv,additionalData:new TextEncoder().encode(scope)},entry.key,entry.data);return {token:new TextDecoder().decode(data),expiresAt:entry.expiresAt};}
 catch{await forgetRepositoryToken(scope);return null;}
}
export const forgetRepositoryToken=scope=>transaction('tokens','readwrite',s=>s.delete(scope));
export const draftScope=(user,canvasId)=>`${location.origin}|${repositoryIdentity(user)}|${canvasId}`;
export async function createLocalCommit(scope,value){const draft={...value,id:crypto.randomUUID(),scope,createdAt:Date.now()};await transaction('drafts','readwrite',s=>s.put(draft));return draft;}
export async function localCommits(scope){return (await transaction('drafts','readonly',s=>s.getAll())).filter(d=>d.scope===scope).sort((a,b)=>b.createdAt-a.createdAt);}
export const removeLocalCommit=id=>transaction('drafts','readwrite',s=>s.delete(id));
