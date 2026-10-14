import test from 'node:test';
import assert from 'node:assert/strict';
import WorkerFrameCompositor from '../src/canvas/WorkerFrameCompositor.js';

test('worker compositor closes stale snapshots, switches only to current content and restores fallback on failure',async()=>{
  const names=['Worker','document','HTMLCanvasElement','createImageBitmap'];
  const previous=names.map(name=>Object.getOwnPropertyDescriptor(globalThis,name));
  const bitmaps=[],instances=[];
  class Canvas {style={};transferControlToOffscreen(){return {}}remove(){this.removed=true}}
  class MockWorker {messages=[];constructor(){instances.push(this)}postMessage(data){this.messages.push(data)}terminate(){this.terminated=true}}
  Object.assign(globalThis,{Worker:MockWorker,HTMLCanvasElement:Canvas,document:{createElement:()=>new Canvas()},createImageBitmap:async()=>{const bitmap={close(){this.closed=true}};bitmaps.push(bitmap);return bitmap;}});
  const host={dataset:{},insertBefore(){}},fallback=new Canvas(),stats={};let changes=0,compositor;
  try{
    compositor=new WorkerFrameCompositor(host,fallback,()=>changes++,stats);
    const worker=instances[0];worker.onmessage({data:{type:'initialized'}});
    const frame={width:1200,height:800,ratio:1,region:{x:0,y:0,width:100,height:100},projection:{x:0,y:0,scale:1},sourceCrop:{x:5,y:10,width:100,height:100},version:1};
    assert.equal(compositor.send(frame,{}),false);
    assert.equal(compositor.send({...frame,version:2},{}),false);
    await new Promise(setImmediate);
    assert.equal(bitmaps[0].closed,true);
    assert.equal(worker.messages.filter(m=>m.type==='bitmap').length,1);
    assert.equal(worker.messages.find(m=>m.type==='bitmap').version,2);
    worker.onmessage({data:{type:'painted',version:1}});
    assert.equal(compositor.canvas.style.display,'none');
    worker.onmessage({data:{type:'painted',version:2,crop:frame.sourceCrop}});
    assert.equal(fallback.style.display,'none');
    assert.equal(compositor.send({...frame,version:2},{}),true);
    assert.equal(bitmaps.length,2);
    const count=worker.messages.length;
    compositor.send({...frame,version:2,projection:{x:20,y:30,scale:2}},{});
    assert.equal(worker.messages.length,count);
    assert.equal(compositor.canvas.style.transform,'translate3d(30px,50px,0) scale(2)');
    worker.onerror();
    assert.equal(host.dataset.compositor,'main');
    assert.equal(fallback.style.display,'');
    assert.equal(worker.terminated,true);
    assert.ok(changes>=2);
  }finally{
    compositor?.destroy();
    names.forEach((name,i)=>previous[i]?Object.defineProperty(globalThis,name,previous[i]):delete globalThis[name]);
  }
});
