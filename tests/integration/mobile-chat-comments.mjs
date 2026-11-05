import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost:5191';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const user={email:'roles@example.invalid',nickname:'Roles',tag_number:1,role:'ROLE_USER',status:'ACTIVE',profile_image:'/api/test-avatar'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.roles';
const policies={'admin-group':{read:true,write:true,execute:true},default:{read:true,write:false,execute:false}};
const value=(valueType,x,y)=>({kind:'value',title:'',valueType,valueMin:0,valueMax:valueType==='real'?1:100,valueStep:valueType==='real'?.01:1,valueNumber:0,valueText:'',valueOptions:valueType==='select'?['A','B','C']:['꺼짐','켜짐'],x,y,width:.24,height:.21,permission:'default'});
const items={box:{kind:'shape',shapeType:'rectangle',x:.35,y:.4,width:.2,height:.2,permission:'default'}};const packets=[];

const peers=new Set(),receipts=new Map();
const errors=[];
try{for(const role of ['admin']){let executions=0,writes=0,settingsUpdate=null,revision=0,latest=structuredClone(items);const admin=role==='admin';const caps={groups:['default'],write_groups:admin?['default']:[],execute_groups:role==='viewer'?[]:['default'],is_admin:admin};
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,locale:'ko-KR',ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1'});
await context.addInitScript(({token,user})=>{if(window!==window.top)return;localStorage.setItem('frelog_tool_categories',JSON.stringify({structure:true}));localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token,user});
context.setDefaultTimeout(60000);
const settings=()=>({canvas_name:'Role fixture',settings_revision:revision,visibility:'private',participants:[],group_permissions:policies,can_manage:admin});
await context.route(url=>url.pathname.startsWith('/api/'),r=>{if(new URL(r.request().url()).pathname==='/api/test-avatar')return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="blue"/></svg>'});const path=new URL(r.request().url()).pathname.replace(/\/runtime\/execute\/stream$/, '/runtime/execute');let data={canvas_id:999003,canvas_name:'Role fixture'};if(path==='/api/auth/me')data=user;else if(path.endsWith('/access'))data={ws_port:8002,canvas_access_token:'fixture'};else if((path.endsWith('/runtime/execute')||path.endsWith('/runtime/build'))){executions++;data={output:'1\n',exitCode:0};}else if(path.endsWith('/runtime/settings'))data={revision:0,languages:{cpp:{engine:'clang21',standard:'c++17'}},catalog:{cpp:{label:'C++',engines:{clang21:{label:'Clang',mode:'shared'}},fields:{standard:{label:'언어 표준',values:['c++17']}}}}};else if(path.endsWith('/settings'))data=settings();return r.fulfill(new URL(r.request().url()).pathname.endsWith('/runtime/execute/stream')?{contentType:'application/x-ndjson',body:JSON.stringify({type:'result',result:data})+'\n'}:{json:data});});
await context.routeWebSocket(/\/wss\/port\//,ws=>{const rtc=ws.url().includes('/rtc/');if(!rtc){peers.add(ws);ws.onClose(()=>peers.delete(ws));}const client=new URL(ws.url()).searchParams.get('client_id');setTimeout(()=>ws.send(JSON.stringify(rtc?{type:'rtc_ready'}:{type:'init_items',items:latest,...caps,groups:['default'],sync_protocol:2,sync_user_id:7,revision,accepted_count:0,rtc_canvas_connection_id:'fixture',rtc_canvas_connection_hash:'proof'})),100);ws.onMessage(raw=>{const data=JSON.parse(String(raw));packets.push(data);if(data.type==='canvas_sync')ws.send(JSON.stringify({type:'canvas_snapshot',client_id:data.client_id,items:latest,...caps,sync_protocol:2,sync_user_id:7,revision,accepted_count:receipts.get(data.client_id)||0}));if(data.type==='rtc_join')ws.send(JSON.stringify({type:'rtc_peers',self_peer_id:'peer',peers:[]}));if(data.type==='canvas_settings_update'){settingsUpdate=data;revision++;ws.send(JSON.stringify({type:'canvas_settings_result',ok:true,request_id:data.request_id,settings:settings()}));}if(data.type==='canvas_ops'){if((receipts.get(data.client_id)||0)>=data.request_count){ws.send(JSON.stringify({type:'canvas_result',request_id:data.request_id,ok:true,duplicate:true,server_revision:revision}));return;}const touched={};writes++;receipts.set(data.client_id,data.request_count);for(const op of data.operations){
 if(op.action==='delete'){delete latest[op.id];continue;}
 if(op.action==='translate'){for(const id of op.ids){latest[id]={...latest[id],x:latest[id].x+op.dx,y:latest[id].y+op.dy};touched[id]=latest[id];}continue;}
 latest[op.id]={...latest[op.id],...op.patch};for(const field of op.unset||[])delete latest[op.id][field];touched[op.id]=latest[op.id];
 }const deleted=Object.fromEntries(data.operations.filter(o=>o.action==='delete').map(o=>[o.id,null]));revision++;for(const peer of peers)peer.send(JSON.stringify({type:'canvas_commit',client_id:data.client_id,author_id:7,request_count:data.request_count,revision,items:{...touched,...deleted}}));}});});


