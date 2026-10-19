import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const auth=JSON.parse(fs.readFileSync(process.env.ERD_TEST_SESSION_FILE));
assert.equal(auth.canvas.canvas_name,'ERD 연결 표기 검증 (임시)');
const id=auth.canvas.canvas_id,errors=[],rejections=[];
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--host-resolver-rules=MAP 112.168.71.147 127.0.0.1','--disable-features=LocalNetworkAccessChecks','--enable-gpu','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']});
try{
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1920,height:1200}});
 await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},auth);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('websocket',ws=>ws.on('framereceived',({payload})=>{try{const m=JSON.parse(payload);if(m.type==='error'||m.type==='canvas_result'&&m.ok===false)rejections.push(m.code);}catch{}}));
 const ready=()=>page.waitForFunction(()=>window.frelogCanvas&&document.querySelector('.connection-pill.connected')&&!document.querySelector('.canvas-loading-status.is-overlay'),null,{timeout:60000});
 await page.goto(`https://112.168.71.147/canvases/${id}`);await ready();
 const types=['erd-one','erd-zero-one','erd-one-many','erd-zero-many'],items={};
 for(const [styleIndex,visualStyle] of ['standard','sketch'].entries())for(const [i,type] of types.entries()){
  const x=80+styleIndex*950,y=160+i*240,from=`erd-fixture-from-${styleIndex}-${i}`,to=`erd-fixture-to-${styleIndex}-${i}`,line=`erd-fixture-line-${styleIndex}-${i}`;
  items[from]={kind:'shape',shapeType:'rectangle',x,y,width:170,height:85,fill:'#edf3f8',color:'#64748b',shadowEnabled:false};
  items[to]={...items[from],x:x+600};
  items[line]={kind:'connector',from,to,startHead:type,endHead:types[3-i],headSize:28,strokeWidth:2.5,color:'#345b7a',visualStyle,bend:i===3?.25:0};
  items[line+'-label']={kind:'text',text:`${visualStyle} · ${type} / ${types[3-i]}`,renderMode:'plain',x,y:y-65,width:780,height:50,fontSize:22};
 }
 await page.evaluate(items=>window.frelogCanvas.apply(window.frelogCanvas.plan({version:1,mode:'merge',items})),items);
 await page.waitForFunction(n=>Object.keys(window.frelogCanvas.read().items).length===n,Object.keys(items).length);
 // Applying a one-object numeric change selects that connector in the inspector.
 await page.evaluate(()=>window.frelogCanvas.apply(window.frelogCanvas.plan({version:1,mode:'merge',items:{'erd-fixture-line-0-0':{headSize:29}}})));
 const start=page.getByLabel('시작 화살표 머리 모양',{exact:true}),end=page.getByLabel('끝 화살표 머리 모양',{exact:true});
 await start.waitFor();assert.equal(await start.inputValue(),'erd-one');assert.equal(await end.inputValue(),'erd-zero-many');
 assert.equal(await start.locator('optgroup[label="ERD 관계"] option').count(),4);
 await start.selectOption('erd-zero-one');await end.selectOption('erd-one-many');
 await page.waitForFunction(()=>{const i=window.frelogCanvas.read().items['erd-fixture-line-0-0'];return i.startHead==='erd-zero-one'&&i.endHead==='erd-one-many';});
 await page.waitForFunction(()=>document.querySelector('.host-canvas-status')?.textContent.includes('서버 동기화됨'),null,{timeout:30000});
 await page.screenshot({path:'/tmp/agora-erd-arrowheads-inspector.png'});
 await page.reload();await ready();
 await page.waitForFunction(n=>Object.keys(window.frelogCanvas.read().items).length===n,Object.keys(items).length);
 const saved=await page.evaluate(()=>window.frelogCanvas.read().items);
 for(const [key,item] of Object.entries(items))if(item.kind==='connector'){
  assert.equal(saved[key].startHead,key==='erd-fixture-line-0-0'?'erd-zero-one':item.startHead);
  assert.equal(saved[key].endHead,key==='erd-fixture-line-0-0'?'erd-one-many':item.endHead);
  assert.equal(saved[key].visualStyle,item.visualStyle);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(rejections,[]);
 console.log(JSON.stringify({canvas_id:id,objects:Object.keys(items).length,connectors:8,erdOptions:4,inspectorChanged:true,reloadVerified:true,errors,rejections}));
}finally{await browser.close();}
