import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost:5191';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const user={email:'roles@example.invalid',nickname:'Roles',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.roles';
const policies={'admin-group':{read:true,write:true,execute:true},default:{read:true,write:false,execute:false}};
const items={'terminal-demo':{kind:'shape',shapeType:'rectangle',runtimeRole:'terminal',x:.1,y:.1,width:.42,height:.4,permission:['default']}};
const errors=[];
try{for(const role of ['admin']){let executions=0,writes=0,settingsUpdate=null,revision=0,latest=structuredClone(items);const admin=role==='admin';const caps={groups:['default'],write_groups:admin?['default']:[],execute_groups:role==='viewer'?[]:['default'],is_admin:admin};
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ko-KR',ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1'});
await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token,user});
const settings=()=>({canvas_name:'Role fixture',settings_revision:revision,visibility:'private',participants:[],group_permissions:policies,can_manage:admin});
await context.route(url=>url.pathname.startsWith('/api/'),r=>{const path=new URL(r.request().url()).pathname.replace(/\/runtime\/execute\/stream$/, '/runtime/execute');let data={canvas_id:999003,canvas_name:'Role fixture'};if(path==='/api/auth/me')data=user;else if(path.endsWith('/access'))data={ws_port:8002,canvas_access_token:'fixture'};else if(path.endsWith('/runtime/execute')){executions++;data={output:'1\n',exitCode:0};}else if(path.endsWith('/runtime/settings'))data={revision:0,languages:{cpp:{engine:'clang21',standard:'c++17'}},catalog:{cpp:{label:'C++',engines:{clang21:{label:'Clang',mode:'shared'}},fields:{standard:{label:'언어 표준',values:['c++17']}}}}};else if(path.endsWith('/settings'))data=settings();return r.fulfill(new URL(r.request().url()).pathname.endsWith('/runtime/execute/stream')?{contentType:'application/x-ndjson',body:JSON.stringify({type:'result',result:data})+'\n'}:{json:data});});
await context.routeWebSocket(/\/wss\/port\//,ws=>{const rtc=ws.url().includes('/rtc/'),client=new URL(ws.url()).searchParams.get('client_id');setTimeout(()=>ws.send(JSON.stringify(rtc?{type:'rtc_ready'}:{type:'init_items',items:latest,...caps,groups:['default'],sync_protocol:2,sync_user_id:7,revision:0,accepted_count:0,rtc_canvas_connection_id:'fixture',rtc_canvas_connection_hash:'proof'})),100);ws.onMessage(raw=>{const data=JSON.parse(String(raw));if(data.type==='rtc_join')ws.send(JSON.stringify({type:'rtc_peers',self_peer_id:'peer',peers:[]}));if(data.type==='canvas_settings_update'){settingsUpdate=data;revision++;ws.send(JSON.stringify({type:'canvas_settings_result',ok:true,request_id:data.request_id,settings:settings()}));}if(data.type==='canvas_ops'){writes++;for(const op of data.operations){
 if(op.action==='delete'){delete latest[op.id];continue;}
 if(op.action==='translate'){for(const id of op.ids){latest[id]={...latest[id],x:latest[id].x+op.dx,y:latest[id].y+op.dy};}continue;}
 latest[op.id]={...latest[op.id],...op.patch};for(const field of op.unset||[])delete latest[op.id][field];
 }const deleted=Object.fromEntries(data.operations.filter(o=>o.action==='delete').map(o=>[o.id,null]));revision++;ws.send(JSON.stringify({type:'canvas_commit',client_id:client,author_id:7,request_count:data.request_count,revision,items:{...latest,...deleted}}));}});});
let operations=[];let terminalOffset=0,tickets=0,sockets=[];
await context.route('**/runtime/terminal/ticket',async r=>{tickets++;await r.fulfill({json:{ticket:'single-use-fixture-'+tickets,path:'/api/terminal/ws'}});});
await context.routeWebSocket(/\/api\/terminal\/ws$/,ws=>{sockets.push(ws);ws.onMessage(raw=>{const command=JSON.parse(String(raw));operations.push(command);if(command.type==='attach')ws.send(JSON.stringify({type:'ready',data:Buffer.from('VM terminal ready\r\n$ ').toString('base64'),offset:terminalOffset,exited:false}));else if(command.operation==='input'){terminalOffset+=Buffer.byteLength(command.data);ws.send(JSON.stringify({type:'output',data:Buffer.from(command.data).toString('base64'),offset:terminalOffset,exited:false}));}else if(command.operation==='close'){ws.send(JSON.stringify({type:'closed'}));}});});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/canvases/999003');await page.waitForFunction(()=>window.frelogCanvas?.read());



await page.locator('.canvas-loading-status.is-overlay').waitFor({state:'hidden'});
const terminal=page.locator('.canvas-terminal');await terminal.getByRole('button',{name:'연결',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.canvas-terminal')?.dataset.terminalState==='connected',{},{timeout:5000}).catch(async error=>{console.log('STATE',await terminal.innerText(),'ERRORS',errors,'OPS',operations);throw error;});
await page.locator('.terminal-object').click({position:{x:100,y:10}});await terminal.locator('.xterm-helper-textarea').focus();await page.keyboard.type('pwd');await page.keyboard.press('Enter');
await page.waitForTimeout(350);
assert.ok(operations.filter(o=>o.operation==='input').map(o=>o.data).join('').includes('pwd'));assert.equal(tickets,1);assert.ok(operations.some(o=>o.type==='attach'));
const before=operations.filter(o=>o.operation==='input').length;sockets[0].close({code:1011,reason:'reconnect test'});await page.waitForTimeout(700);assert.equal(tickets,2);assert.equal(operations.filter(o=>o.operation==='input').length,before,'unacknowledged input is never replayed');
await page.screenshot({path:'/tmp/terminal-object.png'});await terminal.getByRole('button',{name:'연결 종료',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.canvas-terminal')?.dataset.terminalState==='disconnected');assert.ok(operations.some(o=>o.operation==='close'));
await context.close();}assert.deepEqual(errors,[]);console.log('PASS WebSocket terminal input/output, ticket bootstrap, reconnect without input replay and disconnect');}finally{await browser.close();}
