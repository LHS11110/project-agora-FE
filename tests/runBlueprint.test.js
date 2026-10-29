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
