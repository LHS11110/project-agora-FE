import {test} from 'node:test';import assert from 'node:assert/strict';
import CameraIdleTask from '../src/canvas/CameraIdleTask.js';
test('many input samples extend one idle deadline without allocating per-event timers',()=>{
 let now=0,next=0,allocations=0,callbacks=0;const pending=new Map();
 const task=new CameraIdleTask(()=>callbacks++,160,{now:()=>now,schedule:(callback,delay)=>{allocations++;pending.set(++next,{callback,at:now+delay});return next;},cancel:id=>pending.delete(id)});
 for(now=0;now<1000;now++){task.touch();for(const [id,t] of pending)if(t.at<=now){pending.delete(id);t.callback();}}
 assert.equal(callbacks,0);assert.ok(allocations<10);assert.equal(pending.size,1);
 now=1160;for(const [id,t] of pending){pending.delete(id);t.callback();}assert.equal(callbacks,1);assert.equal(pending.size,0);
 task.touch();task.cancel();assert.equal(pending.size,0);
});
