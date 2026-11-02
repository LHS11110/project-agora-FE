import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlueprintStore } from '../src/canvas/runtime/blueprintStore.js';
import { resolveBlueprint } from '../src/canvas/runtime/blueprintGraph.js';
import { needsVectorDom, isVectorItem } from '../src/canvas/vectorHitTest.js';

const graph = () => ({ run: {kind:'shape',runtimeRole:'executor'}, code:{kind:'code',language:'python',code:'print(1)'},
  out:{kind:'shape',runtimeRole:'output'}, mirror:{kind:'shape',runtimeRole:'output'},
  a:{kind:'connector',from:'run',to:'code'}, b:{kind:'connector',from:'code',to:'out'},c:{kind:'connector',from:'out',to:'mirror'} });

test('result chains fan out, cycles are rejected, and blueprint nodes stay interactive without selection', () => {
  const items=graph();
  assert.deepEqual(resolveBlueprint(items,'run'),[{codeId:'code',outputIds:['out','mirror']}]);
  assert.equal(isVectorItem(items.run),false);
  assert.equal(needsVectorDom('run',items.run,new Set(),null,null),true);
  items.d={kind:'connector',from:'mirror',to:'out'};
  assert.throws(()=>resolveBlueprint(items,'run'),/순환/);
});

test('only executor runs and removed output links receive no pending result', async () => {
  const items=graph(),written=[];let finish,calls=0;
  const store=createBlueprintStore({getItems:()=>items,execute:()=>{calls++;return new Promise(resolve=>{finish=resolve;});},saveOutput:(id,records)=>{written.push([id,records]);return true;}});
  const running=store.run('run');
  await store.run('run');
  assert.equal(calls,1);
  delete items.c;
  finish({exitCode:0,output:'1\n'});await running;
  assert.deepEqual(written.map(([id])=>id),['out']);
  assert.equal(written[0][1][0].output,'1\n');
  assert.equal(store.get('run').completed,true);
});

test('unsupported languages fail before any code executes or results are written', async () => {
  const items=graph();items.code.language='ruby';let executed=false;
  const store=createBlueprintStore({getItems:()=>items,execute:async()=>{executed=true;},saveOutput:()=>true});
  await store.run('run');assert.equal(executed,false);assert.match(store.get('run').error,/言語|언어/);
});

test('reset shares the run lock, clears executor status, and preserves stored outputs', async () => {
  const items=graph(), requests=[], writes=[];
  let finish;
  const store=createBlueprintStore({getItems:()=>items, execute:request=>{
    requests.push(request);
    return new Promise(resolve=>{finish=resolve;});
  },saveOutput:(...args)=>{writes.push(args);return true;}});
  const reset=store.reset('run');
  await store.run('run');
  assert.deepEqual(requests,[{action:'reset'}]);
  finish({reset:true});await reset;
  assert.equal(store.get('run').reset,true);
  assert.deepEqual(writes,[]);
  const running=store.run('run');
  await store.reset('run');
  assert.equal(requests.length,2);
  finish({exitCode:0,output:'ok'});await running;
  assert.equal(store.get('run').completed,true);
});

test('activity reports pending code and preserves terminal outcomes until dismissed', async()=>{
 const items=graph();let finish;const changes=[];
 const store=createBlueprintStore({getItems:()=>items,execute:()=>new Promise(resolve=>{finish=resolve;}),saveOutput:()=>true});
 const unsubscribe=store.subscribeActivity(()=>changes.push(store.getActivity()));
 const pending=store.runCode('code');
 assert.equal(store.getActivity().language,'python');
 assert.equal(store.getActivity().current,1);
 assert.equal(store.getActivity().total,1);
 assert.equal(store.getActivity().phase,'run');
 finish({exitCode:0,output:'ok'});await pending;assert.equal(store.getActivity().status,'success');assert.equal(store.getActivity().entries[0].exitCode,0);assert.equal(store.isRunning(),false);store.dismissActivity();assert.equal(store.getActivity(),null);
 const reset=store.reset('run');assert.equal(store.getActivity().phase,'reset');
 finish({reset:false});await reset;assert.equal(store.getActivity().status,'error');assert.ok(store.get('run').error);store.dismissActivity();assert.equal(store.getActivity(),null);
 unsubscribe();assert.ok(changes.length>=4);
});

test('activity names the failing code, retains each step outcome and stops remaining execution',async()=>{
 const items=graph();items.code.filename='prepare.py';items.next={kind:'code',filename:'consume.cpp',language:'cpp',code:'consume'};items.link={kind:'connector',from:'out',to:'next'};
 let calls=0;const store=createBlueprintStore({getItems:()=>items,execute:async()=>++calls===1?{exitCode:0,output:'1\n'}:{exitCode:2,output:'missing input'},saveOutput:()=>true});
 await store.run('run');const a=store.getActivity();
 assert.equal(a.status,'error');assert.equal(a.codeName,'consume.cpp');assert.equal(a.current,2);assert.equal(a.total,2);assert.ok(a.endedAt>=a.startedAt);
 assert.deepEqual(a.entries.map(e=>[e.codeName,e.status,e.exitCode]),[['prepare.py','success',0],['consume.cpp','error',2]]);assert.equal(a.entries[1].detail,'missing input');
});
test('running activity cannot be dismissed and timeout is distinguishable from normal failure',async()=>{
 const items=graph();let finish;const store=createBlueprintStore({getItems:()=>items,execute:()=>new Promise(resolve=>{finish=resolve;}),saveOutput:()=>true});
 const running=store.run('run');store.dismissActivity();assert.equal(store.getActivity().status,'running');finish({exitCode:1,timedOut:true,output:''});await running;
 assert.equal(store.getActivity().status,'error');assert.equal(store.getActivity().entries[0].timedOut,true);
});
