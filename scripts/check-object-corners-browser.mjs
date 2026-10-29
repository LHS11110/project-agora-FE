import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createServer} from 'vite';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright-core');
const server=await createServer({server:{host:'127.0.0.1',port:0,https:false,open:false}});let browser;
try{
 await server.listen();browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1600,height:1100},locale:'ko-KR'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin=`http://127.0.0.1:${server.httpServer.address().port}`;await page.goto(origin+'/tests/browser/image-frame.html');
 const image=page.locator('.image-object img'),frame=page.locator('.image-object-surface');await image.waitFor();await image.evaluate(e=>e.decode());
 const original=await frame.boundingBox();await page.getByRole('button',{name:'둥글게',exact:true}).click();
 assert.equal(await frame.evaluate(e=>getComputedStyle(e).borderRadius),'24px');assert.equal(await image.evaluate(e=>getComputedStyle(e).borderRadius),'17px');
 await page.getByRole('switch',{name:'이미지 테두리 표시'}).click();await page.waitForTimeout(80);
 assert.deepEqual(await frame.boundingBox(),original,'Frame toggle and rounding must preserve saved dimensions');assert.equal(await image.evaluate(e=>getComputedStyle(e).borderRadius),'24px');
 assert.ok(await page.locator('.object-resize-handle').count()>0,'Resize handles must stay outside clipped contents');
 const pixelSample=async()=>{
  const screenshot=await image.screenshot();return page.evaluate(async base64=>{const bitmap=await createImageBitmap(await(await fetch('data:image/png;base64,'+base64)).blob());const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);const at=(x,y)=>[...ctx.getImageData(x,y,1,1).data].slice(0,3);return {corner:at(2,2),center:at(Math.floor(c.width/2),Math.floor(c.height/2))}},screenshot.toString('base64'));
 };
 const rounded=await pixelSample();assert.notDeepEqual(rounded.corner,rounded.center,'The actual photo corner must round even with horizontal letterboxing');
 await page.getByRole('button',{name:'각지게',exact:true}).click();assert.equal(await image.evaluate(e=>getComputedStyle(e).borderRadius),'0px');const sharp=await pixelSample();assert.deepEqual(sharp.corner,sharp.center);
 await page.evaluate(()=>window.patchImageFixture({width:.18,height:.25}));await page.getByRole('button',{name:'둥글게',exact:true}).click();await page.waitForTimeout(80);const tall=await pixelSample();assert.notDeepEqual(tall.corner,tall.center,'Vertical letterboxing must also round the actual image');
 await page.evaluate(()=>window.patchImageFixture({height:undefined}));await page.waitForTimeout(80);const natural=await image.boundingBox();assert.ok(Math.abs(natural.width/natural.height-2)<.02,'Auto height must preserve image aspect ratio');
 await page.evaluate(()=>window.patchImageFixture({src:''}));await page.locator('.image-object-fallback').waitFor();assert.equal((await frame.boundingBox()).height,130);
 await page.getByRole('switch',{name:'이미지 테두리 표시'}).click();assert.equal((await frame.boundingBox()).height,130,'Loading/error placeholder keeps its original outer size');
 // Paint the same source through the GPU overview's Canvas2D texture path.
 const gpu=await page.evaluate(async()=>{
  const {drawImagePreview}=await import('/src/canvas/ImagePreviewCache.js'),{overviewProxy}=await import('/src/canvas/sceneRepresentation.js'),{rasterDescriptor}=await import('/src/canvas/rasterObjectCache.js');
  const bitmap=document.createElement('canvas');bitmap.width=320;bitmap.height=160;const paint=bitmap.getContext('2d');paint.fillStyle='#e37e7e';paint.fillRect(0,0,320,160);
  const item={kind:'image',x:0,y:0,width:.3,height:.2,src:'fixture',imageFrameEnabled:false,cornerStyle:'rounded'},world={width:1600,height:1000};
  const c=document.createElement('canvas');c.width=480;c.height=200;const ctx=c.getContext('2d'),alpha=(x,y)=>ctx.getImageData(x,y,1,1).data[3];drawImagePreview(ctx,item,world,bitmap);const roundAlpha=alpha(40,0),center=alpha(240,100);ctx.clearRect(0,0,480,200);drawImagePreview(ctx,{...item,cornerStyle:'sharp'},world,bitmap);const sharpAlpha=alpha(40,0);
  ctx.clearRect(0,0,480,200);drawImagePreview(ctx,item,world,null);ctx.fillStyle='#000';ctx.fillRect(0,0,1,1);const restored=alpha(0,0);
  const proxy=overviewProxy(item,world,.1),other={...proxy,cornerStyle:'sharp'};return {roundAlpha,center,sharpAlpha,restored,style:proxy.cornerStyle,invalidated:rasterDescriptor('image',proxy,world,{},'image:1').key!==rasterDescriptor('image',other,world,{},'image:1').key};
 });
 assert.deepEqual(gpu,{roundAlpha:0,center:255,sharpAlpha:255,restored:255,style:'rounded',invalidated:true});
 await page.goto(origin+'/tests/browser/editing-consistency.html');await page.waitForFunction(()=>window.setEditingFixture);
 for(const kind of ['text','code','table','chart']){
  const item={kind:kind==='code'?'text':kind,renderMode:kind==='code'?'code':'plain',text:'Rounded card',filename:'round.py',language:'python',x:.1,y:.1,width:.3,height:.25,fontSize:26,cornerStyle:'rounded',columns:['X','Y'],rows:[['A','1']],chartType:'bar'};
  await page.evaluate(item=>window.setEditingFixture({item}),item);await page.waitForTimeout(80);
  const result=await page.evaluate(()=>{const root=document.querySelector('.canvas-object'),inner=root.querySelector('.scalable-object-content')||root.querySelector('.chart-card');const s=getComputedStyle(inner),viewport=inner.closest('.object-content-viewport');return {radius:parseFloat(s.borderRadius),scale:viewport?Number(getComputedStyle(viewport).getPropertyValue('--content-fit-scale')):1}});
  assert.ok(Math.abs(result.radius*result.scale-24)<.1,kind+' uses world radius at any content scale');
 }
 assert.deepEqual(errors,[]);console.log('PASS: image corners, both frame modes, horizontal/vertical letterboxing, resize handles, natural aspect ratio, GPU preview clipping/cache invalidation and scaled card corners.');
}finally{await browser?.close();await server.close()}
