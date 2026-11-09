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
let remote=null,puts=[],conflict=false;
const currentSha='a'.repeat(40),oldSha='b'.repeat(40);let older=null;
await context.route('https://api.github.com/**',async route=>{
 const req=route.request(),url=new URL(req.url());
 assert.equal(req.headers().authorization,'Bearer browser-test-token');
 const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'authorization,content-type,x-github-api-version','access-control-allow-methods':'GET,PUT,OPTIONS'};
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 let data={default_branch:'main',size:0},status=200;
 if(url.pathname.includes('/branches/')){data=remote?{name:'main'}:{message:'branch not found'};status=remote?200:404;}
 if(url.pathname.endsWith('/branches'))data=remote?[{name:'main'}]:[];
 if(url.pathname.includes('/commits'))data=remote?[{sha:currentSha,commit:{message:'Canvas snapshot',author:{name:'Tester',date:'2026-11-09T00:00:00Z'}}},{sha:oldSha,commit:{message:'Older canvas',author:{name:'Tester',date:'2026-11-08T00:00:00Z'}}}]:[];
 if(url.pathname.includes('/contents/')){
  if(req.method()==='PUT'){
   const body=req.postDataJSON();puts.push(body);
   if(conflict){status=409;data={message:'conflict'};}
   else{remote=Buffer.from(body.content,'base64').toString('utf8');older=JSON.parse(remote);older.items.real.valueNumber=.74;older=JSON.stringify(older);data={content:{sha:currentSha},commit:{sha:currentSha}};}
  }else if(!remote){status=404;data={message:'not found'};}
  else data={type:'file',sha:currentSha,size:Buffer.byteLength(remote),encoding:'base64',content:Buffer.from(url.searchParams.get('ref')===oldSha?older:remote).toString('base64')};
 }
 await route.fulfill({status,headers,json:data});
});
await context.route('https://www.youtube.com/embed/**',r=>r.fulfill({contentType:'text/html',body:'<script>setInterval(()=>parent.postMessage(JSON.stringify({event:"onStateChange",info:1}),"*"),200)</script>'}));
await page.getByRole('button',{name:'유튜브 플레이어 열기',exact:true}).click();await page.getByLabel('유튜브 링크',{exact:true}).fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');await page.locator('.youtube-panel').getByRole('button',{name:'열기',exact:true}).click();await page.locator('.youtube-panel iframe').waitFor({state:'attached'});await page.evaluate(()=>window.versionMusicFrame=document.querySelector('.youtube-panel iframe'));await page.getByRole('button',{name:'플레이어 접기',exact:true}).click();
await page.getByRole('button',{name:'변경 이력',exact:true}).click();
await page.getByRole('tab',{name:'저장소 연결',exact:true}).click();
const panel=page.getByRole('region',{name:'GitHub 버전 관리'});assert.equal(await page.locator('.canvas-as-code-editor').count(),0,'version management has no code editor');
await panel.getByRole('button',{name:'저장소 연결 · 새로고침'}).click();await panel.getByRole('alert').waitFor();assert.equal(await panel.getByRole('alert').isVisible(),true);
await panel.getByLabel('저장소 이름 또는 URL',{exact:true}).fill('https://github.com/example/canvas-backup.git');await panel.getByLabel('GitHub 토큰',{exact:true}).fill('browser-test-token');
assert.equal(await panel.getByLabel('GitHub 소유자',{exact:true}).inputValue(),'example');

await panel.getByRole('button',{name:'저장소 연결 · 새로고침'}).click();
await panel.getByText('빈 저장소에 연결했습니다. 현재 캔버스를 커밋하면 첫 파일과 기본 브랜치가 생성됩니다.',{exact:true}).waitFor();await panel.getByRole('button',{name:'현재 캔버스 검토',exact:true}).click();
assert.equal(puts.length,0);
await panel.getByRole('button',{name:'검토한 캔버스를 GitHub에 커밋'}).click();
await panel.getByText('캔버스를 GitHub에 커밋했습니다.',{exact:true}).waitFor();assert.equal(puts.length,1);assert.equal(JSON.parse(remote).mode,'replace');assert.equal(puts[0].sha,undefined);assert.equal(puts[0].branch,undefined);assert.equal(await page.getByRole('dialog',{name:'변경 이력 관리',exact:true}).count(),1);
assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('browser-test-token')),false);
await panel.getByRole('button',{name:'이 커밋으로 캔버스 복구',exact:true}).last().waitFor();
const target=panel.getByRole('button',{name:'이 커밋으로 캔버스 복구',exact:true}).first();await target.scrollIntoViewIfNeeded();
assert.equal(await target.evaluate(node=>{const r=node.getBoundingClientRect(),music=document.querySelector('.youtube-launcher');Object.assign(music.style,{left:r.left+'px',top:r.top+'px',right:'auto',bottom:'auto'});return node.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));}),true,'music must not cover restore controls');
assert.equal(await page.evaluate(()=>window.versionMusicFrame===document.querySelector('.youtube-panel iframe')&&window.versionMusicFrame.isConnected),true,'music iframe remains mounted');
assert.equal(await page.locator('.youtube-launcher').evaluate(node=>getComputedStyle(node).visibility),'hidden','music chrome cannot obscure modal content');
await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'/tmp/version-history-desktop.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/version-history-mobile.png'});await page.setViewportSize({width:2100,height:1450});

