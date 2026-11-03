import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost:5191';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const user={email:'roles@example.invalid',nickname:'Roles',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.roles';
const policies={'admin-group':{read:true,write:true,execute:true},default:{read:true,write:false,execute:false}};
const items={box:{kind:'shape',shapeType:'rectangle',x:.2,y:.2,width:.15,height:.12,color:'#6852d6',fill:'#eee9fb',permission:'default'},exec:{kind:'shape',shapeType:'rectangle',runtimeRole:'executor',x:.12,y:.55,width:.22,height:.2,permission:'default'},code:{kind:'code',code:'print(1)',language:'python',filename:'main.py',x:.42,y:.5,width:.2,height:.2,permission:'default'},output:{kind:'shape',shapeType:'rectangle',runtimeRole:'output',x:.72,y:.55,width:.2,height:.2,permission:'default'},e1:{kind:'connector',from:'exec',to:'code',permission:'default'},e2:{kind:'connector',from:'code',to:'output',permission:'default'}};
const peers=new Set(),receipts=new Map();
const errors=[];
try{for(const role of ['admin']){let executions=0,writes=0,settingsUpdate=null,revision=0,latest=structuredClone(items);const admin=role==='admin';const caps={groups:['default'],write_groups:admin?['default']:[],execute_groups:role==='viewer'?[]:['default'],is_admin:admin};
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ko-KR',ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1'});
await context.addInitScript(({token,user})=>{localStorage.setItem('frelog_tool_categories',JSON.stringify({structure:true}));localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token,user});
const settings=()=>({canvas_name:'Role fixture',settings_revision:revision,visibility:'private',participants:[],group_permissions:policies,can_manage:admin});
await context.route(url=>url.pathname.startsWith('/api/'),r=>{const path=new URL(r.request().url()).pathname;let data={canvas_id:999003,canvas_name:'Role fixture'};if(path==='/api/auth/me')data=user;else if(path.endsWith('/access'))data={ws_port:8002,canvas_access_token:'fixture'};else if((path.endsWith('/runtime/execute')||path.endsWith('/runtime/build'))){executions++;data={output:'1\n',exitCode:0};}else if(path.endsWith('/runtime/settings'))data={revision:0,languages:{cpp:{engine:'clang21',standard:'c++17'}},catalog:{cpp:{label:'C++',engines:{clang21:{label:'Clang',mode:'shared'}},fields:{standard:{label:'언어 표준',values:['c++17']}}}}};else if(path.endsWith('/settings'))data=settings();return r.fulfill({json:data});});
await context.routeWebSocket(/\/wss\/port\//,ws=>{const rtc=ws.url().includes('/rtc/');if(!rtc){peers.add(ws);ws.onClose(()=>peers.delete(ws));}const client=new URL(ws.url()).searchParams.get('client_id');setTimeout(()=>ws.send(JSON.stringify(rtc?{type:'rtc_ready'}:{type:'init_items',items:latest,...caps,groups:['default'],sync_protocol:2,sync_user_id:7,revision,accepted_count:0,rtc_canvas_connection_id:'fixture',rtc_canvas_connection_hash:'proof'})),100);ws.onMessage(raw=>{const data=JSON.parse(String(raw));if(data.type==='canvas_sync')ws.send(JSON.stringify({type:'canvas_snapshot',client_id:data.client_id,items:latest,...caps,sync_protocol:2,sync_user_id:7,revision,accepted_count:receipts.get(data.client_id)||0}));if(data.type==='rtc_join')ws.send(JSON.stringify({type:'rtc_peers',self_peer_id:'peer',peers:[]}));if(data.type==='canvas_settings_update'){settingsUpdate=data;revision++;ws.send(JSON.stringify({type:'canvas_settings_result',ok:true,request_id:data.request_id,settings:settings()}));}if(data.type==='canvas_ops'){writes++;receipts.set(data.client_id,data.request_count);for(const op of data.operations){
 if(op.action==='delete'){delete latest[op.id];continue;}
 if(op.action==='translate'){for(const id of op.ids){latest[id]={...latest[id],x:latest[id].x+op.dx,y:latest[id].y+op.dy};}continue;}
 latest[op.id]={...latest[op.id],...op.patch};for(const field of op.unset||[])delete latest[op.id][field];
 }const deleted=Object.fromEntries(data.operations.filter(o=>o.action==='delete').map(o=>[o.id,null]));revision++;for(const peer of peers)peer.send(JSON.stringify({type:'canvas_commit',client_id:data.client_id,author_id:7,request_count:data.request_count,revision,items:{...latest,...deleted}}));}});});
const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});await page.goto(origin+'/canvases/999003');await page.waitForFunction(()=>window.frelogCanvas?.read().items.box);

