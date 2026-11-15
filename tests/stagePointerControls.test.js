import test from 'node:test';import assert from 'node:assert/strict';import {stagePointerHandlers} from '../src/canvas/stagePointerHandlers.js';
test('presentation controls bypass capture, gesture, selection and double-click handling',()=>{
 let calls=0;const touched=()=>{calls++;return false;};const handlers=stagePointerHandlers({activeTool:'select',dragRef:{current:null},panRef:{current:null},spacePressedRef:{current:false},touchNavigation:{down:touched,move:touched,up:touched},pickVector:touched,startPan:touched,startDrawing:touched,moveDrawing:touched,stopDrawing:touched,cancelCameraMotion:touched,sendCursorPosition:touched});
 const event={target:{closest:selector=>selector==='[data-canvas-ui]'?{}:null}};
 for(const name of ['onPointerDownCapture','onPointerDown','onPointerMoveCapture','onPointerMove','onPointerUpCapture','onPointerUp','onPointerCancelCapture','onPointerCancel','onDoubleClick'])handlers[name](event);
 assert.equal(calls,0);
});
test('ordinary canvas still starts drawing and picking normally',()=>{let drawings=0,picks=0;const handlers=stagePointerHandlers({activeTool:'select',dragRef:{current:null},panRef:{current:null},spacePressedRef:{current:false},pickVector:()=>{picks++;return false;},startDrawing:()=>drawings++});const event={button:0,target:{closest:()=>null}};handlers.onPointerDownCapture(event);handlers.onPointerDown(event);assert.equal(drawings,1);assert.equal(picks,2);});
