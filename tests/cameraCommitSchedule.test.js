import test from 'node:test';import assert from 'node:assert/strict';
import {shouldCommitCamera} from '../src/canvas/cameraCommitSchedule.js';
test('rapid large zoom steps cannot force a React scene rebuild every frame',()=>{
 let previous={scale:1,x:0,y:0},last=0,commits=0;
 for(let now=16;now<=1000;now+=16){const next={scale:2**(now/500),x:now,y:now};if(shouldCommitCamera(previous,next,now-last)){commits++;last=now;previous=next;}}
 assert.ok(commits<=7);assert.ok(commits>=5);
});
