// Read-only production smoke test. Supply a private session JSON for canvas checks.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/agora-erd-browser/node_modules/playwright-core/index.mjs');
const base=process.env.AGORA_BASE_URL||'https://112.168.71.147';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--host-resolver-rules=MAP 112.168.71.147 127.0.0.1','--disable-features=LocalNetworkAccessChecks','--enable-gpu','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']});
try {
 const context=await browser.newContext({ignoreHTTPSErrors:true,locale:'ko-KR',viewport:{width:1920,height:1200}});
 const page=await context.newPage(), errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto(base);await page.waitForTimeout(5000);
 const language=page.getByRole('combobox',{name:'언어 / Language'}).first();
 await language.selectOption('en');await page.getByRole('link',{name:'Log in',exact:true}).waitFor();
 assert.equal(await page.locator('html').getAttribute('lang'),'en');
 await page.reload();await page.waitForTimeout(1200);assert.equal(await language.inputValue(),'en');
 await page.goto(base+'/login');await page.getByRole('heading',{name:'Welcome back.'}).waitFor();
 await page.getByRole('textbox',{name:'Email',exact:true}).fill('unsubmitted@example.com');
 await language.selectOption('ko');await page.getByRole('heading',{name:'다시 만났네요.'}).waitFor();
 assert.equal(await page.getByRole('textbox',{name:'이메일',exact:true}).inputValue(),'unsubmitted@example.com');
 // Switching language in one tab updates other tabs without losing form input.
 const second=await context.newPage();await second.goto(base+'/login');
 await second.getByRole('combobox',{name:'언어 / Language'}).selectOption('en');
 await page.getByRole('heading',{name:'Welcome back.'}).waitFor();
 assert.equal(await page.getByRole('textbox',{name:'Email',exact:true}).inputValue(),'unsubmitted@example.com');
 await second.close();
 let canvasResult=null;
 if(process.env.AGORA_SESSION_FILE){
   const session=JSON.parse(await fs.readFile(process.env.AGORA_SESSION_FILE,'utf8'));
   await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token:session.token,user:session.user});
   let sockets=0;page.on('websocket',()=>sockets++);
   await page.goto(`${base}/canvases/${session.canvas_id}`);
   await page.waitForFunction(()=>window.frelogCanvas&&document.querySelector('.connection-pill.connected')&&!document.querySelector('.canvas-loading-status.is-overlay'),{timeout:60000});
   const before=await page.evaluate(()=>JSON.stringify(window.frelogCanvas.read()));
   const socketCount=sockets;
   await page.getByRole('combobox',{name:'언어 / Language'}).filter({visible:true}).first().selectOption('ko');
   await page.getByRole('button',{name:'모두 열기',exact:true}).click();
   await page.getByRole('button',{name:'도형',exact:true}).click();
   await page.getByRole('combobox',{name:'언어 / Language'}).filter({visible:true}).first().selectOption('en');
   await page.getByRole('searchbox',{name:'Search shapes'}).fill('capacitor');
   await page.getByRole('button',{name:'Capacitor',exact:true}).waitFor();
   await page.getByRole('searchbox',{name:'Search shapes'}).fill('커패시터');
   await page.getByRole('button',{name:'Capacitor',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>JSON.stringify(window.frelogCanvas.read())),before,'Locale must not edit canvas data');
   assert.equal(sockets,socketCount,'Locale must not reconnect canvas sockets');
   await page.reload();await page.waitForFunction(()=>window.frelogCanvas&&document.querySelector('.connection-pill.connected')&&!document.querySelector('.canvas-loading-status.is-overlay'),{timeout:60000});
   assert.equal(await page.locator('html').getAttribute('lang'),'en');
   assert.equal(await page.evaluate(()=>JSON.stringify(window.frelogCanvas.read())),before,'Reload must preserve canvas data');
   canvasResult={canvasId:session.canvas_id,unchanged:true,noReconnect:true,bilingualShapeSearch:true};
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({home:true,login:true,preferencePersistence:true,crossTab:true,formPreserved:true,canvas:canvasResult,pageErrors:0}));
 await context.close();
} finally {await browser.close();}
