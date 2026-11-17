import {test} from 'node:test';import assert from 'node:assert/strict';
import Renderer from '../src/canvas/wgpu/WorkerGpuRenderer.js';
const tick=()=>new Promise(setImmediate);
test('worker frames are bounded, scene revisions survive snapshot waits, and stale bitmaps are closed',async()=>{
 const previousWorker=globalThis.Worker,previousBitmap=globalThis.createImageBitmap;
 const sent=[],snapshots=[];globalThis.Worker=class{postMessage(packet){sent.push(packet);}terminate(){this.terminated=true;}};
 globalThis.createImageBitmap=async canvas=>{snapshots.push(canvas);return {close(){this.closed=true;}};};
 const canvas={style:{}},renderer=new Renderer(canvas,100,80);let painted=0;renderer.context={transferFromImageBitmap(){painted++;}};
 const scene=n=>renderer.update_scene(new Uint32Array(12).fill(n),new Uint32Array([1]),new Uint32Array([0]),new Uint32Array([1]));
 const frame=version=>({version,camera:{x:0,y:0,scale:1},viewportWidth:100,viewportHeight:80,margin:256,bitmap:{width:612,height:592,closed:false,close(){this.closed=true;}}});
 try{
  renderer.upload_canvas_texture(1,'old',10,10);renderer.upload_canvas_texture(1,'latest',10,10);
  scene(1);renderer.render_frame(0,0,1,100,80);
  scene(2);renderer.render_frame(5,0,1,100,80);await tick();
  assert.deepEqual(snapshots,['latest']);assert.equal(sent.length,1);
  for(let i=0;i<100;i++)renderer.render_frame(i,0,1,100,80);assert.equal(sent.length,1,'no unbounded frame message queue');
  const stale=frame(1);renderer.receive(stale);await tick();assert.equal(stale.bitmap.closed,true);assert.equal(painted,0);assert.equal(sent.length,2);assert.equal(sent[1].scene.words[0],2);
  renderer.receive(frame(2));await tick();assert.equal(painted,1);assert.equal(renderer.hasFrame,true);
  renderer.render_frame(10,5,2,100,80);assert.equal(canvas.style.transform,'translate3d(-502px,-507px,0) scale(2)');
 }finally{renderer.destroy();globalThis.Worker=previousWorker;globalThis.createImageBitmap=previousBitmap;}
});

test('failed texture snapshot releases other snapshots and terminates the worker',async()=>{
 const previousWorker=globalThis.Worker,previousBitmap=globalThis.createImageBitmap;let closed=0,failed='';
 globalThis.Worker=class{postMessage(){throw Error('must not submit incomplete textures');}terminate(){this.terminated=true;}};
 globalThis.createImageBitmap=async canvas=>{if(canvas==='bad')throw Error('snapshot failed');return {close(){closed++;}};};
 const app=new Renderer({style:{}},100,80);app.onError=error=>failed=error;
 try{app.upload_canvas_texture(1,'ok',10,10);app.upload_canvas_texture(2,'bad',10,10);app.render_frame(0,0,1,100,80);await tick();assert.equal(app.disposed,true);assert.equal(closed,1);assert.match(failed,/snapshot failed/);}
 finally{app.destroy();globalThis.Worker=previousWorker;globalThis.createImageBitmap=previousBitmap;}
});
