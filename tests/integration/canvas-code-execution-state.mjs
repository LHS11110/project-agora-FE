import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost:5191';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const user={email:'roles@example.invalid',nickname:'Roles',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.roles';
const policies={'admin-group':{read:true,write:true,execute:true},default:{read:true,write:false,execute:false}};
const items={box:{kind:'shape',shapeType:'rectangle',x:.2,y:.2,width:.15,height:.12,color:'#6852d6',fill:'#eee9fb',permission:'default'},exec:{kind:'shape',shapeType:'rectangle',runtimeRole:'executor',x:.12,y:.55,width:.22,height:.2,permission:'default'},code:{kind:'code',code:'print(1)',language:'python',filename:'main.py',x:.42,y:.5,width:.2,height:.2,permission:'default'},output:{kind:'shape',shapeType:'rectangle',runtimeRole:'output',x:.72,y:.55,width:.2,height:.2,permission:'default'},e1:{kind:'connector',from:'exec',to:'code',permission:'default'},e2:{kind:'connector',from:'code',to:'output',permission:'default'}};
items.next={kind:'text',renderMode:'code',language:'python',filename:'next.py',text:'print(2)',x:.65,y:.18,width:.2,height:.2,permission:'default'};
items.last={kind:'code',language:'python',filename:'last.py',code:'print(3)',x:.1,y:.16,width:.2,height:.2,permission:'default'};
items.nextEdge={kind:'connector',from:'code',to:'next',permission:'default'};items.lastEdge={kind:'connector',from:'next',to:'last',permission:'default'};
const pending=[];
const errors=[];
try{for(const role of ['admin']){let executions=0,writes=0,settingsUpdate=null,revision=0,latest=structuredClone(items);const admin=role==='admin';const caps={groups:['default'],write_groups:admin?['default']:[],execute_groups:role==='viewer'?[]:['default'],is_admin:admin};
const context=await browser.newContext({viewport:{width:1920,height:1200},locale:'ko-KR',ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1'});
await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token,user});
const settings=()=>({canvas_name:'Role fixture',settings_revision:revision,visibility:'private',participants:[],group_permissions:policies,can_manage:admin});
await context.route(url=>url.pathname.startsWith('/api/'),r=>{const path=new URL(r.request().url()).pathname.replace(/\/runtime\/execute\/stream$/, '/runtime/execute');let data={canvas_id:999003,canvas_name:'Role fixture'};if(path==='/api/auth/me')data=user;else if(path.endsWith('/access'))data={ws_port:8002,canvas_access_token:'fixture'};else if((path.endsWith('/runtime/execute')||path.endsWith('/runtime/build'))){executions++;pending.push(r);return;}else if(path.endsWith('/runtime/settings'))data={revision:0,languages:{cpp:{engine:'clang21',standard:'c++17'}},catalog:{cpp:{label:'C++',engines:{clang21:{label:'Clang',mode:'shared'}},fields:{standard:{label:'언어 표준',values:['c++17']}}}}};else if(path.endsWith('/settings'))data=settings();return r.fulfill(new URL(r.request().url()).pathname.endsWith('/runtime/execute/stream')?{contentType:'application/x-ndjson',body:JSON.stringify({type:'result',result:data})+'\n'}:{json:data});});
await context.routeWebSocket(/\/wss\/port\//,ws=>{const rtc=ws.url().includes('/rtc/'),client=new URL(ws.url()).searchParams.get('client_id');setTimeout(()=>ws.send(JSON.stringify(rtc?{type:'rtc_ready'}:{type:'init_items',items:latest,...caps,groups:['default'],sync_protocol:2,sync_user_id:7,revision:0,accepted_count:0,rtc_canvas_connection_id:'fixture',rtc_canvas_connection_hash:'proof'})),100);ws.onMessage(raw=>{const data=JSON.parse(String(raw));if(data.type==='rtc_join')ws.send(JSON.stringify({type:'rtc_peers',self_peer_id:'peer',peers:[]}));if(data.type==='canvas_settings_update'){settingsUpdate=data;revision++;ws.send(JSON.stringify({type:'canvas_settings_result',ok:true,request_id:data.request_id,settings:settings()}));}if(data.type==='canvas_ops'){writes++;for(const op of data.operations){
 if(op.action==='delete'){delete latest[op.id];continue;}
 if(op.action==='translate'){for(const id of op.ids){latest[id]={...latest[id],x:latest[id].x+op.dx,y:latest[id].y+op.dy};}continue;}
 latest[op.id]={...latest[op.id],...op.patch};for(const field of op.unset||[])delete latest[op.id][field];
 }const deleted=Object.fromEntries(data.operations.filter(o=>o.action==='delete').map(o=>[o.id,null]));revision++;ws.send(JSON.stringify({type:'canvas_commit',client_id:client,author_id:7,request_count:data.request_count,revision,items:{...latest,...deleted}}));}});});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/canvases/999003');await page.waitForFunction(()=>window.frelogCanvas?.read().items.box);

