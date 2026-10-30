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
