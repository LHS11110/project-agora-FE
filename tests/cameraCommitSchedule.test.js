import test from 'node:test';import assert from 'node:assert/strict';
import {shouldCommitCamera} from '../src/canvas/cameraCommitSchedule.js';
const previous={x:0,y:0,scale:1},viewport={width:1200,height:800};
test('small pan and zoom reuse membership without a periodic React refresh',()=>{
 for(let i=0;i<10000;i++)assert.equal(shouldCommitCamera(previous,{x:Math.sin(i)*200,y:Math.cos(i)*100,scale:1},viewport),false);
 assert.equal(shouldCommitCamera(previous,{x:0,y:0,scale:.9},viewport),false);
});
test('pan or zoom out refreshes membership before prepared overscan is consumed',()=>{
 for(const next of [{x:-257,y:0,scale:1},{x:0,y:257,scale:1},{x:0,y:0,scale:.8}])assert.equal(shouldCommitCamera(previous,next,viewport),true);
});
test('large zoom in trims the retained scene, and coverage respects zoom anchor',()=>{
 assert.equal(shouldCommitCamera(previous,{x:-600,y:-400,scale:2},viewport),true);
 assert.equal(shouldCommitCamera(previous,{x:-120,y:-80,scale:1.2},viewport),false);
 assert.equal(shouldCommitCamera(previous,{x:900,y:0,scale:1.2},viewport),true);
});
