// Read-only UI regression: never inserts, edits or deletes canvas objects.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/tmp/agora-studio-browser/node_modules/playwright-core/index.mjs');
const session=JSON.parse(await fs.readFile(process.env.AGORA_SESSION_FILE||'/tmp/agora-studio-session.json','utf8'));
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--host-resolver-rules=MAP 112.168.71.147 127.0.0.1','--disable-features=LocalNetworkAccessChecks','--enable-gpu','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']});
const results=[];
try{
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000},locale:'ko-KR'});
 await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token:session.token,user:session.user});
 const page=await context.newPage(),errors=[];page.on('pageerror',err=>errors.push(err.message));
 const ready=()=>page.waitForFunction(()=>window.frelogCanvas&&document.querySelector('.connection-pill.connected')&&!document.querySelector('.canvas-loading-status.is-overlay'),{timeout:60000});
 await page.goto(`https://112.168.71.147/canvases/${session.canvas_id}`);await ready();
 const before=await page.evaluate(()=>JSON.stringify(window.frelogCanvas.read()));
 const dock=page.locator('.canvas-quick-dock');await dock.waitFor();await page.screenshot({path:'/tmp/agora-studio-initial.png'});
 await dock.getByRole('button',{name:'도형',exact:true}).click();
 await page.getByRole('searchbox',{name:'도형 검색'}).waitFor();
 assert.equal(await dock.getByRole('button',{name:'도형',exact:true}).getAttribute('aria-pressed'),'true');
 await dock.getByRole('button',{name:'툴 패널',exact:true}).click();
 assert.equal(await page.locator('.canvas-panel-slot-tools').evaluate(e=>e.classList.contains('is-collapsed')),false);
 await dock.getByRole('button',{name:'툴 패널',exact:true}).click();
 await page.locator('.canvas-panel-slot-chat>.canvas-panel-toggle').click();
 await page.locator('.canvas-panel-slot-chat>.canvas-panel-toggle').click();
 // Inspector resizing remains interactive in the floating layout.
 const handle=page.locator('.canvas-panel-resize-inspector'),bounds=await handle.boundingBox();
 const initial=await page.locator('.canvas-panel-slot-inspector').evaluate(e=>e.getBoundingClientRect().width);
 await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x-35,bounds.y+bounds.height/2,{steps:5});await page.mouse.up();
 assert.ok(await page.locator('.canvas-panel-slot-inspector').evaluate(e=>e.getBoundingClientRect().width)>initial);
 async function layout(label){
  const result=await page.evaluate(()=>{
   const dock=document.querySelector('.canvas-quick-dock'),r=dock.getBoundingClientRect();
   const blocked=[...dock.querySelectorAll('button')].filter(b=>{const r=b.getBoundingClientRect();return !b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}).length;
   return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,dockVisible:r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,blockedButtons:blocked};
  });assert.equal(result.scrollWidth,result.viewport);assert.equal(result.dockVisible,true);assert.equal(result.blockedButtons,0);results.push({label,...result});
 }
 await layout('desktop-light');await page.screenshot({path:'/tmp/agora-studio-desktop.png'});
 await page.evaluate(()=>localStorage.setItem('agora_canvas_theme','dark'));await page.reload();await ready();await layout('desktop-dark');await page.screenshot({path:'/tmp/agora-studio-dark.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await layout('mobile-dark');
 const title=await page.locator('.canvas-title-group').boundingBox(),actions=await page.locator('.canvas-header-right').boundingBox();
 assert.ok(title.x+title.width<=actions.x,'Mobile title and actions must not overlap');
 await page.screenshot({path:'/tmp/agora-studio-mobile.png'});
 await page.locator('.canvas-panel-slot-inspector>.canvas-panel-toggle').click();
 assert.equal(await page.locator('.canvas-panel-slot-inspector').evaluate(e=>e.classList.contains('is-collapsed')),true);
 assert.equal(await page.evaluate(()=>JSON.stringify(window.frelogCanvas.read())),before);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({results,objectsUnchanged:true,toolSelection:true,panelToggles:true,inspectorResize:true,pageErrors:0}));
 await context.close();
}finally{await browser.close();}
