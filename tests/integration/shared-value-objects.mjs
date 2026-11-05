import {sheetWorkbook} from '../fixtures/sheetWorkbook.mjs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost:5191';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const user={email:'roles@example.invalid',nickname:'Roles',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.roles';
const policies={'admin-group':{read:true,write:true,execute:true},default:{read:true,write:false,execute:false}};
const value=(valueType,x,y)=>({kind:'value',title:'',valueType,valueMin:0,valueMax:valueType==='real'?1:100,valueStep:valueType==='real'?.01:1,valueNumber:0,valueText:'',valueOptions:valueType==='select'?['A','B','C']:['꺼짐','켜짐'],x,y,width:.24,height:.21,permission:'default'});
const items={real:value('real',.05,.08),integer:value('integer',.33,.08),button:value('button',.61,.08),select:value('select',.05,.36),text:value('text',.33,.36),pdf:{kind:'pdf',src:'/api/canvases/999003/pdfs/11111111-1111-4111-8111-111111111111',filename:'two.pdf',x:.65,y:.35,width:.24,height:.3,permission:'default'},video:{kind:'link',url:'https://youtu.be/dQw4w9WgXcQ',mediaType:'youtube',x:.05,y:.65,width:.3,height:.25,permission:'default'},exec:{kind:'shape',shapeType:'rectangle',runtimeRole:'executor',x:.4,y:.68,width:.2,height:.2,permission:'default'},code:{kind:'code',code:'print(1)',language:'python',filename:'main.py',x:.65,y:.7,width:.2,height:.2,permission:'default'},output:{kind:'shape',shapeType:'rectangle',runtimeRole:'output',x:.88,y:.7,width:.1,height:.2,permission:'default'},e1:{kind:'connector',from:'exec',to:'code',permission:'default'},e2:{kind:'connector',from:'code',to:'output',permission:'default'}};

const peers=new Set(),receipts=new Map();
const errors=[];
try{for(const role of ['admin']){let executions=0,writes=0,settingsUpdate=null,revision=0,latest=structuredClone(items);const admin=role==='admin';const caps={groups:['default'],write_groups:admin?['default']:[],execute_groups:role==='viewer'?[]:['default'],is_admin:admin};
const context=await browser.newContext({viewport:{width:2100,height:1450},locale:'ko-KR',ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1'});
await context.addInitScript(({token,user})=>{localStorage.setItem('frelog_tool_categories',JSON.stringify({structure:true}));localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token,user});
const settings=()=>({canvas_name:'Role fixture',settings_revision:revision,visibility:'private',participants:[],group_permissions:policies,can_manage:admin});
await context.route(url=>url.pathname.startsWith('/api/'),r=>{const path=new URL(r.request().url()).pathname.replace(/\/runtime\/execute\/stream$/, '/runtime/execute');let data={canvas_id:999003,canvas_name:'Role fixture'};if(path==='/api/auth/me')data=user;else if(path.endsWith('/access'))data={ws_port:8002,canvas_access_token:'fixture'};else if((path.endsWith('/runtime/execute')||path.endsWith('/runtime/build'))){executions++;data={output:'1\n',exitCode:0};}else if(path.endsWith('/runtime/settings'))data={revision:0,languages:{cpp:{engine:'clang21',standard:'c++17'}},catalog:{cpp:{label:'C++',engines:{clang21:{label:'Clang',mode:'shared'}},fields:{standard:{label:'언어 표준',values:['c++17']}}}}};else if(path.endsWith('/settings'))data=settings();return r.fulfill(new URL(r.request().url()).pathname.endsWith('/runtime/execute/stream')?{contentType:'application/x-ndjson',body:JSON.stringify({type:'result',result:data})+'\n'}:{json:data});});
await context.routeWebSocket(/\/wss\/port\//,ws=>{const rtc=ws.url().includes('/rtc/');if(!rtc){peers.add(ws);ws.onClose(()=>peers.delete(ws));}const client=new URL(ws.url()).searchParams.get('client_id');setTimeout(()=>ws.send(JSON.stringify(rtc?{type:'rtc_ready'}:{type:'init_items',items:latest,...caps,groups:['default'],sync_protocol:2,sync_user_id:7,revision,accepted_count:0,rtc_canvas_connection_id:'fixture',rtc_canvas_connection_hash:'proof'})),100);ws.onMessage(raw=>{const data=JSON.parse(String(raw));if(data.type==='canvas_sync')ws.send(JSON.stringify({type:'canvas_snapshot',client_id:data.client_id,items:latest,...caps,sync_protocol:2,sync_user_id:7,revision,accepted_count:receipts.get(data.client_id)||0}));if(data.type==='rtc_join')ws.send(JSON.stringify({type:'rtc_peers',self_peer_id:'peer',peers:[]}));if(data.type==='canvas_settings_update'){settingsUpdate=data;revision++;ws.send(JSON.stringify({type:'canvas_settings_result',ok:true,request_id:data.request_id,settings:settings()}));}if(data.type==='canvas_ops'){writes++;receipts.set(data.client_id,data.request_count);for(const op of data.operations){
 if(op.action==='delete'){delete latest[op.id];continue;}
 if(op.action==='translate'){for(const id of op.ids){latest[id]={...latest[id],x:latest[id].x+op.dx,y:latest[id].y+op.dy};}continue;}
 latest[op.id]={...latest[op.id],...op.patch};for(const field of op.unset||[])delete latest[op.id][field];
 }const deleted=Object.fromEntries(data.operations.filter(o=>o.action==='delete').map(o=>[o.id,null]));revision++;for(const peer of peers)peer.send(JSON.stringify({type:'canvas_commit',client_id:data.client_id,author_id:7,request_count:data.request_count,revision,items:{...latest,...deleted}}));}});});
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> /Contents 5 0 R >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> /Contents 5 0 R >>','<< /Length 0 >>\nstream\n\nendstream'];let pdf='%PDF-1.4\n',offsets=[];for(const [i,body] of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${body}\nendobj\n`;}const start=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
await context.route('**/api/canvases/999003/pdfs/**',r=>r.fulfill({contentType:'application/pdf',body:Buffer.from(pdf)}));
await context.route('**/runtime/execute/stream',async r=>{executions++;await new Promise(resolve=>setTimeout(resolve,900));return r.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'result',result:{output:'1\n',exitCode:0}})+'\n'});});
await context.route('https://www.youtube-nocookie.com/embed/**',r=>r.fulfill({contentType:'text/html',body:`<body>Video fixture<script>window.mockMedia={time:0,state:2};function report(){parent.postMessage(JSON.stringify({event:'infoDelivery',info:{currentTime:mockMedia.time,playerState:mockMedia.state,duration:120}}),'*')}addEventListener('message',e=>{let d;try{d=JSON.parse(e.data)}catch{return}if(d.event==='command'){if(d.func==='seekTo')mockMedia.time=d.args[0];if(d.func==='playVideo')mockMedia.state=1;if(d.func==='pauseVideo')mockMedia.state=2;}report()});setInterval(report,200);</script>`}));
const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});await page.goto(origin+'/canvases/999003');await page.waitForFunction(()=>window.frelogCanvas?.read().items.real);


