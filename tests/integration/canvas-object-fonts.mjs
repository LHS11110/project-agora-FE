import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost:5191';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const user={email:'roles@example.invalid',nickname:'Roles',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.roles';
const policies={'admin-group':{read:true,write:true,execute:true},default:{read:true,write:false,execute:false}};
const items={box:{kind:'shape',shapeType:'rectangle',x:.2,y:.2,width:.15,height:.12,color:'#6852d6',fill:'#eee9fb',permission:'default'},exec:{kind:'shape',shapeType:'rectangle',runtimeRole:'executor',x:.12,y:.55,width:.22,height:.2,permission:'default'},code:{kind:'code',code:'print(1)',language:'python',filename:'main.py',x:.42,y:.5,width:.2,height:.2,permission:'default'},output:{kind:'shape',shapeType:'rectangle',runtimeRole:'output',x:.72,y:.55,width:.2,height:.2,permission:'default'},e1:{kind:'connector',from:'exec',to:'code',permission:'default'},e2:{kind:'connector',from:'code',to:'output',permission:'default'}};
items.exec={...items.exec,x:.04,y:.02,width:.15,height:.15};items.code={...items.code,x:.42,y:.02};items.output={...items.output,x:.72,y:.02};items.e1={...items.e1,label:'connection label',labelMode:'plain'};
const examples={
 question:{kind:'question',questionType:'choice',questionPrompt:'Question text',questionOptions:['A','B'],questionAnswer:'',questionSubmitted:false,questionMaxScore:10,questionScore:-1,questionFeedback:'',questionVersion:'font-v1',questionGradedVersion:''},
 chart:{kind:'chart',chartType:'bar',title:'Chart title',columns:['Name','Value'],rows:[['A','10'],['B','20']]},
 group:{kind:'user-group',groupTitle:'Group title',members:[]},
 image:{kind:'image',filename:'image.png',src:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect width="40" height="40" fill="blue"/%3E%3C/svg%3E'},
 pdf:{kind:'pdf',filename:'document.pdf',src:'/api/canvases/999003/pdfs/00000000-0000-0000-0000-000000000001'},
 link:{kind:'link',url:'https://example.com',title:'Link title',mediaType:'link'},
 plain:{kind:'text',text:'Plain text',renderMode:'plain'},
 note:{kind:'note',text:'Note text'},
 table:{kind:'table',columns:['Column'],rows:[['Cell']]},
 math:{kind:'math',formula:'x+1'},
 stroke:{kind:'stroke',points:[{x:.1,y:.9},{x:.2,y:.9}],complete:true,strokeWidth:2}
};
Object.entries(examples).forEach(([id,item],i)=>{items[id]={...item,x:.06+(i%3)*.27,y:.25+Math.floor(i/3)*.18,width:.23,height:.16,permission:'default'};});
const peers=new Set(),receipts=new Map();
const errors=[];
try{for(const role of ['admin']){let executions=0,writes=0,settingsUpdate=null,revision=0,latest=structuredClone(items);const admin=role==='admin';const caps={groups:['default'],write_groups:admin?['default']:[],execute_groups:role==='viewer'?[]:['default'],is_admin:admin};
const context=await browser.newContext({viewport:{width:1920,height:1400},locale:'ko-KR',ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1'});
await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token,user});
const settings=()=>({canvas_name:'Role fixture',settings_revision:revision,visibility:'private',participants:[],group_permissions:policies,can_manage:admin});
await context.route(url=>url.pathname.startsWith('/api/'),r=>{const path=new URL(r.request().url()).pathname.replace(/\/runtime\/execute\/stream$/, '/runtime/execute');let data={canvas_id:999003,canvas_name:'Role fixture'};if(path==='/api/auth/me')data=user;else if(path.endsWith('/access'))data={ws_port:8002,canvas_access_token:'fixture'};else if((path.endsWith('/runtime/execute')||path.endsWith('/runtime/build'))){executions++;data={output:'1\n',exitCode:0};}else if(path.endsWith('/runtime/settings'))data={revision:0,languages:{cpp:{engine:'clang21',standard:'c++17'}},catalog:{cpp:{label:'C++',engines:{clang21:{label:'Clang',mode:'shared'}},fields:{standard:{label:'언어 표준',values:['c++17']}}}}};else if(path.endsWith('/settings'))data=settings();return r.fulfill(new URL(r.request().url()).pathname.endsWith('/runtime/execute/stream')?{contentType:'application/x-ndjson',body:JSON.stringify({type:'result',result:data})+'\n'}:{json:data});});
await context.routeWebSocket(/\/wss\/port\//,ws=>{const rtc=ws.url().includes('/rtc/');if(!rtc){peers.add(ws);ws.onClose(()=>peers.delete(ws));}const client=new URL(ws.url()).searchParams.get('client_id');setTimeout(()=>ws.send(JSON.stringify(rtc?{type:'rtc_ready'}:{type:'init_items',items:latest,...caps,groups:['default'],sync_protocol:2,sync_user_id:7,revision,accepted_count:0,rtc_canvas_connection_id:'fixture',rtc_canvas_connection_hash:'proof'})),100);ws.onMessage(raw=>{const data=JSON.parse(String(raw));if(data.type==='canvas_sync')ws.send(JSON.stringify({type:'canvas_snapshot',client_id:data.client_id,items:latest,...caps,sync_protocol:2,sync_user_id:7,revision,accepted_count:receipts.get(data.client_id)||0}));if(data.type==='rtc_join')ws.send(JSON.stringify({type:'rtc_peers',self_peer_id:'peer',peers:[]}));if(data.type==='canvas_settings_update'){settingsUpdate=data;revision++;ws.send(JSON.stringify({type:'canvas_settings_result',ok:true,request_id:data.request_id,settings:settings()}));}if(data.type==='canvas_ops'){writes++;receipts.set(data.client_id,data.request_count);for(const op of data.operations){
 if(op.action==='delete'){delete latest[op.id];continue;}
 if(op.action==='translate'){for(const id of op.ids){latest[id]={...latest[id],x:latest[id].x+op.dx,y:latest[id].y+op.dy};}continue;}
 latest[op.id]={...latest[op.id],...op.patch};for(const field of op.unset||[])delete latest[op.id][field];
 }const deleted=Object.fromEntries(data.operations.filter(o=>o.action==='delete').map(o=>[o.id,null]));revision++;for(const peer of peers)peer.send(JSON.stringify({type:'canvas_commit',client_id:data.client_id,author_id:7,request_count:data.request_count,revision,items:{...latest,...deleted}}));}});});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/canvases/999003');await page.waitForFunction(()=>window.frelogCanvas?.read().items.box);