const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.goto(origin+'/search');const profile=page.locator('.mobile-profile-button');await profile.waitFor();
const centerError=async(outer,inner)=>outer.evaluate((e,selector)=>{const a=e.getBoundingClientRect(),b=e.querySelector(selector).getBoundingClientRect();return {x:(a.left+a.right-b.left-b.right)/2,y:(a.top+a.bottom-b.top-b.bottom)/2,w:b.width,h:b.height};},inner);
for(const width of [320,390,650]){
 await page.setViewportSize({width,height:844});const c=await centerError(profile,'.user-avatar');assert.ok(Math.abs(c.x)<.5&&Math.abs(c.y)<.5,JSON.stringify({width,c}));assert.equal(c.w,34);assert.equal(c.h,34);await profile.locator('img').waitFor();const image=await centerError(profile,'img');assert.ok(Math.abs(image.x)<.5&&Math.abs(image.y)<.5,JSON.stringify(image));
}
await page.setViewportSize({width:390,height:844});await page.goto(origin+'/canvases/999003');await page.locator('.canvas-loading-status.is-overlay').waitFor({state:'hidden'});
for(const panel of ['tools','inspector','chat']){
 const slot=page.locator('.canvas-panel-slot-'+panel),toggle=slot.locator('.canvas-panel-toggle');if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
 for(const width of panel==='chat'?[320,390]:[320,390,768]){await page.setViewportSize({width,height:844});const c=await centerError(toggle,'svg');assert.ok(Math.abs(c.x)<1&&Math.abs(c.y)<1,JSON.stringify({panel,width,c}));assert.ok(c.w>=14&&c.h>=14);}
}
await page.setViewportSize({width:390,height:844});const chatToggle=page.getByRole('button',{name:/채팅 패널 (펼치기|접기)/});if(await chatToggle.getAttribute('aria-expanded')==='false')await chatToggle.click();
const imeSend=async(input,text,objectId)=>{
 const count=()=>packets.filter(p=>p.type==='chat'&&(objectId?p.object_id===objectId:!p.object_id)).length;
 const before=count();await input.focus();await input.dispatchEvent('compositionstart',{data:''});await input.fill(text);
 await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,keyCode:229});await page.waitForTimeout(120);assert.equal(count(),before);assert.equal(await input.inputValue(),text);
 await input.dispatchEvent('compositionend',{data:text});await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:false,keyCode:229});await page.waitForTimeout(120);assert.equal(count(),before);
 await input.press('Enter');await page.waitForTimeout(250);assert.equal(count(),before+1);assert.equal(await input.inputValue(),'');await input.press('Enter');await page.waitForTimeout(100);assert.equal(count(),before+1);
 const sent=packets.filter(p=>p.type==='chat'&&(objectId?p.object_id===objectId:!p.object_id)).at(-1);assert.equal(sent.text,text);
};
await imeSend(page.getByLabel('채팅 메시지 입력',{exact:true}),'한');
// Select via the public canvas editing API, then open the object's comment composer.
await page.evaluate(()=>{const doc=window.frelogCanvas.read();doc.items.box.color='#aabbcc';window.frelogCanvas.apply(window.frelogCanvas.plan(doc));});
const settingsToggle=page.getByRole('button',{name:/설정 패널 (펼치기|접기)/});if(await settingsToggle.getAttribute('aria-expanded')==='false')await settingsToggle.click();
await page.getByRole('button',{name:'객체 댓글',exact:true}).click();await imeSend(page.getByLabel('객체 댓글 입력',{exact:true}),'글','box');
await page.screenshot({path:'/tmp/mobile-chat-comments.png'});assert.deepEqual(errors,[]);console.log('PASS mobile avatar and collapsed icon centering at 320/390/768px, Korean IME sends exactly once in chat and comments');await context.close();}}finally{await browser.close();}
