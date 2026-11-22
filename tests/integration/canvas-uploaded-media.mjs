import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const gif=readFileSync(new URL('../fixtures/animated-media.gif',import.meta.url));
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost:5192';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const user={email:'projects@example.invalid',nickname:'Projects',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.projects';
const gifUrl='/api/canvases/999011/media/11111111-1111-4111-8111-111111111111.gif',videoUrl='/api/canvases/999011/media/22222222-2222-4222-8222-222222222222.webm';
const state={paused:true,time:0,updatedAt:Date.now(),actor:'initial'};
let latest={board:{kind:'link',mediaType:'gif',url:gifUrl,title:'Animation.gif',mediaState:state,mediaLoop:false,permission:'writers',x:.05,y:.05,width:.3,height:.3},video:{kind:'link',mediaType:'video',url:videoUrl,title:'Movie.webm',mediaState:state,mediaLoop:false,permission:'writers',x:.4,y:.05,width:.3,height:.3},image:{kind:'image',src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1sAAAAASUVORK5CYII=',filename:'photo.png',imageFrameEnabled:true,x:.75,y:.4,width:.1,height:.1,permission:'writers'},youtube:{kind:'link',mediaType:'youtube',url:'https://youtu.be/dQw4w9WgXcQ',title:'YouTube',mediaState:state,mediaLoop:false,permission:'writers',x:.05,y:.4,width:.3,height:.3}},revision=0;
const peers=new Set(),receipts=new Map(),errors=[];
let uploads=0,videoBytes,largeImageChunks=0,releaseFirstImageChunk;
let holdImagePreview=true;
const deferredImageReads=[];
const pngUrl='/api/canvases/999011/media/33333333-3333-4333-8333-333333333333.png';
const png=Buffer.alloc(2*1024*1024+64);
Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1sAAAAASUVORK5CYII=','base64').copy(png);
const pdfUrl='/api/canvases/999011/pdfs/44444444-4444-4444-8444-444444444444';
const pdfObjects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> /Contents 4 0 R >>','<< /Length 0 >>\nstream\n\nendstream'];let pdf='%PDF-1.4\n',offsets=[0];for(const [index,body] of pdfObjects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${body}\nendobj\n`;}const start=Buffer.byteLength(pdf);pdf+='xref\n0 5\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
const settings={canvas_name:'Project fixture',settings_revision:0,visibility:'private',participants:[{nickname:'Projects',tag_number:1}],group_permissions:{writers:{read:true,write:true,execute:false}}};
async function open(role){
 const admin=role==='admin',writer=role!=='viewer',uid=admin?7:writer?8:9;
 const caps={groups:['writers'],write_groups:writer?['writers']:[],execute_groups:[],is_admin:admin};
 const context=await browser.newContext({viewport:{width:2100,height:1450},locale:'ko-KR',ignoreHTTPSErrors:true});
 await context.addInitScript(({token,user})=>{localStorage.setItem('frelog_tool_categories',JSON.stringify({structure:true}));localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token,user});
 await context.route(url=>url.pathname.startsWith('/api/'),r=>{const path=new URL(r.request().url()).pathname;let data={canvas_id:999011,canvas_name:'Project fixture'};if(path.includes('/media')){if(r.request().method()==='POST'){uploads++;assert.ok(r.request().postDataBuffer().includes(Buffer.from('GIF89a')));return r.fulfill({status:201,json:{url:gifUrl,mediaType:'gif'}});}return r.fulfill({contentType:path.endsWith('.gif')?'image/gif':'video/webm',body:path.endsWith('.gif')?gif:videoBytes});}if(path==='/api/auth/me')data=user;else if(path==='/api/auth/session/refresh')data={accessToken:token,user};else if(path.endsWith('/access'))data={ws_port:8002,canvas_access_token:'fixture'};else if(path.endsWith('/settings'))data={...settings,can_manage:admin};return r.fulfill({json:data});});
 await context.routeWebSocket(/\/wss\/port\//,ws=>{const rtc=ws.url().includes('/rtc/');if(!rtc){peers.add(ws);ws.onClose(()=>peers.delete(ws));}setTimeout(()=>ws.send(JSON.stringify(rtc?{type:'rtc_ready'}:{type:'init_items',items:latest,...caps,sync_protocol:2,sync_user_id:uid,revision,accepted_count:0})),100);
 const pendingUploads=new Map();
 ws.onMessage(raw=>{const d=JSON.parse(String(raw));if(d.type==='rtc_join')ws.send(JSON.stringify({type:'rtc_peers',self_peer_id:'peer'+uid,peers:[]}));if(d.type==='runtime_execute'&&d.action==='service'){const s=d.service||{};let result={};if(s.operation==='resource'){const bytes=s.path.endsWith('.png')?png:s.path.endsWith('.gif')?gif:(videoBytes||Buffer.alloc(0)),offset=Number(s.offset)||0,chunk=bytes.subarray(offset,offset+65536);result={offset,size:bytes.length,type:s.path.endsWith('.png')?'image/png':s.path.endsWith('.gif')?'image/gif':'video/webm',version:'v1',data:chunk.toString('base64')};}else if(s.operation==='upload_begin'){const uploadId='u'+Math.random().toString(36).slice(2);pendingUploads.set(uploadId,[]);result={uploadId,chunkSize:65536};}else if(s.operation==='upload_chunk'){pendingUploads.get(s.uploadId)?.push(Buffer.from(s.data||'','base64'));result={ok:true};}else if(s.operation==='upload_finish'){const parts=pendingUploads.get(s.uploadId)||[],body=Buffer.concat(parts);pendingUploads.delete(s.uploadId);if(body.subarray(0,8).equals(png.subarray(0,8))){assert.deepEqual(body,png);largeImageChunks=parts.length;result={url:pngUrl,mediaType:'image'};}else if(s.path==='/pdfs'){assert.equal(body.subarray(0,5).toString(),'%PDF-');result={src:pdfUrl,thumbnail:''};}else{uploads++;assert.ok(body.includes(Buffer.from('GIF89a')));result={url:gifUrl,mediaType:'gif'};}}const sendResult=()=>ws.send(JSON.stringify({type:'runtime_result',request_id:d.request_id,ok:true,result}));
 if(s.operation==='upload_chunk'&&s.offset===0&&Buffer.from(s.data,'base64').subarray(0,8).equals(png.subarray(0,8)))releaseFirstImageChunk=sendResult;
 else if(s.operation==='resource'&&s.path.endsWith('.png')&&holdImagePreview)deferredImageReads.push(sendResult);
 else sendResult();
 return;}if(d.type==='canvas_sync')ws.send(JSON.stringify({type:'canvas_snapshot',items:latest,...caps,client_id:d.client_id,sync_protocol:2,sync_user_id:uid,revision,accepted_count:receipts.get(d.client_id)||0}));if(d.type==='canvas_ops'){
 const changed={};for(const op of d.operations){if(op.action==='delete'){delete latest[op.id];changed[op.id]=null;}else {latest[op.id]={...latest[op.id],...op.patch};for(const key of op.unset||[])delete latest[op.id][key];changed[op.id]=latest[op.id];}}
 revision++;receipts.set(d.client_id,d.request_count);for(const peer of peers)peer.send(JSON.stringify({type:'canvas_commit',client_id:d.client_id,author_id:uid,request_count:d.request_count,revision,items:changed}));}});});
 await context.route('https://www.youtube-nocookie.com/embed/**',r=>r.fulfill({contentType:'text/html',body:`<body><script>window.mock={loop:false,time:0,state:2};addEventListener('message',e=>{let d;try{d=JSON.parse(e.data)}catch{return}if(d.func==='setLoop')mock.loop=d.args[0];if(d.func==='seekTo')mock.time=d.args[0];if(d.func==='playVideo')mock.state=1;if(d.func==='pauseVideo')mock.state=2;});setInterval(()=>parent.postMessage(JSON.stringify({event:'infoDelivery',info:{currentTime:mock.time,playerState:mock.state,duration:30}}),'*'),100);</script>`}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/canvases/999011');await page.waitForFunction(()=>window.frelogCanvas?.read().items.board);await page.locator('.uploaded-media canvas').waitFor();console.log('opened',role);return {page,context,gif:page.locator('[data-item-id=board] .uploaded-media'),video:page.locator('[data-item-id=video] .uploaded-media')};
}
const wait=async fn=>{for(let n=0;n<100;n++){if(fn())return;await new Promise(r=>setTimeout(r,50));}assert.ok(fn(),'stored state did not converge');};
try{
 const recorder=await browser.newPage();videoBytes=Buffer.from(await recorder.evaluate(()=>new Promise(resolve=>{const c=document.createElement('canvas');c.width=32;c.height=32;const ctx=c.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,32,32);const stream=c.captureStream(10),r=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];r.ondataavailable=e=>chunks.push(e.data);r.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());resolve([...new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer())]);};r.start();setTimeout(()=>{ctx.fillStyle='blue';ctx.fillRect(0,0,32,32);},300);setTimeout(()=>r.stop(),1200);})));await recorder.close();
 const admin=await open('admin'),observer=await open('viewer');
 await admin.page.locator('.canvas-stage').evaluate(stage=>{
  stage.focus();
  const bytes=new Uint8Array(2*1024*1024+64);
  bytes.set(Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1sAAAAASUVORK5CYII='),char=>char.charCodeAt(0)));
  const data=new DataTransfer();
  data.items.add(new File([bytes],'large.png',{type:'image/png'}));
  stage.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
 });
 const uploadStatus=admin.page.locator('.canvas-file-upload-status');
 await uploadStatus.getByText('파일을 업로드하는 중…',{exact:true}).waitFor();
 await wait(()=>Boolean(releaseFirstImageChunk));
 assert.equal(Object.values(latest).some(item=>item.filename==='large.png'),false);
 releaseFirstImageChunk();
 await wait(()=>Object.values(latest).some(item=>item.kind==='image'&&item.src===pngUrl&&item.filename==='large.png'));
 await uploadStatus.waitFor({state:'detached'});
 await admin.page.getByText('캔버스에 자료 1개를 추가했습니다.',{exact:true}).waitFor();
 const imageId=Object.keys(latest).find(id=>latest[id].filename==='large.png');
 const uploadedImage=admin.page.locator(`[data-item-id="${imageId}"]`);
 await uploadedImage.getByText('이미지를 불러오는 중…',{exact:true}).waitFor();
 holdImagePreview=false;
 deferredImageReads.splice(0).forEach(send=>send());
 await uploadedImage.getByRole('img',{name:'large.png'}).waitFor();
 assert.ok(largeImageChunks>1);
 if(process.argv.includes('--upload-only')){
  let releasePdfPreview;
  await admin.context.route(`**${pdfUrl}`,route=>new Promise(resolve=>{
   releasePdfPreview=()=>resolve(route.fulfill({contentType:'application/pdf',body:pdf}));
  }));
  await admin.page.locator('.canvas-stage').evaluate((stage,text)=>{
   stage.focus();
   const data=new DataTransfer();
   data.items.add(new File([text,new Uint8Array(17*1024*1024)],'large.pdf',{type:'application/pdf'}));
   stage.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
  },pdf);
  await uploadStatus.getByText('large.pdf',{exact:true}).waitFor();
  await wait(()=>Object.values(latest).some(item=>item.kind==='pdf'&&item.src===pdfUrl));
  await uploadStatus.waitFor({state:'detached'});
  await admin.page.getByText('캔버스에 자료 1개를 추가했습니다.',{exact:true}).waitFor();
  const pdfId=Object.keys(latest).find(id=>latest[id].filename==='large.pdf');
  const uploadedPdf=admin.page.locator(`[data-item-id="${pdfId}"]`);
  const loadingPdf=uploadedPdf.getByText('PDF를 불러오는 중…',{exact:true});
  await loadingPdf.waitFor();
  await wait(()=>Boolean(releasePdfPreview));
  releasePdfPreview();
  await loadingPdf.waitFor({state:'detached'});
  await uploadedPdf.getByText('1 / 1',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log(`PASS: upload, insertion, and preview feedback for a ${largeImageChunks}-chunk image and a large PDF`);
 }else{
 await admin.context.route('**/clipboard-original.gif',r=>r.fulfill({contentType:'image/gif',body:gif}));
 await admin.gif.click({position:{x:8,y:8}});await admin.gif.locator('.uploaded-media-center').hover();await admin.page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-item-id=board] .uploaded-media-toggle')).opacity==='1');const placement=await admin.gif.evaluate(el=>{const root=el.getBoundingClientRect(),center=el.querySelector('.uploaded-media-toggle').getBoundingClientRect(),loop=el.querySelector('.uploaded-media-loop').getBoundingClientRect();return {dx:Math.abs(root.left+root.width/2-center.left-center.width/2),dy:Math.abs(root.top+root.height/2-center.top-center.height/2),corner:root.right-loop.right};});assert.ok(placement.dx<2&&placement.dy<2&&Math.abs(placement.corner-10)<2);assert.equal(await admin.page.locator('[data-item-id=image] .object-caption').count(),0);assert.equal(await admin.page.locator('[data-item-id=image] .image-object-surface').evaluate(el=>getComputedStyle(el).borderTopWidth),'0px');assert.equal(latest.board.mediaState.paused,true);assert.equal(await admin.page.locator('[data-item-id=board] .shared-media-header').count(),0);
 const color=client=>client.gif.locator('canvas').evaluate(c=>[...c.getContext('2d').getImageData(0,0,1,1).data]);
 await admin.page.waitForFunction(()=>document.querySelector('[data-item-id=board] canvas')?.width===16);
 assert.deepEqual((await color(admin)).slice(0,3),[255,0,0]);
 assert.equal(await observer.gif.getByRole('button',{name:'공유 재생',exact:true}).isDisabled(),true);
 // Loop and playback are broadcast, and pausing freezes the composited frame.
 await admin.gif.getByRole('button',{name:'반복 재생',exact:true}).click();await wait(()=>latest.board.mediaLoop===true);
 await admin.gif.locator('.uploaded-media-center').hover();await admin.gif.getByRole('button',{name:'공유 재생',exact:true}).click();await wait(()=>latest.board.mediaState.paused===false);await new Promise(r=>setTimeout(r,650));
 await admin.gif.locator('.uploaded-media-center').hover();await admin.gif.getByRole('button',{name:'공유 일시정지',exact:true}).click();await wait(()=>latest.board.mediaState.paused===true);await new Promise(r=>setTimeout(r,150));const paused=await color(admin);await new Promise(r=>setTimeout(r,500));assert.deepEqual(await color(admin),paused);assert.deepEqual(await color(observer),paused);
 // Single playback stops on its last frame rather than restarting forever.
 await admin.gif.getByRole('button',{name:'반복 재생',exact:true}).click();await admin.gif.locator('.uploaded-media-center').hover();await admin.gif.getByRole('button',{name:'공유 재생',exact:true}).click();await wait(()=>latest.board.mediaState.paused===false);await wait(()=>latest.board.mediaState.paused===true);assert.deepEqual((await color(admin)).slice(0,3),[0,0,255]);
 await admin.video.click({position:{x:8,y:8}});await admin.video.locator('.uploaded-media-center').hover();assert.equal(latest.video.mediaState.paused,true);
 // Uploaded video starts paused, can play, pause and loop, and keeps local volume personal.
 await admin.video.locator('.uploaded-media-center').hover();await admin.video.getByRole('button',{name:'공유 재생',exact:true}).click();await wait(()=>latest.video.mediaState.paused===false);await new Promise(r=>setTimeout(r,200));await admin.video.locator('.uploaded-media-center').hover();await admin.video.getByRole('button',{name:'공유 일시정지',exact:true}).click();await wait(()=>latest.video.mediaState.paused===true);assert.ok(await admin.video.locator('video').evaluate(v=>v.paused));await admin.video.getByRole('button',{name:'반복 재생',exact:true}).click();await wait(()=>latest.video.mediaLoop===true);await admin.video.locator('.uploaded-media-center').hover();await admin.video.getByRole('button',{name:'공유 재생',exact:true}).click();await wait(()=>latest.video.mediaState.paused===false);await new Promise(r=>setTimeout(r,1500));assert.equal(latest.video.mediaState.paused,false);assert.equal(await admin.video.locator('video').evaluate(v=>v.loop),true);
 const youtube=admin.page.locator('[data-item-id=youtube]');assert.equal(await youtube.locator('iframe').count(),0);assert.equal(await youtube.locator('.youtube-static-preview').count(),1);assert.equal(await youtube.locator('.shared-media-activate').count(),0);await youtube.click({position:{x:8,y:8}});await youtube.hover();assert.equal(await youtube.locator('.shared-media-activate').count(),0);assert.equal(await youtube.getByRole('button',{name:'공유 재생',exact:true}).count(),0);assert.equal(await youtube.getByRole('button',{name:'공유 일시정지',exact:true}).count(),0);assert.equal(await youtube.getByRole('button',{name:'반복 재생',exact:true}).count(),0);assert.equal(latest.youtube.mediaLoop,false);await youtube.getByRole('button',{name:'YouTube 재생',exact:true}).click();await youtube.locator('iframe').waitFor();assert.ok((await youtube.locator('iframe').getAttribute('src')).includes('playsinline=1&rel=0'));
 // File paste goes to multipart upload, retaining GIF bytes rather than a PNG or data-URL snapshot.
 await admin.page.locator('.canvas-stage').evaluate((stage,bytes)=>{stage.focus();const data=new DataTransfer();data.items.add(new File([new Uint8Array(bytes)],'pasted.gif',{type:'image/gif'}));stage.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));},[...gif]);await wait(()=>uploads===1);await wait(()=>Object.values(latest).filter(i=>i.mediaType==='gif').length===2);assert.equal(Object.values(latest).find(i=>i.filename==='pasted.gif').mediaState.paused,true);
 await admin.page.locator('.canvas-stage').evaluate(stage=>{stage.focus();const data=new DataTransfer();data.items.add(new File(['png-preview'],'image.png',{type:'image/png'}));data.setData('text/html',`<img src="${location.origin}/clipboard-original.gif">`);stage.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});await wait(()=>Object.values(latest).filter(i=>i.mediaType==='gif').length===3);assert.equal(uploads,1);await admin.page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{read:async()=>[{types:['image/png','text/html'],getType:async type=>type==='text/html'?new Blob([`<img src="${location.origin}/clipboard-original.gif">`],{type}):new Blob(['png-preview'],{type})}]}});});await admin.page.getByRole('button',{name:'붙여넣기',exact:true}).click();await wait(()=>Object.values(latest).filter(i=>i.mediaType==='gif').length===4);assert.equal(uploads,1);
 assert.deepEqual(errors,[]);await admin.page.screenshot({path:'/tmp/agora-uploaded-media.png'});console.log('PASS: GIF frame decoding, freeze/resume, shared playback, video playback, repeat, and original GIF clipboard upload');
 }
}catch(error){for(const [i,context] of browser.contexts().entries())for(const p of context.pages())await p.screenshot({path:`/tmp/media-failure-${i}.png`}).catch(()=>{});console.error(errors);throw error;}finally{await browser.close();}
