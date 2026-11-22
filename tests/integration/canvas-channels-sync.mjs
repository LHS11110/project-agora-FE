// Full-page channel flow through the real sync path (canvas_ops -> server -> commit).
// AGORA_PERF_OBJECTS=10 node tests/integration/canvas-channels-sync.mjs
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost:5191';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const user={email:'roles@example.invalid',nickname:'Roles',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.roles';
const policies={'admin-group':{read:true,write:true,execute:true},default:{read:true,write:false,execute:false}};
const value=(valueType,x,y)=>({kind:'value',title:'',valueType,valueMin:0,valueMax:valueType==='real'?1:100,valueStep:valueType==='real'?.01:1,valueNumber:0,valueText:'',valueOptions:valueType==='select'?['A','B','C']:['꺼짐','켜짐'],x,y,width:.24,height:.21,permission:'default'});
const N=Number(process.env.AGORA_PERF_OBJECTS||10);const cols=Math.ceil(Math.sqrt(N));const items=Object.fromEntries(Array.from({length:N},(_,i)=>['load-'+i,{...(process.env.AGORA_PERF_KIND==='code'?{kind:'code',code:'def add(a, b):\n    return a + b\n\nprint(add(3, 4))',filename:'example'+i+'.py',language:'python'}:{kind:'shape',shapeType:'rectangle'}),x:(i%cols)/cols,y:Math.floor(i/cols)/cols,width:.65/cols,height:.65/cols,fill:['#98a8c4','#bab0cf','#a1bdb5'][i%3],strokeEnabled:false,shadowEnabled:false,permission:'default'}]));items.drag={kind:'shape',shapeType:'rectangle',runtimeRole:'output',x:.42,y:.3,width:.16,height:.15,permission:'default'};const packets=[];

const peers=new Set(),receipts=new Map();
const errors=[];
try{for(const role of ['admin']){let executions=0,writes=0,settingsUpdate=null,revision=0,latest=structuredClone(items);const admin=role==='admin';const caps={groups:['default'],write_groups:admin?['default']:[],execute_groups:role==='viewer'?[]:['default'],is_admin:admin};
const context=await browser.newContext({viewport:{width:2100,height:1450},locale:'ko-KR',ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1'});
await context.addInitScript(({token,user})=>{localStorage.setItem('frelog_tool_categories',JSON.stringify({structure:true}));localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token,user});
context.setDefaultTimeout(60000);
const settings=()=>({canvas_name:'Role fixture',settings_revision:revision,visibility:'private',participants:[],group_permissions:policies,can_manage:admin});
await context.route(url=>url.pathname.startsWith('/api/'),r=>{const path=new URL(r.request().url()).pathname.replace(/\/runtime\/execute\/stream$/, '/runtime/execute');let data={canvas_id:999003,canvas_name:'Role fixture'};if(path==='/api/auth/me')data=user;else if(path==='/api/auth/session/refresh')data={accessToken:token,user};else if(path.endsWith('/access'))data={ws_port:8002,canvas_access_token:'fixture'};else if((path.endsWith('/runtime/execute')||path.endsWith('/runtime/build'))){executions++;data={output:'1\n',exitCode:0};}else if(path.endsWith('/runtime/settings'))data={revision:0,languages:{cpp:{engine:'clang21',standard:'c++17'}},catalog:{cpp:{label:'C++',engines:{clang21:{label:'Clang',mode:'shared'}},fields:{standard:{label:'언어 표준',values:['c++17']}}}}};else if(path.endsWith('/settings'))data=settings();return r.fulfill(new URL(r.request().url()).pathname.endsWith('/runtime/execute/stream')?{contentType:'application/x-ndjson',body:JSON.stringify({type:'result',result:data})+'\n'}:{json:data});});
await context.routeWebSocket(/\/wss\/port\//,ws=>{const rtc=ws.url().includes('/rtc/');if(!rtc){peers.add(ws);ws.onClose(()=>peers.delete(ws));}const client=new URL(ws.url()).searchParams.get('client_id');setTimeout(()=>ws.send(JSON.stringify(rtc?{type:'rtc_ready'}:{type:'init_items',items:latest,...caps,groups:['default'],sync_protocol:2,sync_user_id:7,revision,accepted_count:0,rtc_canvas_connection_id:'fixture',rtc_canvas_connection_hash:'proof'})),100);ws.onMessage(raw=>{const data=JSON.parse(String(raw));packets.push(data);if(data.type==='canvas_sync')ws.send(JSON.stringify({type:'canvas_snapshot',client_id:data.client_id,items:latest,...caps,sync_protocol:2,sync_user_id:7,revision,accepted_count:receipts.get(data.client_id)||0}));if(data.type==='rtc_join')ws.send(JSON.stringify({type:'rtc_peers',self_peer_id:'peer',peers:[]}));if(data.type==='canvas_settings_update'){settingsUpdate=data;revision++;ws.send(JSON.stringify({type:'canvas_settings_result',ok:true,request_id:data.request_id,settings:settings()}));}if(data.type==='canvas_ops'){if((receipts.get(data.client_id)||0)>=data.request_count){ws.send(JSON.stringify({type:'canvas_result',request_id:data.request_id,ok:true,duplicate:true,server_revision:revision}));return;}const touched={};writes++;receipts.set(data.client_id,data.request_count);for(const op of data.operations){
 if(op.action==='delete'){delete latest[op.id];continue;}
 if(op.action==='translate'){for(const id of op.ids){latest[id]={...latest[id],x:latest[id].x+op.dx,y:latest[id].y+op.dy};touched[id]=latest[id];}continue;}
 latest[op.id]={...latest[op.id],...op.patch};for(const field of op.unset||[])delete latest[op.id][field];touched[op.id]=latest[op.id];
 }const deleted=Object.fromEntries(data.operations.filter(o=>o.action==='delete').map(o=>[o.id,null]));revision++;for(const peer of peers)peer.send(JSON.stringify({type:'canvas_commit',client_id:data.client_id,author_id:7,request_count:data.request_count,revision,items:{...touched,...deleted}}));}});});

