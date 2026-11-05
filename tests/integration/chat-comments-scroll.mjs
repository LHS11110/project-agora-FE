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



const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});await page.goto(origin+'/canvases/999003');await page.locator('.canvas-loading-status.is-overlay').waitFor({state:'hidden'});
const toggle=page.getByRole('button',{name:/채팅 패널 (펼치기|접기)/});if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
const chat=page.locator('.canvas-chat-panel .message-list');const bottom=async node=>{await page.waitForFunction(selector=>{const e=document.querySelector(selector);return e&&e.scrollHeight>e.clientHeight&&Math.abs(e.scrollHeight-e.clientHeight-e.scrollTop)<3;},node);};
await bottom('.canvas-chat-panel .message-list');
assert.equal(await chat.locator('[data-message-id]').count(),10,'initially load only ten messages');
assert.equal(packets.find(p=>p.type==='chat_history'&&!p.object_id).limit,10);
const sendChat=sequence=>{for(const peer of peers)peer.send(JSON.stringify({type:'chat',sequence,text:'Newest chat '+sequence,sender:'Other',tag_number:2,created_at:Date.now()}));};
await chat.evaluate(e=>e.scrollTop=e.scrollHeight-e.clientHeight-30);await page.waitForTimeout(100);const held=await chat.evaluate(e=>e.scrollTop);sendChat(161);await page.waitForTimeout(250);
assert.ok(Math.abs(await chat.evaluate(e=>e.scrollTop)-held)<2,'reading older messages is not interrupted');
await chat.evaluate(e=>e.scrollTop=e.scrollHeight-e.clientHeight-2);await page.waitForTimeout(100);sendChat(162);await bottom('.canvas-chat-panel .message-list');
const visible=()=>chat.evaluate(e=>[...e.querySelectorAll('[data-message-id]')].find(n=>n.getBoundingClientRect().bottom>e.getBoundingClientRect().top+1)?.dataset.messageId);
await chat.evaluate(e=>e.scrollTop=e.scrollHeight-e.clientHeight-80);await page.waitForTimeout(100);
await page.getByLabel('채팅 메시지 입력',{exact:true}).fill('My message');await page.getByLabel('채팅 메시지 입력',{exact:true}).press('Enter');await page.waitForFunction(()=>document.querySelector('[data-message-id="general-163"]'));await bottom('.canvas-chat-panel .message-list');
const first=await chat.locator('[data-message-id]').first().getAttribute('data-message-id');
const anchorOffset=await chat.evaluate(e=>{e.scrollTop=0;return e.querySelector('[data-message-id]').getBoundingClientRect().top-e.getBoundingClientRect().top;});await page.waitForFunction(()=>document.querySelectorAll('.canvas-chat-panel [data-message-id]').length===23);await page.waitForTimeout(150);
const restored=await chat.evaluate((e,id)=>[...e.querySelectorAll('[data-message-id]')].find(n=>n.dataset.messageId===id).getBoundingClientRect().top-e.getBoundingClientRect().top,first);assert.ok(Math.abs(restored-anchorOffset)<2,'loading older ten messages preserves the exact reading offset');
const history=packets.filter(p=>p.type==='chat_history'&&!p.object_id);assert.equal(history.length,2);assert.equal(history[1].limit,10);assert.equal(history[1].to_sequence,150);
await chat.evaluate(e=>e.scrollTop=0);await page.waitForFunction(()=>document.querySelectorAll('.canvas-chat-panel [data-message-id]').length===33);
assert.equal(packets.filter(p=>p.type==='chat_history'&&!p.object_id).at(-1).to_sequence,140);
await page.getByRole('button',{name:'이전 메시지',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.canvas-chat-panel [data-message-id]').length===43);assert.equal(packets.filter(p=>p.type==='chat_history'&&!p.object_id).at(-1).to_sequence,130);assert.equal(packets.filter(p=>p.type==='chat_history'&&!p.object_id).at(-1).limit,10);await page.screenshot({path:'/tmp/chat-history-button-mobile.png'});
await toggle.click();await page.waitForTimeout(100);await toggle.click();await bottom('.canvas-chat-panel .message-list');
await toggle.click();await page.waitForTimeout(100);notes=[{mention_id:'note-1',unread:true,sequence:130,text:'Mention target',sender:'Other',tag_number:2,created_at:Date.now()}];for(const peer of peers)peer.send(JSON.stringify({type:'mentions_changed'}));await page.locator('.mention-notification-link').click();await page.waitForTimeout(200);assert.ok(await chat.evaluate(e=>e.scrollHeight-e.clientHeight-e.scrollTop>30),'mention navigation must not be overridden by latest scrolling');
await page.evaluate(()=>{const d=window.frelogCanvas.read();d.items.box.color='#aabbcc';window.frelogCanvas.apply(window.frelogCanvas.plan(d));});const settingsToggle=page.getByRole('button',{name:/설정 패널 (펼치기|접기)/});if(await settingsToggle.getAttribute('aria-expanded')==='false')await settingsToggle.click();await page.getByRole('button',{name:'객체 댓글',exact:true}).click();
await bottom('.object-comments-list');await page.locator('.object-comments-list').evaluate(e=>e.scrollTop=0);await page.waitForTimeout(80);for(const peer of peers)peer.send(JSON.stringify({type:'chat',object_id:'box',sequence:160,text:'Newest comment',sender:'Other',tag_number:2,created_at:Date.now()}));await bottom('.object-comments-list');
await page.getByRole('button',{name:'댓글 닫기',exact:true}).click();
const chatBeforeVoice=await toggle.getAttribute('aria-expanded');
await page.getByRole('button',{name:'음성 통화',exact:true}).click();
const voicePanel=page.getByRole('dialog',{name:'음성 통화',exact:true});await voicePanel.waitFor();
assert.equal(await toggle.getAttribute('aria-expanded'),chatBeforeVoice,'voice panel is independent of chat');
await page.getByRole('button',{name:'통화 참여',exact:true}).click();await page.getByRole('button',{name:'마이크 끄기',exact:true}).click();await page.waitForTimeout(100);assert.ok(packets.some(p=>p.type==='voice_state'&&p.active&&p.muted));
await page.getByRole('button',{name:'소리 끄기',exact:true}).click();
await page.getByRole('button',{name:'음성 통화 패널 닫기',exact:true}).click();assert.equal(await voicePanel.count(),0);
await page.getByRole('button',{name:'통화 중',exact:true}).click();assert.equal(await page.getByRole('button',{name:'마이크 켜기',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await page.getByRole('button',{name:'소리 켜기',exact:true}).getAttribute('aria-pressed'),'true');
for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});await page.waitForTimeout(100);const bounds=await voicePanel.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);await page.screenshot({path:`/tmp/voice-panel-${width}.png`});}
await page.getByRole('button',{name:'음성 통화 패널 닫기',exact:true}).click();
const info=page.getByRole('button',{name:'캔버스 정보 접기',exact:true});if(await info.count())await info.click();
for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});const trigger=await page.getByRole('button',{name:'통화 중',exact:true}).boundingBox();assert.ok(trigger.x>=0&&trigger.x+trigger.width<=width+1,'folded voice launcher remains inside the viewport');}
await page.getByRole('button',{name:'통화 중',exact:true}).click();await voicePanel.waitFor();
await page.getByRole('button',{name:'통화 나가기',exact:true}).click();assert.ok(packets.some(p=>p.type==='voice_state'&&!p.active));
await page.getByRole('button',{name:'음성 통화 패널 닫기',exact:true}).press('Escape');await voicePanel.waitFor({state:'hidden'});

assert.deepEqual(errors,[]);console.log('PASS ten-message pages on initial load and top scroll, conditional latest following and unconditional own-message following, preserved reading position, comments, mentions and voice controls');await context.close();}}finally{await browser.close();}
