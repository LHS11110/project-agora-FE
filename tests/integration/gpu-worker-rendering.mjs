import assert from 'node:assert/strict';
import {createServer} from 'vite';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const server=await createServer({server:{host:'127.0.0.1',port:0,https:false,open:false}});let browser;
try{
 await server.listen();browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--enable-gpu','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']});
 for(const mode of ['worker','main']){
  const page=await browser.newPage({viewport:{width:1200,height:500}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(mode=>{const NativeWorker=Worker;window.Worker=class extends NativeWorker{
   constructor(url,options){if(mode==='main'&&String(url).includes('gpuRenderer.worker'))throw Error('Simulated unavailable GPU worker');super(url,options);}
   set onmessage(handler){super.onmessage=event=>{if(mode==='worker'&&event.data.type==='frame')setTimeout(()=>handler(event),60);else handler(event);};}
  };},mode);
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/browser/depth-layers.html`);
  await page.waitForFunction(mode=>{const s=document.querySelector('.vector-layer')?.__agoraRenderStats;return s?.visibleObjects===36&&s.renderThread===mode&&(mode!=='worker'||s.gpuWorkerFrames>0);},mode);
  const pixels=async points=>{const bytes=[...await page.screenshot()];return page.evaluate(async({bytes,points})=>{const bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();return points.map(([x,y])=>[...ctx.getImageData(x,y,1,1).data]);},{bytes,points});};
  await page.evaluate(()=>depthFixture.move({x:20,y:15,scale:1}));
  let [red,white]=await pixels([[80,80],[45,45]]);assert.ok(red[0]>200&&red[1]<60,JSON.stringify(red));assert.ok(white[0]>240&&white[1]>240,JSON.stringify(white));
  await page.evaluate(()=>depthFixture.move({x:7,y:-5,scale:1.25}));
  [red,white]=await pixels([[70,65],[45,45]]);assert.ok(red[0]>200&&red[1]<60,JSON.stringify(red));assert.ok(white[0]>240&&white[1]>240,JSON.stringify(white));
  await page.evaluate(()=>{depthFixture.move({x:0,y:0,scale:1});depthFixture.patch({item0:{fillOpacity:.5,strokeEnabled:false}});});await page.waitForTimeout(300);
  [red]=await pixels([[80,80]]);assert.ok(red[0]>240&&red[1]>80&&red[1]<180,JSON.stringify(red));
  assert.deepEqual(errors,[]);console.log('PASS',mode,'pan/zoom pixel alignment, translucent textures and delayed frame handling');await page.close();
 }
}finally{await browser?.close();await server.close();}