const page=await context.newPage();page.on('pageerror',error=>{errors.push(error.message);console.error(error.stack || error.message);});await page.goto(origin+'/canvases/999003');await page.waitForFunction(()=>window.frelogCanvas);await page.locator('.canvas-loading-status.is-overlay').waitFor({state:'hidden'});await page.waitForFunction(()=>[...document.querySelectorAll('.vector-layer')].some(node=>node.__agoraRenderStats?.visibleObjects>=0)&&[...document.querySelectorAll('.vector-layer')].every(node=>!node.__agoraRenderStats?.preparing));await page.waitForTimeout(400);
page.on('dialog',dialog=>dialog.accept());
const channelItems=()=>Object.entries(latest).filter(([,v])=>v?.kind==='channel');
const byName=name=>channelItems().find(([,v])=>v.name===name);
const channelButton=(scope,name)=>scope.locator('.channel-select',{has:page.locator('.channel-name',{hasText:new RegExp('^'+name+'$')})});
const until=async(check,label)=>{for(let i=0;i<100;i++){try{if(check())return;}catch{}await page.waitForTimeout(50);}assert.fail('server state: '+label);};
const chat=page.getByRole('navigation',{name:'채팅 채널'});
if(!await chat.isVisible().catch(()=>false)){await page.getByRole('button',{name:'음성 통화'}).first().click();await page.getByRole('tab',{name:'채팅'}).click();}
await chat.waitFor();
// Row actions appear on hover, as for a pointer user.
const rowAction=async(scope,name,label)=>{await scope.locator('.channel-row',{has:page.locator('.channel-name',{hasText:new RegExp('^'+name+'$')})}).hover();await scope.getByRole('button',{name:label+': '+name}).click();};
const submit=async(scope,name)=>{await scope.getByRole('textbox').fill(name);await scope.getByRole('button',{name:'추가',exact:true}).click();};

// 1. Text channel: created on the server with its channel fields, listed, and selected.
await chat.getByRole('button',{name:'채널 추가',exact:true}).click();await chat.getByRole('radio',{name:'채팅 채널'}).click();await submit(chat,'기획');
await channelButton(chat,'기획').waitFor();await until(()=>byName('기획'),'text channel');
assert.deepEqual((({kind,channelType,name,order})=>({kind,channelType,name,order}))(byName('기획')[1]),{kind:'channel',channelType:'text',name:'기획',order:1});
assert.equal(await channelButton(chat,'기획').getAttribute('aria-current'),'true');

