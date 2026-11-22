import test from 'node:test';import assert from 'node:assert/strict';import {createLiveContentRegistry} from '../src/canvas/content/LiveContentContext.js';
test('explicit live content is bounded and eviction never changes persisted canvas data',()=>{const store=createLiveContentRegistry(2);let calls=0;const stop=store.subscribe(()=>calls++);const first=store.getSnapshot();store.activate('a');store.activate('a');assert.equal(calls,1);assert.notEqual(store.getSnapshot(),first);store.activate('b');store.activate('c');assert.deepEqual(store.getSnapshot(),['b','c']);store.prune(new Set(['c']));assert.deepEqual(store.getSnapshot(),['c']);store.deactivate('c');assert.deepEqual(store.getSnapshot(),[]);stop();store.activate('d');assert.equal(calls,5);});

test('changed source identity requires a fresh activation and eviction advances generation',()=>{const store=createLiveContentRegistry(1);const first=store.activate('a','youtube:first');assert.equal(store.identity('a'),'youtube:first');assert.equal(store.activate('a','youtube:first'),first);const second=store.activate('a','youtube:second');assert.ok(second>first);store.activate('b','notebook');assert.equal(store.generation('a'),0);assert.ok(store.activate('a','youtube:first')>second);});

test('only one YouTube player stays live; other live content keeps the shared limit',()=>{
 const store=createLiveContentRegistry(6);
 store.activate('v1','youtube:https://www.youtube.com/watch?v=a');
 store.activate('t1','terminal:t1');
 store.activate('v2','youtube:https://www.youtube.com/watch?v=b');
 assert.deepEqual(store.getSnapshot(),['t1','v2']);
 assert.equal(store.generation('v1'),0);
 store.activate('n1','notebook');
 assert.deepEqual(store.getSnapshot(),['t1','v2','n1']);
});
