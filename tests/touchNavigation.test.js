import test from 'node:test';
import assert from 'node:assert/strict';
import { createTouchNavigation, pinchCamera, touchPair } from '../src/canvas/touchNavigation.js';
import { editorCanScroll } from '../src/canvas/editorWheel.js';

const bounds={left:20,top:30,width:1000,height:800};
const event=(id,x,y,extra={})=>({pointerId:id,pointerType:'touch',clientX:x,clientY:y,target:{closest:()=>null},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra});

test('pinch retains the world point beneath the midpoint while zooming and panning',()=>{
 const camera={x:-100,y:-50,scale:1};
 const before={x:300,y:200,distance:100},after={x:350,y:230,distance:200};
 const next=pinchCamera(camera,before,after,bounds);
 assert.equal(next.scale,2);
 assert.equal((before.x-bounds.left-camera.x)/camera.scale,(after.x-bounds.left-next.x)/next.scale);
 assert.equal((before.y-bounds.top-camera.y)/camera.scale,(after.y-bounds.top-next.y)/next.scale);
 assert.equal(touchPair([{clientX:0,clientY:0},{clientX:1,clientY:1}]),null);
});

test('two fingers take over once, and the remaining finger cannot drag after pinch',()=>{
 const captured=new Set(),starts=[],changes=[];
 const stage={setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
 const nav=createTouchNavigation({getStage:()=>stage,onStart:p=>starts.push(p.pointerId),onChange:(a,b)=>changes.push([a,b])});
 assert.equal(nav.down(event(1,100,100)),false);
 assert.equal(nav.down(event(2,200,100)),true);
 assert.deepEqual(starts,[1]);
 assert.deepEqual([...captured],[1,2]);
 nav.move(event(2,300,100));
 assert.equal(changes[0][1].distance/changes[0][0].distance,2);
 assert.equal(nav.up(event(2,300,100)),true);
 assert.equal(nav.move(event(1,150,100)),true);
 assert.equal(changes.length,1);
 assert.equal(nav.active,true);
 assert.equal(nav.up(event(1,150,100)),true);
 assert.equal(nav.active,false);
 assert.equal(nav.down(event(3,200,200)),false);
 nav.clear();assert.equal(nav.active,false);
});

test('third finger does not jump and cancellation allows the next gesture',()=>{
 const changes=[];
 const nav=createTouchNavigation({getStage:()=>null,onChange:(a,b)=>changes.push([a,b])});
 nav.down(event(1,100,100));nav.down(event(2,200,100));nav.down(event(3,900,900));
 nav.move(event(3,950,950));
 assert.deepEqual(changes[0][0],changes[0][1]);
 nav.up(event(1,100,100));
 nav.move(event(2,220,100));
 assert.ok(changes[1][0].distance>500);
 nav.clear();assert.equal(nav.down(event(4,300,300)),false);
});

test('pen, mouse and editor touches keep their existing single-pointer behavior',()=>{
 const nav=createTouchNavigation({getStage:()=>null,onStart:()=>assert.fail('unexpected pinch')});
 for(const pointerType of ['pen','mouse'])assert.equal(nav.down(event(1,100,100,{pointerType})),false);
 assert.equal(nav.down(event(2,100,100,{target:{closest:()=>({})}})),false);
 assert.equal(nav.down(event(3,200,100)),false);
 assert.equal(nav.active,false);
});

test('result wheel scroll stays inside the result even at either boundary',()=>{
 const target={closest:selector=>selector==='.blueprint-object.selected .blueprint-node-body'?{}:null};
 for(const deltaY of [-120,120])assert.equal(editorCanScroll({target,deltaY,deltaX:0}),true);
 assert.equal(editorCanScroll({target,deltaY:120,ctrlKey:true}),false);
 assert.equal(editorCanScroll({target:{closest:selector=>selector==='.blueprint-node-body'?{}:null},deltaY:120}),false,'unselected result navigates canvas');
});
