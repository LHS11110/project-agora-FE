import test from 'node:test';import assert from 'node:assert/strict';
import {shouldCommitCamera} from '../src/canvas/cameraCommitSchedule.js';
const previous={x:0,y:0,scale:1},viewport={width:1200,height:800};
test('small pan and zoom reuse membership without a periodic React refresh',()=>{
 for(let i=0;i<10000;i++)assert.equal(shouldCommitCamera(previous,{x:Math.sin(i)*200,y:Math.cos(i)*100,scale:1},viewport),false);
 assert.equal(shouldCommitCamera(previous,{x:0,y:0,scale:.9},viewport),false);
});
test('pan or zoom out refreshes membership before prepared overscan is consumed',()=>{
 for(const next of [{x:-301,y:0,scale:1},{x:0,y:201,scale:1},{x:0,y:0,scale:.79}])assert.equal(shouldCommitCamera(previous,next,viewport),true);
});
test('large zoom in trims the retained scene, and coverage respects zoom anchor',()=>{
 assert.equal(shouldCommitCamera(previous,{x:-600,y:-400,scale:2},viewport),true);
 assert.equal(shouldCommitCamera(previous,{x:-120,y:-80,scale:1.2},viewport),false);
 assert.equal(shouldCommitCamera(previous,{x:900,y:0,scale:1.2},viewport),true);
});

test('refresh is based on the actual retained ring even when earlier React commits reused it',()=>{
 const world={width:1600,height:1000};
 const prepared={world,bounds:{minX:-600/1600,minY:-400/1000,maxX:1800/1600,maxY:1200/1000}};
 const alreadyCommitted={x:-300,y:0,scale:1};
 assert.equal(shouldCommitCamera(alreadyCommitted,{x:-301,y:0,scale:1},viewport,prepared),true);
 assert.equal(shouldCommitCamera(alreadyCommitted,{x:-250,y:0,scale:1},viewport,prepared),false);
});