// 2. Category, and a channel created inside it.
await chat.getByRole('button',{name:'카테고리 추가'}).click();await submit(chat,'팀');
await chat.getByRole('button',{name:'팀',exact:true}).waitFor();await until(()=>byName('팀'),'category');
const categoryId=byName('팀')[0];assert.equal(byName('팀')[1].channelType,'category');
await chat.locator(`[data-category-id="${categoryId}"] .channel-category-header`).hover();await chat.getByRole('button',{name:'팀 채널 추가'}).click();await submit(chat.locator(`[data-category-id="${categoryId}"]`),'디자인');
await channelButton(chat.locator(`[data-category-id="${categoryId}"]`),'디자인').waitFor();
await until(()=>byName('디자인')[1].categoryId===categoryId,'channel in category');

// 3. Rename and move an uncategorized channel into the category.
await rowAction(chat,'기획','이름 변경');
await chat.getByRole('textbox').fill('기획실');await chat.getByLabel('카테고리 선택').selectOption(categoryId);await chat.getByRole('button',{name:'저장',exact:true}).click();
await channelButton(chat.locator(`[data-category-id="${categoryId}"]`),'기획실').waitFor();
await until(()=>byName('기획실')[1].categoryId===categoryId,'moved channel');

// 4. Chat in a channel targets that channel's thread.
const before=packets.length;await channelButton(chat,'기획실').click();
await page.getByRole('textbox',{name:'채팅 메시지 입력'}).fill('안녕하세요');await page.getByRole('textbox',{name:'채팅 메시지 입력'}).press('Enter');
await page.waitForTimeout(200);
assert.equal(packets.slice(before).find(p=>p.type==='chat')?.object_id,byName('기획실')[0]);

if(process.env.AGORA_E2E_SCREENSHOT)await page.locator('#canvas-communication-panel').screenshot({path:process.env.AGORA_E2E_SCREENSHOT});

// 5. Channels survive a reload (the server stored complete channel items).
await page.reload();await page.waitForFunction(()=>window.frelogCanvas);
if(!await chat.isVisible().catch(()=>false)){await page.getByRole('button',{name:'음성 통화'}).first().click();await page.getByRole('tab',{name:'채팅'}).click();}
await channelButton(chat.locator(`[data-category-id="${categoryId}"]`),'디자인').waitFor();

// 6. Deleting the category keeps its channels as uncategorized; deleting a channel removes it.
await chat.locator(`[data-category-id="${categoryId}"] .channel-category-header`).hover();await chat.getByRole('button',{name:'카테고리 삭제: 팀'}).click();
await page.waitForFunction(()=>!document.querySelector('.channel-list-text [data-category-id]'));
await until(()=>!byName('팀')&&byName('디자인')[1].categoryId===undefined,'category removed, channel uncategorized');
await rowAction(chat,'디자인','채널 삭제');
await channelButton(chat,'디자인').waitFor({state:'detached'});await until(()=>!byName('디자인'),'channel removed');

// 7. Voice channel: created, listed, and selectable.
await page.getByRole('tab',{name:'통화'}).click();const voiceNav=page.getByRole('navigation',{name:'통화 채널'});
await voiceNav.getByRole('button',{name:'채널 추가',exact:true}).click();await voiceNav.getByRole('radio',{name:'음성 채널'}).click();await submit(voiceNav,'회의');
await channelButton(voiceNav,'회의').waitFor();await until(()=>byName('회의')[1].channelType==='voice','voice channel');
await channelButton(voiceNav,'회의').click();
await page.waitForFunction(()=>[...document.querySelectorAll('.channel-list-voice .channel-row.is-active .channel-name')].some(n=>n.textContent==='회의'));

assert.deepEqual(errors,[]);console.log('PASS channels sync: text/category/voice create, rename, move, chat target, reload, delete');
await context.close();}}finally{await browser.close();}
