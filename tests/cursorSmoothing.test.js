import test from 'node:test';
import assert from 'node:assert/strict';
import { cursorDeadline, cursorIsDue } from '../src/canvas/cursorSchedule.js';
import { stagePointerHandlers } from '../src/canvas/stagePointerHandlers.js';

test('cursor deadlines keep 30 Hz on 60 Hz and 120 Hz displays without bursts after idle', () => {
  for (const hz of [60,120]) {
    let due=0;const sent=[];
    for(let frame=0;frame<=hz*2;frame++){
      const now=frame*1000/hz;
      if(cursorIsDue(due,now)){sent.push(now);due=cursorDeadline(due,now);}
    }
    assert.ok(sent.length>=59&&sent.length<=61, `${hz} Hz display sent ${sent.length}`);
    assert.ok(sent.slice(1).every((time,index)=>time-sent[index]>=1000/30-.51));
    assert.ok(cursorDeadline(due,10000)>10000);
  }
});

test('cursor movement is captured while dragging, panning and drawing, once per event', () => {
  const seen=[];const dragRef={current:{}};const panRef={current:null};
  const handlers=stagePointerHandlers({dragRef,panRef,spacePressedRef:{current:false},
    sendCursorPosition:()=>seen.push('cursor'),moveObject:()=>seen.push('object'),moveDrawing:()=>seen.push('drawing')});
  const event={target:{closest:()=>null},stopPropagation(){seen.push('stop')}};
  handlers.onPointerMoveCapture(event);handlers.onPointerMove(event);
  assert.deepEqual(seen,['cursor','object']);seen.length=0;
  dragRef.current=null;panRef.current={};handlers.onPointerMoveCapture(event);
  assert.deepEqual(seen,['cursor','stop','drawing']);seen.length=0;
  panRef.current=null;handlers.onPointerMoveCapture(event);handlers.onPointerMove(event);
  assert.deepEqual(seen,['cursor','drawing']);
});