const cases=[['box',12,null],['exec',12,'.blueprint-node header strong'],['code',13,'.syntax-code-preview'],['output',12,'.blueprint-node header strong'],['e1',12,'.connector-name-label'],['question',12,'.question-prompt'],['chart',9,'.chart-svg text'],['group',12,'.user-group-content h3'],['image',8,'.object-caption'],['pdf',12,'.pdf-document-heading strong'],['link',8,'.shared-link-copy strong'],['plain',13,'.unified-plain-preview'],['note',10,'.sticky-note-content'],['table',9,'td'],['math',16,null],['stroke',13,null]];
async function effectiveFont(id,selector){return page.locator(`.canvas-object[data-item-id="${id}"]`).locator(selector).first().evaluate(el=>{let size=parseFloat(getComputedStyle(el).fontSize);for(let node=el;node;node=node.parentElement){const transform=getComputedStyle(node).transform;if(transform!=='none'){const m=new DOMMatrixReadOnly(transform);size*=Math.hypot(m.a,m.b);}}return size;});}
for(const [id,base,selector] of cases){
 await page.evaluate(({id,base})=>{const api=window.frelogCanvas;api.apply(api.plan({version:1,items:{[id]:{fontSize:base}}}));},{id,base});
 const input=page.getByRole('spinbutton',{name:'글자 크기',exact:true});await input.waitFor();await page.waitForFunction(base=>document.querySelector('input[aria-label="글자 크기"]')?.value===String(base),base);
 let before;if(selector)before=await effectiveFont(id,selector);
 const geometry=await page.evaluate(id=>{const q=window.frelogCanvas.read().items[id];return [q.x,q.y,q.width,q.height];},id);
 await input.fill(String(base*2));await input.press('Enter');
 await page.waitForFunction(({id,size})=>window.frelogCanvas.read().items[id].fontSize===size,{id,size:base*2});
 if(selector){const after=await effectiveFont(id,selector);assert.ok(Math.abs(after/before-2)<.02,`${id}: font must double (${before} -> ${after})`);}
 assert.deepEqual(await page.evaluate(id=>{const q=window.frelogCanvas.read().items[id];return [q.x,q.y,q.width,q.height];},id),geometry,id+' geometry is preserved');
 console.log('PASS font control',id);
}
const observer=await context.newPage();observer.on('pageerror',error=>errors.push(error.message));await observer.goto(origin+'/canvases/999003');
await observer.waitForFunction(cases=>cases.every(([id,base])=>window.frelogCanvas?.read().items[id]?.fontSize===base*2),cases);
await page.locator('.canvas-object[data-item-id="question"] .question-card header').click();
const input=page.getByRole('spinbutton',{name:'글자 크기',exact:true});await input.fill('36');await input.press('Enter');
await observer.waitForFunction(()=>window.frelogCanvas?.read().items.question?.fontSize===36);
assert.equal(await observer.locator('.question-prompt').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),36);
await observer.reload();await observer.waitForFunction(()=>window.frelogCanvas?.read().items.question?.fontSize===36);
assert.deepEqual(errors,[]);await page.screenshot({path:'/tmp/agora-object-fonts.png'});console.log('PASS all object font controls, visible typography and independent geometry');await context.close();}}finally{await browser.close()}
