import test from 'node:test';import assert from 'node:assert/strict';import {needsFreshWorkerFrame} from '../src/canvas/wgpu/workerFramePolicy.js';
test('moving cameras request fresh frames, idle/redundant camera events reuse pixels',()=>{
 assert.equal(needsFreshWorkerFrame({moving:true,changed:true,hasFrame:true}),true);
 assert.equal(needsFreshWorkerFrame({moving:true,changed:false,hasFrame:true}),false);
 assert.equal(needsFreshWorkerFrame({moving:false,changed:false,hasFrame:true}),false);
 assert.equal(needsFreshWorkerFrame({moving:false,changed:false,hasFrame:false}),true);
});
