import test from 'node:test';
import assert from 'node:assert/strict';
import { readPanelVisibility, PANEL_VISIBILITY_KEY } from '../src/canvas/panels/panelLayout.js';
test('studio defaults keep the properties panel open and preserve every saved panel choice',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 try{
  globalThis.localStorage={getItem:()=>null};
  assert.deepEqual(readPanelVisibility(),{tools:true,inspector:false,chat:true});
  globalThis.localStorage={getItem:key=>key===PANEL_VISIBILITY_KEY?JSON.stringify({tools:false,inspector:true,chat:false}):null};
  assert.deepEqual(readPanelVisibility(),{tools:false,inspector:true,chat:false});
  globalThis.localStorage={getItem:()=>{throw Error('Storage blocked')}};
  assert.deepEqual(readPanelVisibility(),{tools:true,inspector:false,chat:true});
 }finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;}
});
