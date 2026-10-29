// Read-only layout and live-presence UI checks. Never edits canvas objects.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/tmp/agora-studio-browser/node_modules/playwright-core/index.mjs');
const session=JSON.parse(await fs.readFile(process.env.AGORA_SESSION_FILE||'/tmp/agora-refine-session.json','utf8'));
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--host-resolver-rules=MAP 118.34.144.201 127.0.0.1','--disable-features=LocalNetworkAccessChecks','--enable-gpu','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']});
const results=[];
try{
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000},locale:'ko-KR',hasTouch:true});
 await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token:session.token,user:session.user});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`https://118.34.144.201/canvases/${session.canvas_id}`);
 await page.waitForFunction(()=>window.frelogCanvas&&document.querySelector('.connection-pill.connected')&&!document.querySelector('.canvas-loading-status.is-overlay'),null,{timeout:60000});
 const before=await page.evaluate(()=>JSON.stringify(window.frelogCanvas.read()));
 async function measure(label){
  await page.waitForTimeout(120);
  const result=await page.evaluate(()=>{
   const selectors=['.canvas-title-group','.canvas-header-right','.canvas-folded-language','.canvas-panel-slot-tools','.canvas-panel-slot-inspector','.canvas-panel-slot-chat','.canvas-quick-dock','.board-topline','.canvas-minimap','.host-canvas-status'];
   const boxes=selectors.flatMap(selector=>[...document.querySelectorAll(selector)].map(el=>({selector,el,r:el.getBoundingClientRect()}))).filter(b=>b.r.width>0&&b.r.height>0);
   const collisions=[];for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j];const w=Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left),h=Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top);
    if(w>1&&h>1)collisions.push([a.selector,b.selector,Math.round(w),Math.round(h)]);
   }
   const nav=document.querySelector('.app-navigation-toggle').getBoundingClientRect(),tools=document.querySelector('.canvas-panel-slot-tools').getBoundingClientRect();
   if(Math.min(nav.right,tools.right)>Math.max(nav.left,tools.left)&&Math.min(nav.bottom,tools.bottom)>Math.max(nav.top,tools.top))collisions.push(['navigation','tools']);
   return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,collisions};
  });results.push({label,...result});
 }
 assert.equal(await page.locator('.inspector-members,.inspector-stats,.sidepanel-bottom,.board-footer,.tool-settings-summary').count(),0);
 assert.equal(await page.locator('.host-canvas-status').count(),0);
 await measure('default');await page.screenshot({path:'/tmp/agora-refine-desktop.png'});
 const presence=page.locator('.presence-stack-trigger');await presence.hover();await page.waitForTimeout(450);
 assert.equal(await presence.getAttribute('aria-expanded'),'true');await page.locator('.presence-person-card').first().waitFor();
 await page.screenshot({path:'/tmp/agora-refine-presence.png'});await presence.press('Escape');assert.equal(await presence.getAttribute('aria-expanded'),'false');await page.mouse.move(600,400);
 await page.locator('.canvas-quick-dock button').first().focus();await presence.focus();assert.equal(await presence.getAttribute('aria-expanded'),'true');await presence.press('Escape');
 for(const panel of ['tools','chat'])await page.locator(`.canvas-panel-slot-${panel}>.canvas-panel-toggle`).click();
 await measure('all-panels-expanded');
 await page.locator('.app-navigation-toggle').click();await measure('navigation-expanded');
 await page.locator('.app-navigation-toggle').click();
 await page.locator('.canvas-topbar>.canvas-chrome-toggle').click();await measure('info-collapsed');
 await page.getByRole('combobox',{name:'언어 / Language'}).filter({visible:true}).first().waitFor();
 await page.locator('.canvas-topbar>.canvas-chrome-toggle').click();
 await page.setViewportSize({width:1024,height:768});await measure('tablet-all-panels');
 await page.setViewportSize({width:390,height:844});await measure('mobile-default');
 for(const panel of ['tools','chat','inspector']){await page.locator(`.canvas-panel-slot-${panel}>.canvas-panel-toggle`).click();await measure('mobile-'+panel);}
 await page.locator('.presence-stack-trigger').tap();assert.equal(await page.locator('.presence-stack-trigger').getAttribute('aria-expanded'),'true');await page.locator('.presence-stack-trigger').press('Escape');
 await page.screenshot({path:'/tmp/agora-refine-mobile.png'});
 assert.equal(await page.evaluate(()=>JSON.stringify(window.frelogCanvas.read())),before);
 console.log(JSON.stringify({results,pageErrors:errors,objectsUnchanged:true,presenceHover:true,presenceKeyboard:true,presenceTouch:true,escapeCloses:true,duplicatePanelsRemoved:true},null,2));
 assert.deepEqual(errors,[]);assert.ok(results.every(r=>r.collisions.length===0&&r.width===r.scrollWidth),'Persistent widgets overlap');
 await context.close();
}finally{await browser.close();}
