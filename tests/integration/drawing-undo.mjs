import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost:5191';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const user={email:'roles@example.invalid',nickname:'Roles',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.roles';
const policies={'admin-group':{read:true,write:true,execute:true},default:{read:true,write:false,execute:false}};
const items={};
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
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/canvases/999003');await page.waitForFunction(()=>window.frelogCanvas?.read());


await page.waitForTimeout(250);
const dock=page.locator('.canvas-quick-dock'),undo=dock.getByRole('button',{name:'실행 취소',exact:true});
const box=await page.locator('.canvas-stage').boundingBox(),x=box.x+650,y=box.y+270;
const strokes=()=>page.evaluate(()=>Object.fromEntries(Object.entries(window.frelogCanvas.read().items).filter(([,item])=>item.kind==='stroke')));
const draw=async(offset=0,slow=true)=>{
 await dock.getByRole('button',{name:'드로잉',exact:true}).click();
 await page.mouse.move(x,y+offset);await page.mouse.down();await page.mouse.move(x+100,y+offset,{steps:8});
 if(slow)await page.waitForTimeout(150);
 await page.mouse.move(x+100,y+offset+70,{steps:8});await page.mouse.move(x+10,y+offset+70,{steps:8});await page.mouse.up();await page.waitForTimeout(140);
};
await draw();
assert.equal(Object.keys(await strokes()).length,1);
assert.match(await undo.getAttribute('title'),/\(1\)$/,'streamed frames and final pointerup belong to one undo step');
await page.keyboard.press('Control+1');await page.mouse.click(x+40,y);
await page.locator('.stroke-selection-path polyline').waitFor();
for(const shortcut of ['Control+4','Control+3','Control+2','Control+1']){
 await page.keyboard.press(shortcut);
 const paint=await page.locator('.stroke-selection-path polyline').evaluate(node=>({fill:getComputedStyle(node).fill,stroke:getComputedStyle(node).stroke}));
 assert.equal(paint.fill,'none','selection hit area never paints an interior in another tool');
 assert.ok(['transparent','rgba(0, 0, 0, 0)'].includes(paint.stroke));
}
await undo.click();await page.waitForTimeout(150);assert.deepEqual(await strokes(),{});assert.deepEqual(latest,{});
for(let i=0;i<3;i++)await draw(i*90,i===0);
assert.equal(Object.keys(await strokes()).length,3);
for(let remaining=2;remaining>=0;remaining--){
 await page.locator('.canvas-stage').focus();await page.keyboard.press('Control+z');await page.waitForTimeout(140);
 assert.equal(Object.keys(await strokes()).length,remaining);assert.equal(Object.keys(latest).length,remaining);
}
assert.ok(await undo.isDisabled());
// One partial eraser gesture restores the original ID/points and removes fragments.
await draw();const original=await strokes(),persisted=structuredClone(latest);
await page.keyboard.press('Control+4');await page.mouse.move(x+50,y-20);await page.mouse.down();await page.mouse.move(x+50,y+25,{steps:8});await page.mouse.up();await page.waitForTimeout(160);
assert.notDeepEqual(await strokes(),original);
await undo.click();await page.waitForTimeout(160);assert.deepEqual(await strokes(),original);assert.deepEqual(latest,persisted);
await undo.click();await page.waitForTimeout(160);assert.deepEqual(await strokes(),{});
// Cancellation still commits one complete stroke and remains a single undo action.
await dock.getByRole('button',{name:'드로잉',exact:true}).click();await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+80,y+25,{steps:8});await page.waitForTimeout(150);
await page.locator('.canvas-stage').dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse',clientX:x+80,clientY:y+25,bubbles:true});await page.mouse.up();await page.waitForTimeout(160);
assert.equal(Object.keys(await strokes()).length,1);await undo.click();await page.waitForTimeout(160);assert.deepEqual(await strokes(),{});
// Undo during an active pointer gesture must not allow later moves to revive it.
await dock.getByRole('button',{name:'드로잉',exact:true}).click();await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+80,y,{steps:8});await page.waitForTimeout(160);
await page.keyboard.press('Control+z');await page.mouse.move(x+110,y+25,{steps:5});await page.mouse.up();await page.waitForTimeout(180);assert.deepEqual(await strokes(),{});assert.deepEqual(latest,{});
await draw();const eraseBaseline=await strokes();await page.keyboard.press('Control+4');await page.mouse.move(x+50,y-20);await page.mouse.down();await page.mouse.move(x+50,y+10,{steps:5});await page.waitForTimeout(160);
await page.keyboard.press('Control+z');await page.mouse.move(x+70,y+30,{steps:4});await page.mouse.up();await page.waitForTimeout(180);assert.deepEqual(await strokes(),eraseBaseline);await undo.click();await page.waitForTimeout(140);assert.deepEqual(await strokes(),{});
assert.deepEqual(errors,[]);console.log('PASS single-step drawing undo, repeated fast/slow drawing, eraser fragment restoration, pointer cancellation and transparent hit SVG across tools; all persisted through broker commits');
await context.close();}}finally{await browser.close()}
