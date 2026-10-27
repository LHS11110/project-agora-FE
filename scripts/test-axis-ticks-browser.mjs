// Read-only coordinate overlay verification on an existing canvas.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/tmp/agora-studio-browser/node_modules/playwright-core/index.mjs');
const session=JSON.parse(await fs.readFile(process.env.AGORA_SESSION_FILE||'/tmp/agora-axis-session.json','utf8'));
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--host-resolver-rules=MAP 112.168.71.147 127.0.0.1','--disable-features=LocalNetworkAccessChecks','--enable-gpu','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']});
try{
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000},locale:'ko-KR'});
 await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token:session.token,user:session.user});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`https://112.168.71.147/canvases/${session.canvas_id}`);
 await page.waitForFunction(()=>window.frelogCanvas&&document.querySelector('.connection-pill.connected')&&!document.querySelector('.canvas-loading-status.is-overlay'),null,{timeout:60000});
 await page.locator('.canvas-axis-ticks').waitFor();await page.waitForTimeout(200);
 const before=await page.evaluate(()=>JSON.stringify(window.frelogCanvas.read()));
 async function measure(){return page.evaluate(()=>{
  const svg=document.querySelector('.canvas-axis-ticks'),plane=svg.parentElement;
  const scale=parseFloat(document.querySelector('.zoom-value').textContent)/100;
  const originX=parseFloat(plane.style.getPropertyValue('--axis-origin-x')),originY=parseFloat(plane.style.getPropertyValue('--axis-origin-y'));
  let maxError=0;const counts={};
  for(const axis of ['x','y']){
   const rows=[...svg.querySelector(`[data-axis=${axis}]`).children].filter(n=>n.style.display!=='none');counts[axis]=rows.length;
   for(const row of rows){const value=Number(row.dataset.value),m=row.transform.baseVal.consolidate().matrix;maxError=Math.max(maxError,Math.abs(axis==='x'?m.e-(originX+value*scale):m.f-(originY-value*scale)));}
  }
  return {step:Number(svg.dataset.step),scale,originX,originY,counts,maxError,nodes:svg.querySelectorAll('g[data-value]').length};
 });}
 const initial=await measure();assert.ok(initial.counts.x>0&&initial.counts.y>0,JSON.stringify(initial));assert.ok(initial.maxError<1);
 for(let i=0;i<4;i++)await page.getByRole('button',{name:'확대',exact:true}).click();await page.waitForTimeout(200);
 const zoomed=await measure();assert.ok(zoomed.step<initial.step);assert.ok(zoomed.maxError<1);
 for(let i=0;i<8;i++)await page.getByRole('button',{name:'축소',exact:true}).click();await page.waitForTimeout(200);
 const reduced=await measure();assert.ok(reduced.step>zoomed.step);assert.ok(reduced.maxError<1);
 await page.locator('.canvas-quick-dock').getByRole('button',{name:'캔버스 화면 이동 · 마우스로 집어서 드래그',exact:true}).click();
 await page.mouse.move(700,440);await page.mouse.down();await page.mouse.move(620,390,{steps:8});await page.mouse.up();await page.waitForTimeout(350);
 const panned=await measure();assert.notEqual(panned.originX,reduced.originX);assert.ok(panned.maxError<1);
 await page.locator('.canvas-quick-dock').getByRole('button',{name:'선택 및 이동',exact:true}).click();
 await page.getByRole('switch',{name:'X축 표시',exact:true}).click();await page.waitForTimeout(100);
 assert.equal((await measure()).counts.x,0);assert.ok((await measure()).counts.y>0);
 await page.getByRole('switch',{name:'Y축 표시',exact:true}).click();assert.equal(await page.locator('.canvas-axis-ticks').count(),0);
 await page.getByRole('switch',{name:'X축 표시',exact:true}).click();await page.getByRole('switch',{name:'Y축 표시',exact:true}).click();
 await page.screenshot({path:'/tmp/agora-axis-ticks.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);const mobile=await measure();assert.ok(mobile.maxError<1);assert.ok(mobile.nodes<=512);
 assert.equal(await page.evaluate(()=>JSON.stringify(window.frelogCanvas.read())),before);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({initial,zoomed,reduced,panned,mobile,axisToggles:true,objectsUnchanged:true,pageErrors:0},null,2));
 await context.close();
}finally{await browser.close();}
