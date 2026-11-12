import test from 'node:test';import assert from 'node:assert/strict';
import {installCanvasTransport,canvasApiRequest,canvasFetch} from '../src/api/canvasTransport.js';
globalThis.window={location:{href:'https://canvas.example.test/canvas/1'}};
test('canvas services use WS while external requests and disconnected pages keep their original transport',async()=>{
 const calls=[];const uninstall=installCanvasTransport({canvasId:'1',token:'user-token',origin:'https://canvas.example.test',request:async request=>{calls.push(request);return {ok:true};}});
 assert.deepEqual(await canvasApiRequest('/api/canvases/1/bots',{method:'GET',token:'user-token'}),{ok:true});assert.equal(calls[0].path,'/bots');
 assert.equal(canvasApiRequest('https://api.github.com/repos/a/b',{}),null);assert.equal(canvasApiRequest('/api/auth/me',{}),null);assert.equal(canvasApiRequest('/api/canvases/2/access',{}),null);
 await assert.rejects(canvasApiRequest('/api/canvases/1/bots',{token:'another-user'}),/인증/);
 uninstall();assert.equal(canvasApiRequest('/api/canvases/1/bots',{}),null);
});
test('binary uploads are chunked, finish only after all chunks, and remain bound to the original canvas',async()=>{
 const calls=[];let stop;const uninstall=installCanvasTransport({canvasId:'1',token:'user-token',origin:'https://canvas.example.test',request:async r=>{calls.push(r);if(r.operation==='upload_begin')return {uploadId:'upload',chunkSize:3};return {url:'/api/canvases/1/media/id.mp4'};}});
 const body=new FormData();body.append('file',new Blob([new Uint8Array([1,2,3,4,5,6,7])]),'movie.mp4');await canvasApiRequest('/api/canvases/1/media',{method:'POST',body});
 assert.deepEqual(calls.map(c=>c.operation),['upload_begin','upload_chunk','upload_chunk','upload_chunk','upload_finish']);assert.deepEqual(calls.filter(c=>c.operation==='upload_chunk').map(c=>c.offset),[0,3,6]);uninstall();
});
test('downloads assemble binary chunks and include version checks without using HTTP',async()=>{
 const calls=[];const uninstall=installCanvasTransport({canvasId:'1',token:'user-token',origin:'https://canvas.example.test',request:async r=>{calls.push(r);return r.offset===0?{offset:0,size:4,type:'application/pdf',version:'v1',data:'AQI='}:{offset:2,size:4,type:'application/pdf',version:'v1',data:'AwQ='};}});
 const response=await canvasFetch('https://canvas.example.test/api/canvases/1/pdfs/id');assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3,4]);assert.equal(calls[1].version,'v1');uninstall();
});
