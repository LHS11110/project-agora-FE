import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
if(!process.env.TRAVEL_SESSION_FILE)throw new Error('Set TRAVEL_SESSION_FILE to a private session for a newly created canvas.');
const state=JSON.parse(fs.readFileSync(process.env.TRAVEL_SESSION_FILE,'utf8'));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright-core');
const manifest=JSON.parse(fs.readFileSync(new URL('../docs/travel-template/seoul-day-trip.canvas.json',import.meta.url),'utf8'));
const count=Object.keys(manifest.items).length;
const origin=process.env.AGORA_BASE_URL||'https://118.34.144.201';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--host-resolver-rules=MAP 118.34.144.201 127.0.0.1','--disable-features=LocalNetworkAccessChecks']});
const output=new URL('../docs/travel-template/',import.meta.url);
try{
 const context=await browser.newContext({viewport:{width:1920,height:1200},locale:'ko-KR'});
 await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));localStorage.setItem('frelog_locale','ko')},state);
 const page=await context.newPage(),errors=[],rejected=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('websocket',ws=>ws.on('framereceived',({payload})=>{try{const event=JSON.parse(payload.toString());if(event.type==='error'||event.type==='canvas_result'&&event.ok===false)rejected.push({type:event.type,code:event.code});}catch{}}));
 const ready=async()=>{await page.waitForFunction(()=>window.frelogCanvas&&document.querySelector('.connection-pill.connected')&&!document.querySelector('.canvas-loading-status.is-overlay'),null,{timeout:60000})};
 await page.goto(`${origin}/canvases/${state.canvas_id}`);await ready();
 const current=await page.evaluate(()=>window.frelogCanvas.read());
 assert.ok(Object.keys(current.items).every(id=>id.startsWith('trip-')),'Only apply to the new travel template canvas');
 const result=await page.evaluate(manifest=>window.frelogCanvas.apply(window.frelogCanvas.plan(manifest)),manifest);console.log('Queued:',JSON.stringify(result));
 await page.waitForFunction(count=>Object.keys(window.frelogCanvas.read().items).length===count,count,{timeout:30000});
 const redisCli=process.env.AGORA_REDIS_CLI||'/home/steam/Github/project-agora-DB/redis/redis-ha-cli.sh';
 const readStored=()=>JSON.parse(execFileSync(redisCli,['--raw','JSON.GET',`canvas:${state.canvas_id}`,'$.items'],{maxBuffer:16*1024*1024}).toString())[0];
 let stored;
 for(let i=0;i<60;i++){stored=readStored();if(Object.keys(stored||{}).length===count&&Object.entries(manifest.items).every(([id,item])=>stored[id]&&['text','src','fill','color'].every(field=>item[field]===undefined||stored[id][field]===item[field])))break;await page.waitForTimeout(500)}
 assert.equal(Object.keys(stored||{}).length,count,'All objects must be saved');
 for(const [id,item]of Object.entries(manifest.items))for(const field of ['kind','text','src','fill','color','depth'])if(item[field]!==undefined)assert.equal(stored[id]?.[field],item[field],id+'.'+field);
 await page.keyboard.press('Escape');
 for(const name of ['툴 패널 접기','설정 패널 접기','채팅 패널 접기','미니맵 접기','캔버스 탐색 접기','호스트바 접기','캔버스 정보 접기']){const button=page.getByRole('button',{name,exact:true});if(await button.isVisible().catch(()=>false))await button.click()}
 await page.getByRole('button',{name:'맞춤',exact:true}).click();await page.waitForTimeout(900);
 const mapBox=await page.getByAltText('서울숲·성수·뚝섬 위치도 | © OpenStreetMap contributors',{exact:true}).boundingBox();
 const scale=mapBox.width/960;
 await page.screenshot({path:new URL('preview.png',output).pathname,clip:{x:mapBox.x-50*scale,y:mapBox.y-176*scale,width:1540*scale,height:975*scale}});
 await page.screenshot({path:new URL('canvas-screenshot.png',output).pathname});
 await page.reload();await ready();
 await page.waitForFunction(count=>Object.keys(window.frelogCanvas.read().items).length===count,count,{timeout:30000});
 const reloaded=await page.evaluate(()=>window.frelogCanvas.read());
 assert.deepEqual(Object.keys(reloaded.items).sort(),Object.keys(manifest.items).sort());
 for(const [id,item]of Object.entries(manifest.items))for(const field of ['kind','text','src','fill','color','depth'])if(item[field]!==undefined)assert.equal(reloaded.items[id][field],item[field],id+'.'+field);
 assert.deepEqual(errors,[]);assert.deepEqual(rejected,[]);
 const validation={canvas_id:state.canvas_id,url:`${origin}/canvases/${state.canvas_id}`,objects:count,photos:Object.values(manifest.items).filter(i=>i.kind==='image').length-1,drawings:Object.values(manifest.items).filter(i=>i.kind==='stroke').length,nativeNotes:Object.values(manifest.items).filter(i=>i.kind==='note').length,persisted:true,reloadVerified:true,browserErrors:errors,rejectedWrites:rejected};
 fs.writeFileSync(new URL('validation.json',output),JSON.stringify(validation,null,2));console.log(JSON.stringify(validation));
}finally{await browser.close()}
