import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost:5191';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const user={email:'roles@example.invalid',nickname:'Roles',tag_number:1,role:'ROLE_USER',status:'ACTIVE',profile_image:'/api/test-avatar'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.roles';
const policies={'admin-group':{read:true,write:true,execute:true},default:{read:true,write:false,execute:false}};
const value=(valueType,x,y)=>({kind:'value',title:'',valueType,valueMin:0,valueMax:valueType==='real'?1:100,valueStep:valueType==='real'?.01:1,valueNumber:0,valueText:'',valueOptions:valueType==='select'?['A','B','C']:['꺼짐','켜짐'],x,y,width:.24,height:.21,permission:'default'});
const items={box:{kind:'shape',shapeType:'rectangle',x:.35,y:.4,width:.2,height:.2,permission:'default'}};const packets=[];

const peers=new Set(),receipts=new Map();
const errors=[];let notes=[];
try{for(const role of ['admin']){let executions=0,writes=0,settingsUpdate=null,revision=0,latest=structuredClone(items);const admin=role==='admin';const caps={groups:['default'],write_groups:admin?['default']:[],execute_groups:role==='viewer'?[]:['default'],is_admin:admin};
const context=await browser.newContext({permissions:['microphone'],viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,locale:'ko-KR',ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1'});
await context.addInitScript(({token,user})=>{if(window!==window.top)return;localStorage.setItem('frelog_tool_categories',JSON.stringify({structure:true}));localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token,user});
context.setDefaultTimeout(60000);
const settings=()=>({canvas_name:'Role fixture',settings_revision:revision,visibility:'private',participants:[],group_permissions:policies,can_manage:admin});
await context.route(url=>url.pathname.startsWith('/api/'),r=>{if(new URL(r.request().url()).pathname==='/api/test-avatar')return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="blue"/></svg>'});const path=new URL(r.request().url()).pathname.replace(/\/runtime\/execute\/stream$/, '/runtime/execute');let data={canvas_id:999003,canvas_name:'Role fixture'};if(path==='/api/auth/me')data=user;else if(path.endsWith('/access'))data={ws_port:8002,canvas_access_token:'fixture'};else if((path.endsWith('/runtime/execute')||path.endsWith('/runtime/build'))){executions++;data={output:'1\n',exitCode:0};}else if(path.endsWith('/runtime/settings'))data={revision:0,languages:{cpp:{engine:'clang21',standard:'c++17'}},catalog:{cpp:{label:'C++',engines:{clang21:{label:'Clang',mode:'shared'}},fields:{standard:{label:'언어 표준',values:['c++17']}}}}};else if(path.endsWith('/settings'))data=settings();return r.fulfill(new URL(r.request().url()).pathname.endsWith('/runtime/execute/stream')?{contentType:'application/x-ndjson',body:JSON.stringify({type:'result',result:data})+'\n'}:{json:data});});
await context.routeWebSocket(/\/wss\/port\//,ws=>{const rtc=ws.url().includes('/rtc/');if(!rtc){peers.add(ws);ws.onClose(()=>peers.delete(ws));}const client=new URL(ws.url()).searchParams.get('client_id');setTimeout(()=>ws.send(JSON.stringify(rtc?{type:'rtc_ready'}:{type:'init_items',items:latest,...caps,groups:['default'],sync_protocol:2,sync_user_id:7,revision,accepted_count:0,rtc_canvas_connection_id:'fixture',rtc_canvas_connection_hash:'proof'})),100);ws.onMessage(raw=>{const data=JSON.parse(String(raw));packets.push(data);if(data.type==='voice_state')ws.send(JSON.stringify({...data,peer_id:'peer'}));if(data.type==='chat'&&!data.object_id)ws.send(JSON.stringify({type:'chat',sequence:163,text:data.text,sender:user.nickname,tag_number:user.tag_number,created_at:Date.now()}));if(data.type==='chat_history'){
 const comment=Boolean(data.object_id),to=data.to_sequence||160,from=comment?(data.to_sequence?40:100):data.from_sequence||Math.max(1,to-(data.limit||50)+1),count=comment?60:to-from+1;
 ws.send(JSON.stringify({type:'chat_history',request_id:data.request_id,room_id:'general',...(comment?{object_id:data.object_id}:{}),total:160,messages:Array.from({length:count},(_,i)=>({sequence:from+i,text:'Message '+(from+i)+'\nLine two\nLine three',sender:'Other',tag_number:2,created_at:Date.now()})),has_more:from>1,next_to_sequence:from-1}));
}if(data.type==='mentions_get')ws.send(JSON.stringify({type:'mentions_snapshot',request_id:data.request_id,notifications:notes}));if(data.type==='mention_read'){notes=[];ws.send(JSON.stringify({type:'mention_read',request_id:data.request_id,mention_id:data.mention_id}));}if(data.type==='canvas_sync')ws.send(JSON.stringify({type:'canvas_snapshot',client_id:data.client_id,items:latest,...caps,sync_protocol:2,sync_user_id:7,revision,accepted_count:receipts.get(data.client_id)||0}));if(data.type==='rtc_join')ws.send(JSON.stringify({type:'rtc_peers',self_peer_id:'peer',peers:[]}));if(data.type==='canvas_settings_update'){settingsUpdate=data;revision++;ws.send(JSON.stringify({type:'canvas_settings_result',ok:true,request_id:data.request_id,settings:settings()}));}if(data.type==='canvas_ops'){if((receipts.get(data.client_id)||0)>=data.request_count){ws.send(JSON.stringify({type:'canvas_result',request_id:data.request_id,ok:true,duplicate:true,server_revision:revision}));return;}const touched={};writes++;receipts.set(data.client_id,data.request_count);for(const op of data.operations){
 if(op.action==='delete'){delete latest[op.id];continue;}
 if(op.action==='translate'){for(const id of op.ids){latest[id]={...latest[id],x:latest[id].x+op.dx,y:latest[id].y+op.dy};touched[id]=latest[id];}continue;}
 latest[op.id]={...latest[op.id],...op.patch};for(const field of op.unset||[])delete latest[op.id][field];touched[op.id]=latest[op.id];
 }const deleted=Object.fromEntries(data.operations.filter(o=>o.action==='delete').map(o=>[o.id,null]));revision++;for(const peer of peers)peer.send(JSON.stringify({type:'canvas_commit',client_id:data.client_id,author_id:7,request_count:data.request_count,revision,items:{...touched,...deleted}}));}});});



const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/canvases/999003');await page.waitForFunction(()=>window.frelogCanvas?.read().items.box);await page.locator('.canvas-loading-status.is-overlay').waitFor({state:'hidden'});
for(const width of [1440,768,650,390,320]){
 await page.setViewportSize({width,height:900});await page.waitForTimeout(100);
 for(const expanded of [false,true]){
  const navigation=page.locator('.app-navigation-toggle');if((await navigation.getAttribute('aria-expanded')==='true')!==expanded)await navigation.click();
  const collapse=page.getByRole('button',{name:'캔버스 정보 접기',exact:true});if(await collapse.count())await collapse.click();
  await page.waitForTimeout(100);
  const metrics=await page.evaluate(()=>{const box=s=>document.querySelector(s).getBoundingClientRect(),n=box('.app-navigation-toggle svg'),t=box('.canvas-topbar>.canvas-chrome-toggle svg'),h=box('.canvas-topbar');return {nav:n.y+n.height/2,toggle:t.y+t.height/2,header:h.y+h.height/2};});
  console.log(width,expanded,metrics);
  if(width===390&&!expanded)await page.screenshot({path:'/tmp/canvas-header-aligned.png'});
  if(!process.env.AGORA_CAPTURE_BASELINE){assert.ok(Math.abs(metrics.nav-metrics.toggle)<=1,'navigation and info controls align');assert.ok(Math.abs(metrics.nav-metrics.header)<=1,'navigation icon centers inside the folded card');}
  await page.getByRole('button',{name:'캔버스 정보 펼치기',exact:true}).click();
 }
}
assert.deepEqual(errors,[]);console.log('PASS folded canvas header icon alignment across desktop/tablet/mobile with navigation expanded and collapsed');await context.close();}}finally{await browser.close();}
