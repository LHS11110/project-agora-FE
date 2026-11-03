import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost:5191';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const user={email:'roles@example.invalid',nickname:'Roles',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.roles';
const policies={'admin-group':{read:true,write:true,execute:true},default:{read:true,write:false,execute:false}};
const items={box:{kind:'shape',shapeType:'rectangle',x:.2,y:.2,width:.15,height:.12,color:'#6852d6',fill:'#eee9fb',permission:'default'},exec:{kind:'shape',shapeType:'rectangle',runtimeRole:'executor',x:.12,y:.55,width:.22,height:.2,permission:'default'},code:{kind:'code',code:'print(1)',language:'python',filename:'main.py',x:.42,y:.5,width:.2,height:.2,permission:'default'},output:{kind:'shape',shapeType:'rectangle',runtimeRole:'output',x:.72,y:.55,width:.2,height:.2,permission:'default'},e1:{kind:'connector',from:'exec',to:'code',permission:'default'},e2:{kind:'connector',from:'code',to:'output',permission:'default'}};
const errors=[];
try{for(const role of ['admin']){let executions=0,writes=0,settingsUpdate=null,revision=0,latest=structuredClone(items);const admin=role==='admin';const caps={groups:['default'],write_groups:admin?['default']:[],execute_groups:role==='viewer'?[]:['default'],is_admin:admin};
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ko-KR',ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1'});
await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token,user});
const settings=()=>({canvas_name:'Role fixture',settings_revision:revision,visibility:'private',participants:[],group_permissions:policies,can_manage:admin});
await context.route(url=>url.pathname.startsWith('/api/'),r=>{const path=new URL(r.request().url()).pathname;let data={canvas_id:999003,canvas_name:'Role fixture'};if(path==='/api/auth/me')data=user;else if(path.endsWith('/access'))data={ws_port:8002,canvas_access_token:'fixture'};else if((path.endsWith('/runtime/execute')||path.endsWith('/runtime/build'))){executions++;data={output:'1\n',exitCode:0};}else if(path.endsWith('/runtime/settings'))data={revision:0,languages:{cpp:{engine:'clang21',standard:'c++17'}},catalog:{cpp:{label:'C++',engines:{clang21:{label:'Clang',mode:'shared'}},fields:{standard:{label:'언어 표준',values:['c++17']}}}}};else if(path.endsWith('/settings'))data=settings();return r.fulfill({json:data});});
await context.routeWebSocket(/\/wss\/port\//,ws=>{const rtc=ws.url().includes('/rtc/'),client=new URL(ws.url()).searchParams.get('client_id');setTimeout(()=>ws.send(JSON.stringify(rtc?{type:'rtc_ready'}:{type:'init_items',items:latest,...caps,groups:['default'],sync_protocol:2,sync_user_id:7,revision:0,accepted_count:0,rtc_canvas_connection_id:'fixture',rtc_canvas_connection_hash:'proof'})),100);ws.onMessage(raw=>{const data=JSON.parse(String(raw));if(data.type==='rtc_join')ws.send(JSON.stringify({type:'rtc_peers',self_peer_id:'peer',peers:[]}));if(data.type==='canvas_settings_update'){settingsUpdate=data;revision++;ws.send(JSON.stringify({type:'canvas_settings_result',ok:true,request_id:data.request_id,settings:settings()}));}if(data.type==='canvas_ops'){writes++;for(const op of data.operations){
 if(op.action==='delete'){delete latest[op.id];continue;}
 if(op.action==='translate'){for(const id of op.ids){latest[id]={...latest[id],x:latest[id].x+op.dx,y:latest[id].y+op.dy};}continue;}
 latest[op.id]={...latest[op.id],...op.patch};for(const field of op.unset||[])delete latest[op.id][field];
 }const deleted=Object.fromEntries(data.operations.filter(o=>o.action==='delete').map(o=>[o.id,null]));revision++;ws.send(JSON.stringify({type:'canvas_commit',client_id:client,author_id:7,request_count:data.request_count,revision,items:{...latest,...deleted}}));}});});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/canvases/999003');await page.waitForFunction(()=>window.frelogCanvas?.read().items.box);

const before=writes;
await page.locator('.blueprint-executor').getByRole('button',{name:'사전 빌드',exact:true}).click();
await page.locator('.canvas-object[data-item-id="code"][data-runtime-state="success"]').waitFor();
assert.equal(executions,1);assert.equal(writes,before,'build must preserve output objects');
await page.locator('.code-prebuild-button').click();
await page.locator('.canvas-object[data-item-id="code"][data-runtime-state="success"]').waitFor();
assert.equal(executions,2);assert.equal(writes,before);
const fit=await page.locator('.executor-actions').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('.blueprint-node').getBoundingClientRect();return r.bottom<=p.bottom&&r.right<=p.right;});assert.ok(fit,'executor build controls fit existing object bounds');
assert.deepEqual(errors,[]);console.log('PASS canvas executor/code build buttons, permissions, output preservation and compact layout');await context.close();}}finally{await browser.close()}
