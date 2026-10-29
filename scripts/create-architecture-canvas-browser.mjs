import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const statePath=process.env.ARCHITECTURE_SESSION_FILE || '/tmp/agora-architecture-session.json';
const { token,user,canvas_id }=JSON.parse(fs.readFileSync(statePath,'utf8'));
const manifest=JSON.parse(fs.readFileSync(new URL('../docs/architecture/current-project.canvas.json',import.meta.url),'utf8'));
const expected=Object.keys(manifest.items).length;
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-gpu','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist','--disable-features=LocalNetworkAccessChecks','--host-resolver-rules=MAP 118.34.144.201 127.0.0.1']});
try {
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1920,height:1200}});
 await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));}, {token,user});
 const page=await context.newPage(),errors=[],frames=[],saved=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('websocket',socket=>socket.on('framereceived',({payload})=>{try{const frame=JSON.parse(payload.toString()); if(['canvas_result','error'].includes(frame.type))console.log('Server result:',JSON.stringify({type:frame.type,ok:frame.ok,code:frame.code,count:frame.applied,results:frame.results?.map(r=>({ok:r.ok,code:r.code}))}));if(frame.type==='canvas_result')saved.push(frame);if(['init_items','canvas_snapshot'].includes(frame.type))frames.push(frame.type);}catch{}}));
 await page.goto(`https://118.34.144.201/canvases/${canvas_id}`);
 await page.waitForTimeout(3000);
 await page.screenshot({path:'/tmp/agora-architecture-debug.png'});
 await page.waitForFunction(()=>window.frelogCanvas && document.querySelector('.connection-pill.connected'),null,{timeout:60000});
 await page.waitForFunction(()=>{try {window.frelogCanvas.plan({version:1,items:{}});return true;} catch{return false;}},null,{timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('.canvas-loading-status.is-overlay'),null,{timeout:60000});
 const initial=await page.evaluate(()=>window.frelogCanvas.read());
 const foreign=Object.keys(initial.items).filter(id=>!id.startsWith('arch-'));
 assert.deepEqual(foreign,[],'Use only the newly created architecture canvas');
 const result=await page.evaluate(manifest=>window.frelogCanvas.apply(window.frelogCanvas.plan(manifest)),manifest);
 console.log('Architecture apply:',JSON.stringify(result));
 await page.waitForFunction(count=>Object.keys(window.frelogCanvas.read().items).length===count,expected,{timeout:30000});
 await page.waitForFunction(()=>!document.querySelector('.host-sync-status')?.textContent?.includes('저장 중'),null,{timeout:30000});
 // Preview API projects metadata while cached; verify actual RedisJSON items.
 const readStored=()=>JSON.parse(execFileSync('/home/steam/Github/project-agora-DB/redis/redis-ha-cli.sh',['--raw','JSON.GET',`canvas:${canvas_id}`,'$.items'],{cwd:'/home/steam/Github/project-agora-DB',maxBuffer:8*1024*1024}).toString())[0];
 let stored;
 for(let i=0;i<60;i++){
  stored=readStored();
  if(Object.keys(stored || {}).length===expected && Object.entries(manifest.items).every(([id,item])=>['text','renderMode','fontSize','x','y','height'].every(field=>item[field]==null || (typeof item[field]==='number'?Math.abs((stored[id]?.[field] || 0)-item[field]/(['x'].includes(field)?1600:['y','height'].includes(field)?1000:1))<1e-6:stored[id]?.[field]===item[field]))))break;
  await page.waitForTimeout(500);
 }
 assert.equal(Object.keys(stored || {}).length,expected,'All objects persisted in RedisJSON');
 for(const [id,item] of Object.entries(manifest.items))for(const field of ['text','renderMode','fill','shapeType'])if(item[field]!=null)assert.equal(stored[id]?.[field],item[field],`stored ${id}.${field}`);
 assert.ok(saved.every(frame=>frame.ok!==false),'No rejected server writes');
 await page.keyboard.press('Escape');
 for(const name of ['툴 패널 접기','설정 패널 접기','채팅 패널 접기']){const toggle=page.getByRole('button',{name,exact:true});if(await toggle.count())await toggle.click();}
 await page.waitForTimeout(600);
 await page.screenshot({path:'/tmp/agora-architecture-overview.png'});
 await page.reload();
 await page.waitForFunction(count=>window.frelogCanvas && document.querySelector('.connection-pill.connected') && Object.keys(window.frelogCanvas.read().items).length===count,expected,{timeout:60000});
 const reloaded=await page.evaluate(()=>window.frelogCanvas.read());
 assert.deepEqual(Object.keys(reloaded.items).sort(),Object.keys(manifest.items).sort());
 for(const [id,item] of Object.entries(manifest.items))for(const field of ['text','fill','color','shapeType','endHead'])if(item[field]!=null)assert.equal(reloaded.items[id][field],item[field],id+'.'+field);
 await page.screenshot({path:'/tmp/agora-architecture-reloaded.png'});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({canvas_id,objects:expected,serverAcknowledgements:saved.length,reloadVerified:true,errors}));
} finally {await browser.close();}
