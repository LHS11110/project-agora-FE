import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {researchSymbolCatalog} from '../src/canvas/researchSymbols.js';
import {researchTemplates,researchTemplateManifest} from '../src/canvas/researchTemplates.js';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const auth=JSON.parse(fs.readFileSync(process.env.RESEARCH_TEST_SESSION_FILE));
assert.equal(auth.canvas.canvas_name,'개발·연구 도형 검증 (임시)');
const errors=[],rejections=[],counts=[];
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--host-resolver-rules=MAP 112.168.71.147 127.0.0.1','--disable-features=LocalNetworkAccessChecks','--enable-gpu','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']});
try{
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1920,height:1200}});
 await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},auth);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('websocket',ws=>ws.on('framereceived',({payload})=>{try{const m=JSON.parse(payload);if(m.type==='error'||m.type==='canvas_result'&&m.ok===false)rejections.push(m.code);}catch{}}));
 const ready=()=>page.waitForFunction(()=>window.frelogCanvas&&document.querySelector('.connection-pill.connected')&&!document.querySelector('.canvas-loading-status.is-overlay'),null,{timeout:60000});
 const read=()=>page.evaluate(()=>window.frelogCanvas.read().items);
 const openShapes=async()=>{if(!await page.getByLabel('도형 분야',{exact:true}).count())await page.getByRole('button',{name:'도형',exact:true}).click();};
 await page.goto(`https://112.168.71.147/canvases/${auth.canvas.canvas_id}`);await ready();assert.equal(Object.keys(await read()).length,0);
 await page.getByRole('button',{name:'모두 열기',exact:true}).click();
 await openShapes();
 await page.getByLabel('도형 분야',{exact:true}).selectOption('science');assert.equal(await page.locator('.shape-picker button').count(),6);
 await page.getByLabel('도형 검색',{exact:true}).fill('플라스크');assert.equal(await page.locator('.shape-picker button').count(),1);
 await page.getByRole('button',{name:'삼각 플라스크',exact:true}).click();
 const stage=await page.locator('.canvas-stage').boundingBox();await page.mouse.click(stage.x+stage.width*.45,stage.y+stage.height*.45);
 await page.waitForFunction(()=>Object.values(window.frelogCanvas.read().items).some(i=>i.shapeType==='lab-flask'));
 const gallery={};for(const [pass,visualStyle] of ['standard','sketch'].entries())for(const [i,s] of researchSymbolCatalog.entries())gallery[`research-check-${pass}-${s.id}`]={kind:'shape',shapeType:s.id,x:2200+(i%8)*250,y:100+Math.floor(i/8)*220+pass*1300,width:160,height:160/s.aspect,color:'#345b7a',fill:'#edf3f8',strokeWidth:2,visualStyle,shadowEnabled:false};
 await page.evaluate(items=>window.frelogCanvas.apply(window.frelogCanvas.plan({version:1,mode:'merge',items})),gallery);
 await page.waitForFunction(()=>Object.keys(window.frelogCanvas.read().items).length===81);
 for(const preset of researchTemplates){
  const before=Object.keys(await read()).length,expected=Object.keys(researchTemplateManifest(preset.id,{prefix:'count'}).items).length;
  await openShapes();
  await page.getByLabel('연구 다이어그램 예시',{exact:true}).selectOption(preset.id);
  await page.getByRole('button',{name:'예시 구조 삽입',exact:true}).click();
  await page.waitForFunction(n=>Object.keys(window.frelogCanvas.read().items).length===n,before+expected,{timeout:15000});
  counts.push({template:preset.id,created:expected});
 }
 await page.waitForFunction(()=>document.querySelector('.host-canvas-status')?.textContent.includes('서버 동기화됨'),null,{timeout:30000});
 const beforeReload=await read();await page.screenshot({path:'/tmp/agora-research-templates.png'});
 await openShapes();await page.getByLabel('도형 분야',{exact:true}).selectOption('engineering');
 await page.getByLabel('도형 검색',{exact:true}).fill('');assert.equal(await page.locator('.shape-picker button').count(),8);
 await page.screenshot({path:'/tmp/agora-research-picker.png'});
 await page.reload();await ready();await page.waitForFunction(n=>Object.keys(window.frelogCanvas.read().items).length===n,Object.keys(beforeReload).length);
 const afterReload=await read();assert.deepEqual(Object.keys(afterReload).sort(),Object.keys(beforeReload).sort());
 for(const [id,item] of Object.entries(beforeReload))for(const key of ['kind','shapeType','text','from','to','visualStyle','groupId'])if(item[key]!=null)assert.equal(afterReload[id][key],item[key],id+'.'+key);
 assert.deepEqual(errors,[]);assert.deepEqual(rejections,[]);
 const report={canvas_id:auth.canvas.canvas_id,symbols:40,styles:2,templateInsertions:counts,objects:Object.keys(afterReload).length,searchAndCategoryVerified:true,mouseCreationVerified:true,reloadVerified:true,errors,rejections};
 fs.writeFileSync('/tmp/agora-research-browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){for(const c of browser.contexts())for(const p of c.pages()){await p.screenshot({path:'/tmp/agora-research-browser-failure.png'}).catch(()=>{});console.log((await p.locator('body').innerText()).slice(0,3500));}throw error;}finally{await browser.close();}
