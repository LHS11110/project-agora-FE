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
const pdfObjects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> /Contents 4 0 R >>','<< /Length 0 >>\nstream\n\nendstream'];let pdf='%PDF-1.4\n',offsets=[0];for(const [index,body] of pdfObjects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${body}\nendobj\n`;}const start=Buffer.byteLength(pdf);pdf+='xref\n0 5\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
const src='/api/canvases/999003/pdfs/11111111-1111-4111-8111-111111111111';let pdfUploads=0;
await context.route('**/api/canvases/999003/pdfs**',r=>{if(r.request().method()==='POST'){pdfUploads++;return r.fulfill({json:{src,thumbnail:''}});}return r.fulfill({contentType:'application/pdf',body:Buffer.from(pdf)});});
await context.route('https://www.youtube-nocookie.com/embed/**',r=>r.fulfill({contentType:'text/html',body:'<body>Video fixture</body>'}));
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/canvases/999003');await page.waitForFunction(()=>window.frelogCanvas?.read());



await page.locator('.canvas-loading-status.is-overlay').waitFor({state:'hidden'});
const snapshot=()=>page.evaluate(()=>window.frelogCanvas.read().items);
const paste=async(content,selector='.canvas-stage')=>page.locator(selector).evaluate((node,content)=>{const data=new DataTransfer();for(const [key,value] of Object.entries(content)){if(key==='files'){for(const f of value){const bytes=f.base64?Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0)):f.text;data.items.add(new File([bytes],f.name,{type:f.type}));}}else data.setData(key,value);}node.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));},content);
const waitCount=async(n)=>page.waitForFunction(n=>Object.keys(window.frelogCanvas.read().items).length===n,n);
await paste({'text/plain':'  한 줄\n두 번째 줄  '});await waitCount(1);assert.equal(Object.values(await snapshot())[0].text,'  한 줄\n두 번째 줄  ');
await paste({'text/plain':'https://youtu.be/dQw4w9WgXcQ\nhttps://example.com'});await waitCount(3);assert.ok(Object.values(await snapshot()).some(x=>x.mediaType==='youtube'));
const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=8;const ctx=canvas.getContext('2d');ctx.fillStyle='#8866ee';ctx.fillRect(0,0,8,8);return canvas.toDataURL().split(',')[1];});
await paste({files:[{name:'clip.png',type:'image/png',base64:png}],'text/plain':'https://example.com/duplicate','text/html':'<img src="https://example.com/duplicate.png">'});await waitCount(4);assert.equal(Object.values(await snapshot()).filter(x=>x.kind==='image').length,1);
await paste({'text/html':'<a href="https://example.com/docs">문서 링크</a>','text/plain':'문서 링크'});await waitCount(5);assert.ok(Object.values(await snapshot()).some(x=>x.kind==='link'&&x.title==='문서 링크'));
await paste({files:[{name:'main.py',type:'text/plain',text:'print("hello")'},{name:'README.md',type:'text/markdown',text:'# Title'}]});await waitCount(7);assert.ok(Object.values(await snapshot()).some(x=>x.language==='python'&&x.renderMode==='code'));
await paste({files:[{name:'document.pdf',type:'application/pdf',base64:Buffer.from(pdf).toString('base64')}]});await waitCount(8);assert.equal(pdfUploads,1);assert.ok(Object.values(await snapshot()).some(x=>x.kind==='pdf'&&x.src===src));
await context.grantPermissions(['clipboard-read','clipboard-write']);
await page.evaluate(()=>navigator.clipboard.writeText('키보드 붙여넣기'));await page.locator('.canvas-stage').focus();await page.keyboard.press('Control+V');await waitCount(9);
await page.evaluate(async png=>{const blob=new Blob([Uint8Array.from(atob(png),c=>c.charCodeAt(0))],{type:'image/png'});await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);},png);
await page.locator('.object-clipboard-controls').getByRole('button',{name:'붙여넣기',exact:true}).click();await waitCount(10);
await page.locator('.object-clipboard-controls').getByRole('button',{name:'복사',exact:true}).click();await page.locator('.object-clipboard-controls').getByRole('button',{name:'붙여넣기',exact:true}).click();await waitCount(11);assert.equal(Object.values(await snapshot()).filter(x=>x.kind==='image').length,3);
await page.evaluate(()=>{const input=document.createElement('textarea');input.id='paste-editor';document.body.append(input);input.focus();});await paste({'text/plain':'editor text'},'#paste-editor');await page.waitForTimeout(200);assert.equal(Object.keys(await snapshot()).length,11);
await page.locator('#paste-editor').evaluate(node=>node.remove());await paste({'text/plain':'가'.repeat(22000)});await page.waitForTimeout(200);assert.equal(Object.keys(await snapshot()).length,11);
await page.screenshot({path:'/tmp/auto-paste-canvas.png'});await context.close();}assert.deepEqual(errors,[]);console.log('PASS pasted text, URLs, YouTube, image deduplication, HTML link, code/Markdown files, PDF upload and editing/size guards');}finally{await browser.close();}
