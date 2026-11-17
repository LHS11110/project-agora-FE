import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WgpuSceneBatcher} from '../src/canvas/wgpu/WgpuSceneBatcher.js';
const record=(texId,extra={})=>({resource:{textureHandle:{texId,uvMinX:.1,uvMinY:.2,uvMaxX:.8,uvMaxY:.9}},descriptor:{x:10,y:20,centerX:5,centerY:6,rotation:90},raster:{left:-2,top:-3,width:100,height:50},tint:0x123456,...extra});
test('preserves painter order across textures and skips hidden or incomplete records',()=>{
 const batcher=new WgpuSceneBatcher();let result;
 const renderer={update_scene(...args){result=args.map(x=>x.slice());}};
 assert.equal(batcher.sync(renderer,[record(7),null,record(7),record(9),record(7),record(8,{hidden:true}),{}]),4);
 assert.deepEqual([...result[1]],[7,9,7]);assert.deepEqual([...result[2]],[0,2,3]);assert.deepEqual([...result[3]],[2,1,1]);
 const floats=new Float32Array(result[0].buffer);assert.deepEqual([...floats.slice(0,6)],[15,26,-7,-9,100,50]);assert.ok(Math.abs(floats[10]-Math.PI/2)<1e-6);assert.equal(result[0][11],0x123456);
});
test('grows instance storage, reuses it, clears stale draws after deletion',()=>{
 const batcher=new WgpuSceneBatcher();let last;
 const renderer={update_scene(...args){last=args;}};
 assert.equal(batcher.sync(renderer,Array.from({length:1000},()=>record(1))),1000);const buffer=batcher.buffer;
 batcher.sync(renderer,[record(1,{tint:null})]);assert.equal(batcher.buffer,buffer);assert.equal(last[0].length,12);assert.equal(last[0][11],0xffffff);
 batcher.sync(renderer,[]);assert.equal(last[0].length,0);assert.equal(last[1].length,0);
});
