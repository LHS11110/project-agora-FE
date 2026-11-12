import test from 'node:test';
import assert from 'node:assert/strict';
import {executeCanvasCode,settleRuntimeSocketResponse} from '../src/canvas/runtime/executeCanvasCode.js';
import {runtimeSettingsApi} from '../src/canvas/runtime/runtimeSettings.js';
globalThis.window={setTimeout,clearTimeout};
test('VM settings and reset use the authenticated canvas socket and settle by request id',async()=>{
 const pendingRequests=new Map();const sent=[];
 const request=management=>executeCanvasCode({action:'manage',management,pendingRequests,sendRaw:event=>{sent.push(event);queueMicrotask(()=>settleRuntimeSocketResponse(pendingRequests,{type:'runtime_result',ok:true,request_id:event.request_id,result:{revision:3}}));return true;}});
 const api=runtimeSettingsApi({request});
 assert.deepEqual(await api.load(),{revision:3});await api.resources('small',2);await api.disk(8,2);await api.apply('python',{engine:'python3.14'},2);await api.installJava();
 assert.deepEqual(sent.map(e=>e.management.action),['settings_get','resources_set','disk_set','settings_set','java_dependencies']);
 assert.ok(sent.every(e=>e.type==='runtime_execute'&&e.action==='manage'));assert.equal(pendingRequests.size,0);
 const reset=executeCanvasCode({action:'reset',pendingRequests,sendRaw:event=>{assert.deepEqual(event.management,{action:'reset'});queueMicrotask(()=>settleRuntimeSocketResponse(pendingRequests,{type:'runtime_result',ok:false,request_id:event.request_id,code:'RUNTIME_EXECUTION_DENIED'}));return true;}});
 await assert.rejects(reset,/RUNTIME_EXECUTION_DENIED/);assert.equal(pendingRequests.size,0);
});
test('closed canvas socket rejects VM changes without HTTP fallback',async()=>{
 const pendingRequests=new Map();await assert.rejects(executeCanvasCode({action:'manage',management:{action:'disk_set',sizeGiB:8,revision:1},pendingRequests,sendRaw:()=>false}),/WebSocket/);assert.equal(pendingRequests.size,0);
});