await panel.getByRole('button',{name:'현재 캔버스 검토',exact:true}).click();await panel.getByRole('button',{name:'검토한 캔버스를 GitHub에 커밋'}).click();await panel.getByText('저장소와 같은 내용입니다. 새 커밋을 만들지 않았습니다.',{exact:true}).waitFor();assert.equal(puts.length,1);
await panel.getByRole('button',{name:'코드로 검토',exact:true}).nth(1).click();
const codeDialog=page.getByRole('dialog',{name:'캔버스를 코드로 관리',exact:true});await codeDialog.waitFor();assert.equal(await page.locator('.canvas-version-dialog').count(),0);assert.equal(await codeDialog.getByRole('button',{name:'GitHub 버전 관리',exact:true}).count(),0);
await codeDialog.getByRole('button',{name:'변경 검토 · Ctrl/⌘+S',exact:true}).click();const apply=codeDialog.getByRole('button',{name:'검토한 변경 적용',exact:true});assert.equal(await apply.isEnabled(),true);
assert.equal(await apply.evaluate(node=>{const r=node.getBoundingClientRect(),music=document.querySelector('.youtube-launcher');Object.assign(music.style,{left:r.left+'px',top:r.top+'px'});return node.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));}),true,'music cannot cover the code apply button');
await codeDialog.getByRole('button',{name:'캔버스 코드 닫기'}).click();await page.getByRole('button',{name:'변경 이력',exact:true}).click();await page.getByRole('tab',{name:'저장소 연결',exact:true}).click();assert.equal(await panel.getByLabel('GitHub 토큰',{exact:true}).inputValue(),'');await panel.getByLabel('GitHub 토큰',{exact:true}).fill('browser-test-token');await panel.getByRole('button',{name:'저장소 연결 · 새로고침'}).click();await panel.getByText('저장소를 연결했습니다. 현재 캔버스를 검토한 뒤 커밋하세요.',{exact:true}).waitFor();
await panel.getByRole('button',{name:'이 커밋으로 캔버스 복구',exact:true}).nth(1).click();
await panel.getByText('커밋 내용으로 캔버스를 복구하고 서버 저장을 확인했습니다.',{exact:true}).waitFor();
await observer.waitForFunction(()=>window.frelogCanvas.read().items.real.valueNumber===.74);
conflict=true;await panel.getByRole('button',{name:'현재 캔버스 검토',exact:true}).click();await panel.getByRole('button',{name:'검토한 캔버스를 GitHub에 커밋'}).click();
await panel.getByRole('alert').waitFor();assert.equal(puts.length,2);assert.equal(puts[1].sha,currentSha);assert.equal(await panel.getByRole('button',{name:'GitHub 저장소 연결',exact:true}).count(),1);
await page.screenshot({path:'/tmp/canvas-github-desktop.png'});
await page.getByRole('button',{name:'변경 이력 닫기'}).click();await page.getByRole('button',{name:'변경 이력',exact:true}).click();await page.getByRole('tab',{name:'저장소 연결',exact:true}).click();assert.equal(await page.getByLabel('GitHub 토큰',{exact:true}).inputValue(),'');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/canvas-github-mobile.png'});await page.getByRole('button',{name:'변경 이력 닫기'}).click();await page.getByRole('button',{name:'변경 이력',exact:true}).click();await page.getByRole('dialog',{name:'변경 이력 관리',exact:true}).waitFor();assert.deepEqual(errors,[]);
await context.close();}console.log('PASS dedicated version dialog/tabs, repository and history workflows, code-only review, restore and SHA conflict, mobile entry, unobstructed actions and retained music iframe');}finally{await browser.close();}
