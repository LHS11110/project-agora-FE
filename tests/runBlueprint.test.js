import test from 'node:test';
import assert from 'node:assert/strict';
import { runBlueprint } from '../src/canvas/runtime/runBlueprint.js';

test('runs connected code in order and sends output only to connected results', async () => {
  const items = { run: {runtimeRole:'executor'}, a: {kind:'code',code:'first',language:'python'},
    b: {kind:'code',code:'second',language:'javascript'}, x:{runtimeRole:'output'}, y:{runtimeRole:'output'}, z:{runtimeRole:'output'},
    e1:{kind:'connector',from:'run',to:'a'},e2:{kind:'connector',from:'run',to:'b'},
    e3:{kind:'connector',from:'a',to:'x'},e4:{kind:'connector',from:'a',to:'y'},e5:{kind:'connector',from:'b',to:'y'} };
  const executions = [], output = [];
  await runBlueprint(items,'run',async step => { executions.push(step.code); return {exitCode:0,output:step.code}; }, (id, result) => output.push([id,result.codeId,result.result.output]));
  assert.deepEqual(executions,['first','second']);
  assert.deepEqual(output,[['x','a','first'],['y','a','first'],['y','b','second']]);
});

test('execution failure stops subsequent code and reports only to connected outputs', async () => {
  const items={run:{runtimeRole:'executor'},a:{kind:'code',code:'fail',language:'python'},b:{kind:'code',code:'later',language:'python'},out:{runtimeRole:'output'},
    e1:{kind:'connector',from:'run',to:'a'},e2:{kind:'connector',from:'run',to:'b'},e3:{kind:'connector',from:'a',to:'out'}};
  let calls=0; const output=[];
  await runBlueprint(items,'run',async () => { calls++; throw new Error('offline'); },(id,result)=>output.push([id,result.result.error]));
  assert.equal(calls,1); assert.deepEqual(output,[['out','offline']]);
});

test('kernel resets are visible and persisted using the broker result schema', async () => {
  const items={run:{runtimeRole:'executor'},a:{kind:'code',code:'while True: pass',language:'python'},out:{runtimeRole:'output'},
    e1:{kind:'connector',from:'run',to:'a'},e2:{kind:'connector',from:'a',to:'out'}};
  let saved;
  const outcome=await runBlueprint(items,'run',async()=>({exitCode:1,output:'last output',timedOut:true,truncated:false,environmentReset:true}),
    (_id,entry)=>{saved=entry.result;});
  assert.equal(outcome.failed,true);
  assert.match(saved.error,/last output/);
  assert.match(saved.error,/초기화/);
  assert.equal(Object.hasOwn(saved,'environmentReset'),false);
});

test('result to code edges schedule producers first and use fresh outputs as stdin',async()=>{
 const items={run:{runtimeRole:'executor'},a:{kind:'code',language:'python',code:'produce'},b:{kind:'code',language:'cpp',code:'consume'},out:{runtimeRole:'output',runtimeResults:[{output:'stale'}]},final:{runtimeRole:'output'},e1:{kind:'connector',from:'run',to:'a'},e2:{kind:'connector',from:'a',to:'out'},e3:{kind:'connector',from:'out',to:'b'},e4:{kind:'connector',from:'b',to:'final'}};
 const calls=[];await runBlueprint(items,'run',async request=>{calls.push(request);return {exitCode:0,output:request.code==='produce'?'10\n20\n':'30\n'};},()=>{});
 assert.deepEqual(calls,[{language:'python',code:'produce'},{language:'cpp',code:'consume',stdin:'10\n20\n'}]);
});
test('stored result records become sequential lines; empty connected results differ from no input',async()=>{
 const items={code:{kind:'code',code:'read',language:'python'},top:{runtimeRole:'output',y:10,runtimeResults:[{output:'one'},{output:'two\nthree\n'},{exitCode:0}]},bottom:{runtimeRole:'output',y:20,runtimeResults:[{output:'four'}]},a:{kind:'connector',from:'bottom',to:'code'},b:{kind:'connector',from:'top',to:'code'}};
 let received;const run=()=>runBlueprint(items,'code',async request=>{received=request;return {exitCode:0};},()=>{},{codeOnly:true});
 await run();assert.equal(received.stdin,'one\ntwo\nthree\nfour\n');
 items.top.runtimeResults=[];items.bottom.runtimeResults=[];await run();assert.equal(received.stdin,'');
 delete items.a;delete items.b;await run();assert.equal(Object.hasOwn(received,'stdin'),false);
});
test('result feedback cycles are rejected before execution',async()=>{
 const items={code:{kind:'code',code:'x',language:'python'},out:{runtimeRole:'output'},a:{kind:'connector',from:'code',to:'out'},b:{kind:'connector',from:'out',to:'code'}};
 let called=false;await assert.rejects(runBlueprint(items,'code',async()=>{called=true;},()=>{},{codeOnly:true}),/순환/);assert.equal(called,false);
});