await page.locator('.canvas-loading-status.is-overlay').waitFor({state:'hidden'});const observer=await context.newPage();observer.on('pageerror',e=>errors.push(e.message));await observer.goto(origin+'/canvases/999003');await observer.waitForFunction(()=>window.frelogCanvas?.read().items.real);
const card=(p,id)=>p.locator(`[data-item-id="${id}"] .canvas-value-object`);
await card(page,'real').getByLabel('실수 슬라이더').evaluate(node=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,'0.37');node.dispatchEvent(new Event('input',{bubbles:true}));});await observer.waitForFunction(()=>window.frelogCanvas.read().items.real.valueNumber===.37);
await card(page,'integer').getByLabel('정수 값',{exact:true}).fill('12');await observer.waitForFunction(()=>window.frelogCanvas.read().items.integer.valueNumber===12);
await card(page,'button').getByRole('button',{name:'버튼 값',exact:true}).click();await observer.waitForFunction(()=>window.frelogCanvas.read().items.button.valueNumber===1);
await card(page,'select').getByLabel('선택 값',{exact:true}).selectOption('2');await observer.waitForFunction(()=>window.frelogCanvas.read().items.select.valueNumber===2);
await card(page,'text').getByLabel('입력 값',{exact:true}).fill('shared input');await observer.waitForFunction(()=>window.frelogCanvas.read().items.text?.valueText==='shared input');
await card(page,'real').getByRole('button',{name:'값 객체 설정'}).click();await card(page,'real').getByLabel('최댓값',{exact:true}).fill('0.2');await card(page,'real').getByRole('button',{name:'설정 저장'}).click();await observer.waitForFunction(()=>window.frelogCanvas.read().items.real.valueMax===.2&&window.frelogCanvas.read().items.real.valueNumber===.2);
await page.locator('[data-item-id="pdf"]').click({position:{x:20,y:10}});await page.getByRole('button',{name:'PDF 다음 페이지'}).click();await observer.waitForFunction(()=>window.frelogCanvas.read().items.pdf.pdfPage===2);await observer.getByLabel('PDF 2페이지').waitFor();
await page.getByRole('button',{name:'공유 재생',exact:true}).click();await observer.waitForFunction(()=>window.frelogCanvas.read().items.video.mediaState?.paused===false);
await page.getByLabel('공유 재생 위치').evaluate(node=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,'42');node.dispatchEvent(new Event('input',{bubbles:true}));});await observer.waitForFunction(()=>window.frelogCanvas.read().items.video.mediaState?.time===42);await page.getByRole('button',{name:'공유 일시정지',exact:true}).click();await observer.waitForFunction(()=>window.frelogCanvas.read().items.video.mediaState?.paused===true);
// A native iframe seek is still shared after its immediate event was suppressed.
const frame=page.frames().find(f=>f.url().includes('youtube-nocookie.com/embed/'));
await page.locator('[data-item-id="video"] iframe').evaluate(n=>n.focus());
await frame.evaluate(()=>{mockMedia.time=67;report();});
await observer.waitForFunction(()=>window.frelogCanvas.read().items.video.mediaState?.time===67);
// Check the receiver's player, not just its saved object.
const remoteFrame=observer.frames().find(f=>f.url().includes('youtube-nocookie.com/embed/'));
await remoteFrame.waitForFunction(()=>mockMedia.time===67&&mockMedia.state===2);
await page.getByRole('button',{name:'공유 재생',exact:true}).click();
await remoteFrame.waitForFunction(()=>mockMedia.state===1);
await remoteFrame.evaluate(()=>{mockMedia.time=5;report();});
await remoteFrame.waitForFunction(()=>mockMedia.time>60);
await page.getByRole('button',{name:'공유 일시정지',exact:true}).click();
await observer.waitForFunction(()=>window.frelogCanvas.read().items.video.mediaState?.paused===true);
await page.locator('.canvas-stage').click({position:{x:700,y:600}});await page.locator('[data-item-id="exec"]').getByRole('button',{name:'코드 실행',exact:true}).click();await observer.waitForFunction(()=>window.frelogCanvas.read().items.code.runtimeState?.status==='running');await observer.waitForFunction(()=>window.frelogCanvas.read().items.code.runtimeState?.status==='success');assert.equal(executions,1);
await observer.reload();await observer.waitForFunction(()=>window.frelogCanvas?.read().items.text?.valueText==='shared input'&&window.frelogCanvas.read().items.pdf.pdfPage===2&&window.frelogCanvas.read().items.video.mediaState.paused===true&&window.frelogCanvas.read().items.code.runtimeState.status==='success');
// Import real CSV/XLSX through the toolbar's file input and dedicated parser worker.
const input=page.locator('input[type="file"][accept*=".xlsx"]');
await input.setInputFiles({name:'records.csv',mimeType:'text/csv',buffer:Buffer.from('이름,코드\n민수,0012\n')});
await observer.waitForFunction(()=>Object.values(window.frelogCanvas?.read().items||{}).some(i=>i.kind==='table'&&i.filename?.startsWith('records.csv')&&i.rows[0][1]==='0012'));
await input.setInputFiles({name:'workbook.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:sheetWorkbook()});
await observer.waitForFunction(()=>Object.values(window.frelogCanvas?.read().items||{}).filter(i=>i.kind==='table'&&i.filename?.startsWith('workbook.xlsx')).length===2);
await observer.waitForFunction(()=>Object.values(window.frelogCanvas?.read().items||{}).some(i=>i.filename?.includes('매출')&&i.rows?.[0]?.[1]==='42'));
// A failed optional PDF thumbnail must still upload and insert the original.
let pdfUpload=null;await context.route('**/api/canvases/999003/pdfs',async route=>{pdfUpload=route.request().postDataBuffer().toString();await route.fulfill({json:{src:'/api/canvases/999003/pdfs/11111111-1111-4111-8111-111111111111',thumbnail:''}});});
await page.evaluate(()=>{const original=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback,...args){HTMLCanvasElement.prototype.toBlob=original;callback(null);};});
await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({name:'document.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)});
await observer.waitForFunction(()=>Object.values(window.frelogCanvas?.read().items||{}).some(i=>i.kind==='pdf'&&i.filename==='document.pdf'));
assert.match(pdfUpload,/name="file"/);assert.doesNotMatch(pdfUpload,/name="thumbnail"/);
await observer.reload();await observer.waitForFunction(()=>Object.values(window.frelogCanvas?.read().items||{}).filter(i=>i.kind==='table'&&i.filename?.startsWith('workbook.xlsx')).length===2);
console.log('PASS CSV, multi-sheet XLSX and PDF thumbnail-failure uploads persist and broadcast');
await page.screenshot({path:'/tmp/shared-value-objects.png'});assert.deepEqual(errors,[]);await context.close();}console.log('PASS two browsers share real/discrete values, range settings, PDF page, YouTube playback, execution state and reconnect persistence');}finally{await browser.close();}
