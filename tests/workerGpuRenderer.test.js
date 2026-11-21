import {test} from 'node:test';import assert from 'node:assert/strict';
import Renderer from '../src/canvas/wgpu/WorkerGpuRenderer.js';
const tick=()=>new Promise(setImmediate);
// The shared GPU worker host also posts init/release messages; count frames only.
const framesOf=list=>new Proxy(list,{get:(target,key)=>key==='length'?target.filter(p=>p.type==='frame').length:typeof key==='string'&&/^\d+$/.test(key)?target.filter(p=>p.type==='frame')[key]:target[key]});
test('worker frames are bounded, scene revisions survive snapshot waits, and stale bitmaps are closed',async()=>{
 const previousWorker=globalThis.Worker,previousBitmap=globalThis.createImageBitmap;
 Renderer.resetSharedWorker();const all=[],sent=framesOf(all),snapshots=[];globalThis.Worker=class{postMessage(packet){all.push(packet);}terminate(){this.terminated=true;}};
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
 Renderer.resetSharedWorker();globalThis.Worker=class{postMessage(packet){if(packet.type==='frame')throw Error('must not submit incomplete textures');}terminate(){this.terminated=true;}};
 globalThis.createImageBitmap=async canvas=>{if(canvas==='bad')throw Error('snapshot failed');return {close(){closed++;}};};
 const app=new Renderer({style:{}},100,80);app.onError=error=>failed=error;
 try{app.upload_canvas_texture(1,'ok',10,10);app.upload_canvas_texture(2,'bad',10,10);app.render_frame(0,0,1,100,80);await tick();assert.equal(app.disposed,true);assert.equal(closed,1);assert.match(failed,/snapshot failed/);}
 finally{app.destroy();globalThis.Worker=previousWorker;globalThis.createImageBitmap=previousBitmap;}
});

test('camera-only dispatch is synchronous, bounded and has no idle render loop',async()=>{
 Renderer.resetSharedWorker();const previous=globalThis.Worker,all=[],sent=framesOf(all);globalThis.Worker=class{postMessage(packet){all.push(packet);}terminate(){}};
 const app=new Renderer({style:{}},100,80);let frames=0;app.context={transferFromImageBitmap(){}};app.onFrame=()=>frames++;
 const done=()=>({version:0,camera:{x:0,y:0,scale:1},viewportWidth:100,viewportHeight:80,margin:256,bitmap:{width:612,height:592,close(){}}});
 try{
  app.render_frame(0,0,1,100,80);assert.equal(sent.length,1,'no Promise hop for empty upload batches');assert.equal(app.telemetry.completed,0,'requests are not counted as completed frames');
  for(let i=1;i<=100;i++)app.render_frame(i,0,1,100,80);assert.equal(sent.length,1,'retain only latest unsent camera');
  app.receive(done());assert.equal(sent.length,2);assert.equal(sent[1].camera.x,100);assert.equal(frames,1);
  app.receive(done());await tick();assert.equal(sent.length,2,'idle does not manufacture extra frames');assert.equal(app.telemetry.presented,2);assert.equal(app.telemetry.completed,2);
  for(let i=0;i<300;i++){app.render_frame(i,0,1,100,80);app.receive(done());}
  assert.equal(app.telemetry.samples.length,240,'telemetry memory is bounded');assert.equal(app.telemetry.maxPending,1);
 }finally{app.destroy();globalThis.Worker=previous;}
});

test('depth layers share one GPU worker, frames route by layer and release frees only that layer',async()=>{
 Renderer.resetSharedWorker();const previous=globalThis.Worker,messages=[];let workers=0;
 globalThis.Worker=class{constructor(){workers++;}postMessage(packet){messages.push(packet);}terminate(){}};
 const a=new Renderer({style:{}},100,80),b=new Renderer({style:{}},100,80);let paintedA=0,paintedB=0;
 a.context={transferFromImageBitmap(){paintedA++;}};b.context={transferFromImageBitmap(){paintedB++;}};
 const done=layer=>({layer,version:0,camera:{x:0,y:0,scale:1},viewportWidth:100,viewportHeight:80,margin:96,bitmap:{width:10,height:10,close(){}}});
 try{
  a.render_frame(0,0,1,100,80);b.render_frame(0,0,1,100,80);
  assert.equal(workers,1,'one worker for every layer');
  const frames=messages.filter(m=>m.type==='frame');assert.deepEqual(frames.map(m=>m.layer),[a.layer,b.layer]);
  a.host.worker.onmessage({data:{type:'frame',...done(b.layer)}});assert.equal(paintedB,1);assert.equal(paintedA,0);
  a.destroy();assert.deepEqual(messages.filter(m=>m.type==='release').map(m=>m.layer),[a.layer]);
  assert.equal(b.host.dead,false,'other layers keep the worker');
 }finally{a.destroy();b.destroy();Renderer.resetSharedWorker();globalThis.Worker=previous;}
});
