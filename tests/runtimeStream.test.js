import test from 'node:test';
import assert from 'node:assert/strict';
import {readRuntimeStream} from '../src/canvas/runtime/readRuntimeStream.js';
import {createBlueprintStore} from '../src/canvas/runtime/blueprintStore.js';
const enc=new TextEncoder();
test('streams split UTF-8 and NDJSON before terminal result',async()=>{
 let push,close;const seen=[];
 const response={body:new ReadableStream({start(c){push=b=>c.enqueue(b);close=()=>c.close();}})};
 const result=readRuntimeStream(response,text=>seen.push(text));
 const first=enc.encode(JSON.stringify({type:'output',output:'한글\n'})+'\n');
 for(const byte of first)push(new Uint8Array([byte]));
 await new Promise(resolve=>setTimeout(resolve,5));assert.deepEqual(seen,['한글\n']);
 push(enc.encode(JSON.stringify({type:'result',result:{exitCode:0,output:'한글\n'}})+'\n'));close();assert.equal((await result).exitCode,0);
});
test('truncated HTTP response never reports success',async()=>{
 const response=new Response('{"type":"output","output":"partial"}\n');const seen=[];
 await assert.rejects(readRuntimeStream(response,text=>seen.push(text)),/연결이 종료/);assert.deepEqual(seen,['partial']);
});
test('connected output objects show partial text while running and replace the same record at completion',async()=>{
 const items={run:{runtimeRole:'executor'},code:{kind:'code',language:'python',code:'slow'},a:{runtimeRole:'output'},b:{runtimeRole:'output'},e:{kind:'connector',from:'run',to:'code'},x:{kind:'connector',from:'code',to:'a'},y:{kind:'connector',from:'code',to:'b'}};
 let finish,onOutput;const writes=[];
 const store=createBlueprintStore({getItems:()=>items,execute:request=>{onOutput=request.onOutput;return new Promise(resolve=>{finish=resolve;});},saveOutput:(id,records)=>{items[id].runtimeResults=records;writes.push([id,records]);return true;}});
 const run=store.run('run');onOutput('one\n');assert.equal(items.a.runtimeResults[0].output,'one\n');assert.equal(items.b.runtimeResults[0].output,'one\n');assert.equal(store.isRunning(),true);assert.equal(items.a.runtimeResults[0].exitCode,undefined);
 for(let i=0;i<100;i++)onOutput('x');assert.equal(writes.length,2);
 await new Promise(resolve=>setTimeout(resolve,120));assert.equal(writes.length,4);
 finish({exitCode:0,output:'one\n'+'x'.repeat(100)});await run;
 assert.equal(items.a.runtimeResults.length,1);assert.equal(items.a.runtimeResults[0].exitCode,0);assert.equal(items.a.runtimeResults[0].output,items.b.runtimeResults[0].output);assert.equal(store.isRunning(),false);
 const count=writes.length;await new Promise(resolve=>setTimeout(resolve,120));assert.equal(writes.length,count);
});
