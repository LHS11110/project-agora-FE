import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as Automerge from '@automerge/automerge';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright-core');
if(!process.env.SYNC_SESSION_FILE)throw new Error('Provide SYNC_SESSION_FILE for a newly created disposable canvas.');
const auth=JSON.parse(fs.readFileSync(process.env.SYNC_SESSION_FILE));
assert.ok(auth.canvas.canvas_name.startsWith('서버 동기화 검증 (임시)'), 'Use only an explicitly named disposable synchronization test canvas');
const canvasId=auth.canvas.canvas_id;
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--host-resolver-rules=MAP 112.168.71.147 127.0.0.1','--disable-features=LocalNetworkAccessChecks','--enable-gpu','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']});
const contexts=[], errors=[], frames=[], sends=[];
async function open({blockRtc=false,dropCommit=false}={}){
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});contexts.push(context);
 await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},auth);
 await context.addInitScript(()=>{
   const Native=window.WebSocket;
   window.WebSocket=class extends Native {
     constructor(...args){super(...args);const url=new URL(args[0]);if(url.pathname.includes('/canvas/')&&!url.pathname.includes('/rtc/')){
       window.__canvasSocket=this;window.__canvasEvents=[];
       this.addEventListener('message',event=>{try{const frame=JSON.parse(event.data);if(['init_items','canvas_commit','canvas_snapshot','canvas_result','error'].includes(frame.type)){window.__canvasEvents.push(frame);if(window.__canvasEvents.length>100)window.__canvasEvents.shift();}}catch{}});
     }}
   };
 });
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 if(blockRtc) await page.routeWebSocket(url=>url.pathname.includes('/rtc/canvas/'),ws=>{ws.onMessage(()=>{});});
 if(dropCommit) {
   let drop=true;
   await page.routeWebSocket(url=>url.pathname.includes('/canvas/')&&!url.pathname.includes('/rtc/'),ws=>{
     const server=ws.connectToServer();ws.onMessage(message=>server.send(message));
     server.onMessage(message=>{const d=JSON.parse(message.toString());if(drop&&d.type==='canvas_commit'){drop=false;frames.push({type:'dropped_commit'});return;}ws.send(message);});
   });
 }
 page.on('websocket',ws=>{
   ws.on('framereceived',({payload})=>{try{const d=JSON.parse(payload.toString());frames.push({type:d.type,ok:d.ok,code:d.code,revision:d.revision});if(d.type==='init_items'&&d.client_id!==new URL(ws.url()).searchParams.get('client_id'))errors.push('Initial snapshot client ID does not match the editing session');if(d.type==='error'||d.type==='canvas_result')console.log('Result',d.type,d.code,d.ok);}catch{}});
   ws.on('framesent',({payload})=>{try{const d=JSON.parse(payload.toString());sends.push({type:d.type,...(d.type==='canvas_ops'?{operations:d.operations.map(o=>({action:o.action,ids:o.ids}))}:{})});}catch{}});
 });
 await page.goto(`https://112.168.71.147/canvases/${canvasId}`);
 await page.waitForFunction(()=>window.frelogCanvas&&document.querySelector('.connection-pill.connected')&&!document.querySelector('.canvas-loading-status.is-overlay'),null,{timeout:45000});
 return page;
}
const apply=(page,items,remove=[])=>page.evaluate(({items,remove})=>window.frelogCanvas.apply(window.frelogCanvas.plan({version:1,mode:'merge',items,remove})),{items,remove});
const waitItems=(page,expected)=>page.waitForFunction(expected=>{
 const items=window.frelogCanvas?.read().items;
 return items&&Object.entries(expected).every(([id,value])=>value===null?!items[id]:items[id]&&Object.entries(value).every(([k,v])=>items[id][k]===v));
},expected,{timeout:15000});
try{
 const a=await open({blockRtc:true});
 await apply(a,{'sync-box':{kind:'shape',shapeType:'rectangle',x:120,y:120,width:180,height:100,color:'#123456',fill:'#ffffff',permission:'default'},'sync-text':{kind:'text',text:'서버 직접 저장',x:120,y:250,width:250,height:60,fontSize:20,permission:'default'}});
 await a.waitForFunction(()=>document.querySelector('.host-canvas-status')?.textContent.includes('서버 저장 완료')&&!document.querySelector('.host-canvas-status')?.textContent.includes('저장 대기'),null,{timeout:20000});
 console.log('No-RTC editing and save passed.');
 const b=await open({dropCommit:true});await waitItems(b,{'sync-box':{x:120},'sync-text':{text:'서버 직접 저장'}});
 await apply(a,{'sync-box':{x:180}});
 await waitItems(b,{'sync-box':{x:180}});console.log('Dropped commit healed from watermark without reload.');
 const c=await open();await waitItems(c,{'sync-box':{x:180}});
 await apply(b,{'sync-box':{fill:'#f5e0aa'}});await waitItems(a,{'sync-box':{fill:'#f5e0aa'}});await waitItems(c,{'sync-box':{fill:'#f5e0aa'}});
 await contexts[0].close();
 await apply(c,{'sync-box':{x:240}});await waitItems(b,{'sync-box':{x:240}});console.log('Original author departed; remaining peers edit without election.');
 const vector={type:'canvas_ops',client_id:'vector-'+crypto.randomUUID(),request_count:1,request_id:crypto.randomUUID(),operations:[{action:'translate',ids:['sync-box','sync-text'],dx:.01,dy:.02}]};
 await c.evaluate(message=>window.__canvasSocket.send(JSON.stringify(message)),vector);
 await waitItems(b,{'sync-box':{x:256},'sync-text':{x:136,y:270}});
 await c.evaluate(message=>window.__canvasSocket.send(JSON.stringify(message)),vector);
 await c.waitForFunction(request=>window.__canvasEvents.some(e=>e.request_id===request&&e.type==='canvas_result'&&e.duplicate),vector.request_id);
 await waitItems(b,{'sync-box':{x:256},'sync-text':{x:136,y:270}});
 console.log('Compact vector duplicate applied exactly once.');
 const invalid={...vector,request_count:2,request_id:crypto.randomUUID(),operations:[{action:'translate',ids:['sync-box'],dx:1,dy:0},{action:'patch',id:'missing-item',patch:{x:1}}]};
 await c.evaluate(message=>window.__canvasSocket.send(JSON.stringify(message)),invalid);
 await c.waitForFunction(request=>window.__canvasEvents.some(e=>e.request_id===request&&e.code==='ITEM_NOT_FOUND'),invalid.request_id);
 await waitItems(c,{'sync-box':{x:256}});
 console.log('Rejected batch leaves every object unchanged.');
 const raw=await c.evaluate(()=>window.__canvasEvents.find(e=>e.type==='init_items').items['sync-text']);
 const base=Automerge.load(Buffer.from(raw.automerge_snapshot,'base64'));
 let doc=Automerge.clone(base);for(const change of raw.automerge_changes||[])doc=Automerge.loadIncremental(doc,Buffer.from(change.change,'base64'));
 const first=Automerge.change(Automerge.clone(doc),d=>Automerge.splice(d,['content'],0,0,'A'));
 const second=Automerge.change(Automerge.clone(doc),d=>Automerge.splice(d,['content'],d.content.length,0,'B'));
 const edit=d=>({type:'canvas_ops',client_id:'text-'+crypto.randomUUID(),request_count:1,request_id:crypto.randomUUID(),operations:[{action:'patch',id:'sync-text',patch:{text:d.content,automerge_snapshot:raw.automerge_snapshot,automerge_changes:Automerge.getChanges(base,d).map(change=>({field:'text',change:Buffer.from(change).toString('base64')}))}}]});
 await Promise.all([b.evaluate(message=>window.__canvasSocket.send(JSON.stringify(message)),edit(first)),c.evaluate(message=>window.__canvasSocket.send(JSON.stringify(message)),edit(second))]);
 await waitItems(b,{'sync-text':{text:'A서버 직접 저장B'}});await waitItems(c,{'sync-text':{text:'A서버 직접 저장B'}});
 console.log('Concurrent Automerge text changes converge on both browsers.');
 const many=Object.fromEntries(Array.from({length:1025},(_,i)=>['sync-load-'+i,{kind:'shape',shapeType:'rectangle',x:2000+(i%50)*100,y:2000+Math.floor(i/50)*100,width:70,height:50,fill:'#ddeeff',permission:'default'}]));
 const [,late]=await Promise.all([apply(b,many),open()]);
 await late.waitForFunction(()=>Object.keys(window.frelogCanvas.read().items).filter(id=>id.startsWith('sync-load-')).length===1025,null,{timeout:20000});
 await waitItems(late,many);
 await apply(b,{},Object.keys(many));
 await late.waitForFunction(()=>Object.keys(window.frelogCanvas.read().items).every(id=>!id.startsWith('sync-load-')),null,{timeout:20000});
 console.log('Joining during 1,025-object edit and batched deletion converges.');
 await apply(b,{'sync-ink':{kind:'stroke',points:[{x:10,y:10,pressure:.5},{x:20,y:20,pressure:.7}],strokeWidth:3,color:'#223344',permission:'default'}});
 await c.waitForFunction(()=>window.frelogCanvas.read().items['sync-ink']?.points.length===2);
 await apply(b,{'sync-ink':{points:[{x:10,y:10,pressure:.5},{x:20,y:20,pressure:.7},{x:30,y:25,pressure:.7}]}});
 await c.waitForFunction(()=>window.frelogCanvas.read().items['sync-ink']?.points.length===3);
 await apply(b,{},['sync-ink']);await waitItems(c,{'sync-ink':null});
 console.log('Drawing updates and eraser deletion propagate.');
 await apply(b,{},['sync-box']);await waitItems(c,{'sync-box':null});
 await c.reload();await c.waitForFunction(()=>window.frelogCanvas&&document.querySelector('.connection-pill.connected')&&!document.querySelector('.canvas-loading-status.is-overlay'),null,{timeout:30000});await waitItems(c,{'sync-box':null,'sync-text':{text:'A서버 직접 저장B'}});
 assert.deepEqual(errors,[]);
 assert.ok(!sends.some(f=>f.type.startsWith('host_')));
 fs.writeFileSync(process.env.SYNC_OUTPUT_FILE||'/tmp/agora-server-sync-browser-report.json',JSON.stringify({canvasId,errors,frames,sends},null,2));
 console.log(JSON.stringify({passed:true,errors,frameTypes:[...new Set(frames.map(f=>f.type))],sendTypes:[...new Set(sends.map(f=>f.type))]}));
} catch(error){
 fs.writeFileSync(process.env.SYNC_OUTPUT_FILE||'/tmp/agora-server-sync-browser-report.json',JSON.stringify({errors,frames,sends},null,2));
 for(const context of contexts)for(const page of context.pages())console.log('UI',await page.locator('body').innerText().catch(()=>''));console.error(error.message);throw error;
} finally{await browser.close();}