const code=id=>page.locator(`.canvas-object[data-item-id="${id}"]`);
const state=async(id,value)=>{await page.waitForFunction(({id,value})=>document.querySelector(`.canvas-object[data-item-id="${id}"]`)?.getAttribute('data-runtime-state')===value,{id,value});};
const finish=async(exitCode,output)=>{assert.ok(pending.length);const route=pending.shift();await route.fulfill(new URL(route.request().url()).pathname.endsWith('/runtime/execute/stream')?{contentType:'application/x-ndjson',body:JSON.stringify({type:'result',result:{exitCode,output}})+'\n'}:{json:{exitCode,output}});};
await page.locator('[data-blueprint-run]').click();
await state('code','running');await state('next','queued');await state('last','queued');
assert.equal(await page.locator('.runtime-activity').count(),0);
await page.screenshot({path:'/tmp/canvas-block-running.png'});
await finish(0,'1\n');await state('code','success');await state('next','running');
await finish(1,'Example compiler error');await state('next','error');await state('last','skipped');
assert.equal(executions,2);await code('next').getByRole('button',{name:/실행 실패/}).click();await code('next').getByText('Example compiler error',{exact:true}).waitFor();
assert.equal(await code('code').locator('.runtime-code-border').evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(53, 187, 131)');
assert.equal(await code('next').locator('.runtime-code-border').evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(241, 107, 123)');
await page.screenshot({path:'/tmp/canvas-block-failed.png'});
await page.locator('[data-blueprint-run]').click();await state('code','running');await state('next','queued');await state('last','queued');
await finish(0,'1\n');await state('next','running');await finish(0,'2\n');await state('last','running');await finish(0,'3\n');await state('last','success');
for(const id of ['code','next','last'])await state(id,'success');
// Let the fixture broker finish pending commits before starting a separate edit.
await page.waitForTimeout(150);
await page.evaluate(()=>{const api=window.frelogCanvas;api.apply(api.plan({version:1,items:{code:{code:'print(42)'}}}));});
await page.waitForFunction(()=>!document.querySelector('.canvas-object[data-item-id="code"]').hasAttribute('data-runtime-state'));
await code('code').locator('.unified-content-body').dblclick();await code('code').locator('.canvas-code-editor[data-status="ready"]').waitFor();await code('code').locator('.monaco-editor textarea').focus();await page.keyboard.press('Shift+Enter');await state('code','running');await finish(0,'42\n');await state('code','success');assert.equal(await code('code').locator('.canvas-code-editor[data-status="ready"]').count(),1);assert.equal(await code('code').locator('.monaco-editor textarea').evaluate(el=>document.activeElement===el),true,'status changes preserve editor and focus');
assert.deepEqual(errors,[]);console.log('PASS code-border execution order, colors, failure/skipped/retry, inline diagnostics, text-code support, stale-code clearing and Shift+Enter; no central overlay');await context.close();}}finally{await browser.close()}
