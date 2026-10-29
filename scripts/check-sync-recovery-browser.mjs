import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright-core');
const state=JSON.parse(fs.readFileSync(process.env.SYNC_SESSION_FILE||'/tmp/agora-sync-session.json'));
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--host-resolver-rules=MAP 118.34.144.201 127.0.0.1','--disable-features=LocalNetworkAccessChecks']});
const report={dropped:[],exceptions:[],sockets:{},joinMs:[],codes:[]};let rules={};
const ready=page=>page.waitForFunction(()=>window.frelogCanvas && !document.querySelector('.canvas-loading-status.is-overlay'),null,{timeout:20000});
async function join(name){
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
 await context.addInitScript(s=>{localStorage.setItem('agora_token',s.token);localStorage.setItem('agora_user',JSON.stringify(s.user));},state);
 await context.routeWebSocket(url=>url.pathname.includes('/rtc/canvas/'),ws=>{
  const server=ws.connectToServer();ws.onMessage(message=>{
   try{const frame=JSON.parse(String(message)),payload=frame.type==='canvas_relay'?frame.payload:null;
    if(payload && rules[payload.type]>0 && (payload.type!=='host_state_part'||payload.index===0)){
     rules[payload.type]--;report.dropped.push({name,type:payload.type,index:payload.index});return;
    }
   }catch{}server.send(message);
  });
 });
 const page=await context.newPage();report.sockets[name]=0;
 page.on('pageerror',e=>report.exceptions.push(e.message));
 page.on('websocket',ws=>{report.sockets[name]++;ws.on('framereceived',({payload})=>{try{const f=JSON.parse(payload.toString());if(f.type==='error'||f.ok===false)report.codes.push({name,type:f.type,code:f.code});}catch{}});});
 const start=Date.now();await page.goto('https://118.34.144.201/canvases/'+state.canvas_id);await ready(page);report.joinMs.push({name,ms:Date.now()-start});console.log('Ready',name,Date.now()-start);
 return {page,context};
}
const stored=()=>JSON.parse(execFileSync('/home/steam/Github/project-agora-DB/redis/redis-ha-cli.sh',['--raw','JSON.GET','canvas:'+state.canvas_id,'$.items'],{cwd:'/home/steam/Github/project-agora-DB',maxBuffer:8*1024*1024}))[0];
try{
 const a=await join('steady');assert.equal(await a.page.evaluate(()=>Object.keys(window.frelogCanvas.read().items).length),0,'Use a new empty scratch canvas');rules={host_state:1,host_snapshot:1,host_snapshot_ack:1};const b=await join('handshake-loss');
 for(const type of ['host_state','host_snapshot','host_snapshot_ack'])assert.equal(rules[type],0,type+' injected');
 await a.page.evaluate(()=>window.frelogCanvas.apply(window.frelogCanvas.plan({version:1,items:{box:{kind:'shape',shapeType:'rectangle',x:100,y:200,width:100,height:60,fill:'#123456'}}})));
 await b.page.waitForFunction(()=>window.frelogCanvas.read().items.box?.x===100,null,{timeout:10000});
 await b.context.close();await ready(a.page);
 const manifest={version:1,items:Object.fromEntries(Array.from({length:40},(_,i)=>['large-'+i,{kind:'shape',shapeType:'rectangle',x:50+(i%10)*110,y:300+Math.floor(i/10)*90,width:80,height:60,title:'load-test '.repeat(5000),fill:'#678967',shadowEnabled:false}]))};
 await a.page.evaluate(m=>window.frelogCanvas.apply(window.frelogCanvas.plan(m)),manifest);await ready(a.page);
 for(let i=0;i<100;i++){if(Object.keys(stored()||{}).length===41)break;await a.page.waitForTimeout(100);}assert.equal(Object.keys(stored()).length,41);
 rules={host_state_part:1,host_part_ack:1};const c=await join('multipart-loss');assert.equal(rules.host_state_part,0);assert.equal(rules.host_part_ack,0);
 await c.page.waitForFunction(()=>Object.keys(window.frelogCanvas.read().items).length===41,null,{timeout:10000});
 for(let i=0;i<4;i++){
  const p=await join('cycle-'+i);
  await a.page.evaluate(i=>window.frelogCanvas.apply(window.frelogCanvas.plan({version:1,items:{box:{x:200+i}}})),i);
  await p.page.waitForFunction(x=>window.frelogCanvas.read().items.box?.x===x,200+i,{timeout:10000});
  await p.context.close();await ready(a.page);await ready(c.page);
 }
 rules={host_commit:1};
 await a.page.evaluate(()=>window.frelogCanvas.apply(window.frelogCanvas.plan({version:1,items:{box:{x:777}}})));
 await c.page.waitForFunction(()=>window.frelogCanvas.read().items.box?.x===777,null,{timeout:10000});
 await ready(a.page);await ready(c.page);assert.equal(rules.host_commit,0,'last commit loss injected');
 for(let i=0;i<100;i++){if(Math.abs((stored()?.box?.x||0)-777/1600)<1e-8)break;await a.page.waitForTimeout(100);}
 assert.ok(Math.abs(stored().box.x-777/1600)<1e-8);assert.equal(report.sockets.steady,2);assert.equal(report.sockets['multipart-loss'],2);assert.deepEqual(report.exceptions,[]);
 report.persisted=true;report.sameConnections=true;report.objects=41;console.log(JSON.stringify(report));fs.writeFileSync('/tmp/agora-sync-fault-results.json',JSON.stringify(report,null,2));
}finally{await browser.close();}