await page.getByRole('button',{name:'툴 패널',exact:true}).click();
await page.getByRole('button',{name:'객관식·주관식 문제와 수동 채점',exact:true}).click();
await page.mouse.click(720,330);
await page.locator('.question-card').waitFor();
const qid=await page.evaluate(()=>Object.keys(window.frelogCanvas.read().items).find(id=>window.frelogCanvas.read().items[id].kind==='question'));assert.ok(qid);
const card=p=>p.locator('.question-card');
await card(page).getByRole('button',{name:'문제 수정',exact:true}).click();
// A question authored as written-answer has no usable choice options yet.
await card(page).getByLabel('문제 유형',{exact:true}).selectOption('short-answer');
await card(page).getByLabel('문제 내용',{exact:true}).fill('처음부터 주관식인 문제');
await card(page).getByRole('button',{name:'문제 저장',exact:true}).click();
await card(page).getByRole('textbox',{name:'주관식 답안',exact:true}).fill('서술형 답안');
await card(page).getByRole('button',{name:'답안 제출',exact:true}).click();
await card(page).getByRole('button',{name:'직접 채점',exact:true}).click();await card(page).getByLabel('점수',{exact:true}).fill('7');await card(page).getByRole('button',{name:'채점 저장',exact:true}).click();
await card(page).getByRole('button',{name:'문제 수정',exact:true}).click();await card(page).getByLabel('문제 유형',{exact:true}).selectOption('choice');await card(page).getByRole('button',{name:'문제 저장',exact:true}).click();
await card(page).getByText('객관식 보기를 작성한 뒤 답안을 제출할 수 있습니다.',{exact:true}).waitFor();assert.equal(await card(page).getByRole('button',{name:'답안 제출',exact:true}).isDisabled(),true);
await page.waitForFunction(id=>{const q=window.frelogCanvas.read().items[id];return q.questionType==='choice'&&q.questionAnswer===''&&q.questionScore===-1&&q.questionSubmitted===false;},qid);
await card(page).getByRole('button',{name:'문제 수정',exact:true}).click();
await card(page).getByLabel('문제 내용',{exact:true}).fill('2 + 2는 얼마인가요?');
await card(page).getByLabel('보기 1',{exact:true}).fill('3');await card(page).getByLabel('보기 2',{exact:true}).fill('4');
await card(page).getByRole('button',{name:'문제 저장',exact:true}).click();await card(page).getByText('2 + 2는 얼마인가요?',{exact:true}).waitFor();
const observer=await context.newPage();observer.on('pageerror',e=>errors.push(e.message));await observer.goto(origin+'/canvases/999003');await card(observer).getByText('2 + 2는 얼마인가요?',{exact:true}).waitFor();
await card(page).getByRole('radio',{name:'4',exact:true}).check();await card(page).getByRole('button',{name:'답안 제출',exact:true}).click();
await card(observer).getByText('제출 완료 · 채점 대기',{exact:true}).waitFor();assert.equal(await card(observer).getByRole('radio',{name:'4',exact:true}).isChecked(),true);
await card(observer).getByRole('button',{name:'직접 채점',exact:true}).click();await card(observer).getByLabel('점수',{exact:true}).fill('-1');await card(observer).getByRole('button',{name:'채점 저장',exact:true}).click();await card(observer).getByText('점수는 0점부터 배점 사이로 입력하세요.',{exact:true}).waitFor();await card(observer).getByLabel('점수',{exact:true}).fill('8.5');await card(observer).getByLabel('채점 피드백',{exact:true}).fill('풀이 과정을 덧붙여 주세요.');await card(observer).getByRole('button',{name:'채점 저장',exact:true}).click();
await card(page).getByText('8.5 / 10 점',{exact:true}).waitFor();await card(page).getByText('풀이 과정을 덧붙여 주세요.',{exact:true}).waitFor();
await page.screenshot({path:'/tmp/agora-question-choice.png'});await page.waitForTimeout(150);
await card(page).getByRole('button',{name:'문제 수정',exact:true}).click();await page.screenshot({path:'/tmp/agora-question-edit.png'});await card(page).getByLabel('문제 유형',{exact:true}).selectOption('short-answer');await card(page).getByLabel('문제 내용',{exact:true}).fill('이유를 설명하세요.');await card(page).getByRole('button',{name:'문제 저장',exact:true}).click();
await card(observer).getByText('이유를 설명하세요.',{exact:true}).waitFor();assert.equal(await card(observer).getByText('8.5 / 10 점',{exact:true}).count(),0);
await card(page).getByRole('textbox',{name:'주관식 답안',exact:true}).fill('공동으로 작성한 풀이입니다.');await card(page).getByRole('button',{name:'답안 제출',exact:true}).click();
await card(observer).getByText('제출 완료 · 채점 대기',{exact:true}).waitFor();assert.equal(await card(observer).getByRole('textbox',{name:'주관식 답안',exact:true}).inputValue(),'공동으로 작성한 풀이입니다.');
await observer.reload();await card(observer).getByText('제출 완료 · 채점 대기',{exact:true}).waitFor();
await page.screenshot({path:'/tmp/agora-question-subjective.png'});
await card(page).getByRole('button',{name:'문제 수정',exact:true}).click();await card(page).getByLabel('문제 유형',{exact:true}).selectOption('choice');await card(page).getByRole('button',{name:'문제 저장',exact:true}).click();await card(observer).getByRole('radio',{name:'4',exact:true}).waitFor();assert.equal(await card(observer).getByRole('radio',{name:'4',exact:true}).isChecked(),false);
const reader=await context.newPage();await reader.routeWebSocket(/\/wss\/port\//,ws=>{setTimeout(()=>ws.send(JSON.stringify(ws.url().includes('/rtc/')?{type:'rtc_ready'}:{type:'init_items',items:latest,...caps,write_groups:[],is_admin:false,sync_protocol:2,sync_user_id:7,revision,accepted_count:0})),100);});await reader.goto(origin+'/canvases/999003');await card(reader).getByText('이유를 설명하세요.',{exact:true}).waitFor();assert.equal(await card(reader).getByRole('button',{name:'문제 수정',exact:true}).count(),0);assert.equal(await card(reader).getByRole('radio',{name:'4',exact:true}).isDisabled(),true);
assert.deepEqual(errors,[]);assert.ok(writes>4);console.log('PASS question tool creation, choice/subjective editing, shared submission, manual grade+feedback, invalidation, two browsers and reconnect persistence');await context.close();}}finally{await browser.close()}
