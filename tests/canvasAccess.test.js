import test from 'node:test';
import assert from 'node:assert/strict';
import {canvasPasswordGrantKey,isUnexpiredJwt,readCanvasPasswordGrant,saveCanvasPasswordGrant} from '../src/canvas/canvasAccess.js';
const token=exp=>'header.'+Buffer.from(JSON.stringify({exp})).toString('base64url')+'.signature';
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};};
test('remembered grants retain original expiration across reads and are scoped to canvas/user',()=>{
 const oldLocal=globalThis.localStorage,oldSession=globalThis.sessionStorage;
 globalThis.localStorage=storage();globalThis.sessionStorage=storage();
 try{
  const key=canvasPasswordGrantKey(12,{email:'a@example.invalid'}),grant=token(Math.floor(Date.now()/1000)+1800);
  saveCanvasPasswordGrant(key,grant);assert.equal(readCanvasPasswordGrant(key),grant);
  globalThis.sessionStorage=storage();assert.equal(readCanvasPasswordGrant(key),grant,'new tabs reuse local storage');
  assert.equal(readCanvasPasswordGrant(canvasPasswordGrantKey(13,{email:'a@example.invalid'})),null);
  assert.equal(readCanvasPasswordGrant(canvasPasswordGrantKey(12,{email:'b@example.invalid'})),null);
  saveCanvasPasswordGrant(key,token(Math.floor(Date.now()/1000)-1));assert.equal(readCanvasPasswordGrant(key),null);
 }finally{globalThis.localStorage=oldLocal;globalThis.sessionStorage=oldSession;}
});
test('expired/malformed grants are removed; rejected grants clear both stores',()=>{
 const oldLocal=globalThis.localStorage,oldSession=globalThis.sessionStorage;
 globalThis.localStorage=storage();globalThis.sessionStorage=storage();
 try{localStorage.setItem('key','broken');sessionStorage.setItem('key',token(1));assert.equal(readCanvasPasswordGrant('key'),null);assert.equal(localStorage.getItem('key'),null);const grant=token(Math.floor(Date.now()/1000)+1800);saveCanvasPasswordGrant('key',grant);saveCanvasPasswordGrant('key',null);assert.equal(sessionStorage.getItem('key'),null);assert.equal(localStorage.getItem('key'),null);assert.equal(isUnexpiredJwt('bad'),false);}
 finally{globalThis.localStorage=oldLocal;globalThis.sessionStorage=oldSession;}
});
test('grant expires 30 minutes after authentication, without sliding renewal',()=>{
 const oldLocal=globalThis.localStorage,oldSession=globalThis.sessionStorage,now=Date.now;let clock=1700000000000;
 globalThis.localStorage=storage();globalThis.sessionStorage=storage();Date.now=()=>clock;
 try{const grant=token(clock/1000+1800);saveCanvasPasswordGrant('key',grant);clock+=1799999;assert.equal(readCanvasPasswordGrant('key'),grant);clock++;assert.equal(readCanvasPasswordGrant('key'),null);}
 finally{Date.now=now;globalThis.localStorage=oldLocal;globalThis.sessionStorage=oldSession;}
});
