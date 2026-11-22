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

test('cancelled file uploads discard the staged session without finishing', async () => {
 const requests = [];
 const controller = new AbortController();
 const uninstall = installCanvasTransport({
  canvasId: '1', token: 'user-token', origin: 'https://canvas.example.test',
  request: async request => {
   requests.push(request.operation);
   if (request.operation === 'upload_begin') return { uploadId: 'upload', chunkSize: 3 };
   return {};
  },
 });
 try {
  const body = new FormData();
  body.append('file', new Blob(['notebook']), 'notebook.ipynb');
  await assert.rejects(canvasApiRequest('/api/canvases/1/notebooks', {
   method: 'POST', body, signal: controller.signal,
   onUploadProgress: (done, total) => {
    assert.equal(done, 3);
    assert.equal(total, 8);
    controller.abort();
   },
  }), { name: 'AbortError' });
  assert.deepEqual(requests, ['upload_begin', 'upload_chunk', 'upload_cancel']);
 } finally {
  uninstall();
 }
});

test('large downloads start streaming with their original size and can be cancelled', async () => {
 const size = 101 * 1024 * 1024;
 const offsets = [];
 const uninstall = installCanvasTransport({
  canvasId: '1', token: 'user-token', origin: 'https://canvas.example.test',
  request: async request => {
   offsets.push(request.offset);
   return { offset: request.offset, size, type: 'video/mp4', version: 'v1', data: 'AQ==' };
  },
 });
 try {
  const response = await canvasFetch('/api/canvases/1/media/large.mp4');
  assert.equal(response.headers.get('Content-Length'), String(size));
  const reader = response.body.getReader();
  assert.deepEqual(await reader.read(), { done: false, value: Uint8Array.of(1) });
  await reader.cancel();
  assert.ok(offsets.length < 4);
 } finally {
  uninstall();
 }
});
