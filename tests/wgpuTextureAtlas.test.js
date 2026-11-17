import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RasterTextureAtlas} from '../src/canvas/textureAtlas.js';
const bitmap=(width=12,height=10)=>({width,height});
test('uploads only changed atlas pages and reuploads on renderer replacement',()=>{
 const old=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({clearRect(){},drawImage(){}})})};
 try {
  const atlas=new RasterTextureAtlas(64,1),uploads=[],removed=[];
  const renderer={upload_canvas_texture(...args){uploads.push(args);return true;},remove_texture(id){removed.push(id);}};
  const a=atlas.allocate(bitmap());const b=atlas.allocate(bitmap());assert.equal(a.texId,b.texId);
  atlas.flush(renderer);atlas.flush(renderer);assert.equal(uploads.length,1);
  assert.equal(a.uvMinX,2/64);assert.equal(a.uvMaxX,14/64);
  atlas.release(a);const c=atlas.allocate(bitmap());assert.deepEqual(c.slot,a.slot);
  atlas.flush(renderer);assert.equal(uploads.length,2);
  atlas.resetGpuState();atlas.flush(renderer);assert.equal(uploads.length,3);
  atlas.destroy(renderer);assert.deepEqual(removed,[a.texId]);
 } finally {globalThis.document=old;}
});
test('standalone textures retry failed uploads and are removed on release',()=>{
 const atlas=new RasterTextureAtlas(4,0),a=atlas.allocate(bitmap()),removed=[];let uploads=0;
 const renderer={upload_canvas_texture(){return ++uploads>1;},remove_texture(id){removed.push(id);}};
 atlas.flush(renderer);atlas.flush(renderer);atlas.flush(renderer);assert.equal(uploads,2);
 atlas.release(a);atlas.flush(renderer);assert.deepEqual(removed,[a.texId]);assert.equal(a.canvas.width,1);
 atlas.destroy(renderer);assert.equal(removed.length,1);
});
