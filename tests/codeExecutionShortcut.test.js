import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedCodeForShortcut} from '../src/canvas/runtime/codeExecutionShortcut.js';
import {createBlueprintStore} from '../src/canvas/runtime/blueprintStore.js';
const items=()=>({a:{kind:'text',renderMode:'code',language:'python',text:'selected'},b:{kind:'code',language:'python',code:'other'},plain:{kind:'text',text:'plain'},out:{kind:'shape',runtimeRole:'output'},mirror:{kind:'shape',runtimeRole:'output'},in:{kind:'connector',from:'b',to:'a'},next:{kind:'connector',from:'a',to:'b'},e:{kind:'connector',from:'a',to:'out'},m:{kind:'connector',from:'out',to:'mirror'}});
const key={key:'Enter',shiftKey:true};
test('shortcut requires exactly one code selection and Shift+Enter outside composition',()=>{
 const scene=items();assert.equal(selectedCodeForShortcut(key,['a'],scene),'a');
 for(const patch of [{shiftKey:false},{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true},{keyCode:229},{defaultPrevented:true},{key:'Escape'}])assert.equal(selectedCodeForShortcut({...key,...patch},['a'],scene),null);
 for(const selection of [[],['a','b'],['plain'],['missing']])assert.equal(selectedCodeForShortcut(key,selection,scene),null);
 assert.equal(selectedCodeForShortcut(key,['a'],scene,'b'),null);
});
test('selected code executes alone and publishes only to its connected output chain',async()=>{
 const scene=items(),calls=[],writes=[];
 const store=createBlueprintStore({getItems:()=>scene,execute:async request=>{calls.push(request);return {exitCode:0,output:'ok'};},saveOutput:(id,records)=>{writes.push([id,records]);return true;}});
 await store.runCode('a');assert.deepEqual(calls,[{language:'python',code:'selected'}]);assert.deepEqual(writes.map(([id])=>id),['out','mirror']);assert.equal(store.get('a').completed,true);
});
test('single code runs without executor or output and reads the latest edited source',async()=>{
 const scene={a:items().a};let source;
 const store=createBlueprintStore({getItems:()=>scene,execute:async request=>{source=request.code;return {exitCode:0,output:'ok'};},saveOutput:()=>assert.fail('unconnected output')});
 scene.a.text='latest edit';await store.runCode('a');assert.equal(source,'latest edit');assert.equal(store.get('a').completed,true);
});
test('single code uses the same run/reset lock and rechecks output links after execution',async()=>{
 const scene=items(),writes=[];let finish,calls=0;
 scene.run={kind:'shape',runtimeRole:'executor'};scene.start={kind:'connector',from:'run',to:'a'};
 const store=createBlueprintStore({getItems:()=>scene,execute:()=>{calls++;return new Promise(resolve=>{finish=resolve;});},saveOutput:id=>{writes.push(id);return true;}});
 const pending=store.runCode('a');await store.runCode('a');await store.run('run');await store.reset('run');assert.equal(calls,1);
 delete scene.m;finish({exitCode:0,output:'done'});await pending;assert.deepEqual(writes,['out']);
});
