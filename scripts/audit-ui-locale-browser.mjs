// Audit application UI only. Authored canvas text, names, code and chat are excluded.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/tmp/agora-erd-browser/node_modules/playwright-core/index.mjs');
const base=process.env.AGORA_BASE_URL||'http://127.0.0.1:4175';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--host-resolver-rules=MAP 112.168.71.147 127.0.0.1','--disable-features=LocalNetworkAccessChecks','--enable-gpu','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']});
try {
 const context=await browser.newContext({ignoreHTTPSErrors:true,locale:'en-US',viewport:{width:1920,height:1200}});
 const page=await context.newPage(), errors=[],results=[];page.on('pageerror',error=>errors.push(error.message));
 await context.addInitScript(()=>localStorage.setItem('frelog_locale','en'));
 async function audit(route,roots=['body'],exclusions=[]){
  const untranslated=await page.evaluate(({roots,exclusions})=>{
   const skip='.language-switcher,script,style,[contenteditable=true],.tutorial-item,.tutorial-editor,.inline-content-input,.monaco-editor,.mathjax-output';
   const excluded=[skip,...exclusions].join(',');const values=[];
   for(const root of roots.flatMap(selector=>[...document.querySelectorAll(selector)])){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
    while(node=walker.nextNode())if(node.parentElement&&!node.parentElement.closest(excluded+',textarea')&&/[가-힣]/.test(node.textContent))values.push(node.textContent.trim());
    for(const element of [root,...root.querySelectorAll('[title],[aria-label],[placeholder],[alt],[aria-valuetext]')]){
     if(element.closest(excluded))continue;
     for(const attr of ['title','aria-label','placeholder','alt','aria-valuetext']){const v=element.getAttribute(attr);if(v&&/[가-힣]/.test(v))values.push(attr+': '+v);}
    }
   }return [...new Set(values)].filter(Boolean);
  },{roots,exclusions});results.push({route,untranslated});
 }
 for(const route of ['/','/login','/docs','/tutorial']){
  await page.goto(base+route);await page.waitForTimeout(route==='/'?6000:1600);
  await audit(route,route==='/tutorial'?['.tutorial-header','.tutorial-intro','.tutorial-tools','.tutorial-settings','.tutorial-stage-hint','.tutorial-footer']:['body'],['.shared-editor-demo code','.remote-caret','.shared-cursor']);
 }
 if(process.env.AGORA_SESSION_FILE){
  const session=JSON.parse(await fs.readFile(process.env.AGORA_SESSION_FILE,'utf8'));
  await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token:session.token,user:session.user});
  await page.goto(`${base}/canvases/${session.canvas_id}`);await page.waitForFunction(()=>window.frelogCanvas&&document.querySelector('.connection-pill.connected')&&!document.querySelector('.canvas-loading-status.is-overlay'),{timeout:60000});
  const before=await page.evaluate(()=>JSON.stringify(window.frelogCanvas.read()));let sockets=0;page.on('websocket',()=>sockets++);
  await page.getByRole('button',{name:'Expand all',exact:true}).click();
  const roots=['.canvas-tools','.canvas-inspector','.canvas-panel-toggle','.board-topline','.canvas-minimap','.side-nav'];
  for(const tool of ['Shapes','Draw','Drawing eraser','Object clipboard']){
   if(tool==='Object clipboard')continue;
   await page.getByRole('button',{name:tool,exact:true}).click();await audit('canvas / '+tool,roots);
   assert.equal(await page.locator('.research-template-controls').count(),0);
  }
  await page.getByRole('button',{name:'Shapes',exact:true}).click();
  await page.getByRole('searchbox',{name:'Search shapes'}).fill('operational amplifier');await page.getByRole('button',{name:'Operational amplifier',exact:true}).waitFor();
  await page.getByRole('combobox',{name:'언어 / Language'}).filter({visible:true}).first().selectOption('ko');
  await page.getByRole('button',{name:'연산 증폭기',exact:true}).waitFor();
  await page.getByRole('combobox',{name:'언어 / Language'}).filter({visible:true}).first().selectOption('en');
  assert.equal(await page.evaluate(()=>JSON.stringify(window.frelogCanvas.read())),before);
  assert.equal(sockets,0);results.push({route:'canvas preservation',unchanged:true,noReconnect:true,noExampleControls:true});
 }
 console.log(JSON.stringify({results,pageErrors:errors},null,2));
 assert.deepEqual(errors,[]);assert.ok(results.every(r=>!r.untranslated?.length),'Untranslated UI text remains');
 await context.close();
}finally{await browser.close();}
