import assert from 'node:assert/strict';
import {defaultAnimation} from '../../src/canvas/portfolio/portfolioModel.js';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost:5193';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const user={email:'projects@example.invalid',nickname:'Projects',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.projects';
const anim=effect=>({...defaultAnimation(),effect,duration:250,loop:false});
let latest={
 f1:{kind:'frame',title:'First frame',text:'Priority-based story',frameOrder:0,rotation:0,fill:'#ffffff',x:0,y:0,width:.6,height:.5,permission:'writers',depth:-1000},
 f2:{kind:'frame',title:'Second frame',text:'Finale',frameOrder:1,rotation:0,fill:'#ffffff',x:1,y:0,width:.6,height:.5,permission:'writers',depth:-1000},
 board:{kind:'shape',shapeType:'rectangle',fill:'#76b1af',color:'#385759',x:.05,y:.05,width:.15,height:.12,animation:anim('fade'),frameId:'f1',animationPriority:0,permission:'writers'},
 peer:{kind:'shape',shapeType:'ellipse',fill:'#b0a2d4',x:.25,y:.05,width:.15,height:.12,animation:anim('zoom'),frameId:'f1',animationPriority:0,permission:'writers'},
 note:{kind:'note',text:'Second priority',x:.1,y:.25,width:.25,height:.15,animation:anim('slide-up'),frameId:'f1',animationPriority:1,permission:'writers'},
 final:{kind:'note',text:'Final frame',x:1.1,y:.1,width:.25,height:.15,animation:anim('fade'),frameId:'f2',animationPriority:0,permission:'writers'},
 route:{kind:'connector',from:'f1',to:'f2',frameLinkPriority:0,permission:'writers'},
 'portfolio-settings':{kind:'portfolio',title:'Frame portfolio',portfolioDescription:'',portfolioPages:[],permission:'writers',x:0,y:0,width:.01,height:.01}
},revision=0;
const peers=new Set(),receipts=new Map(),errors=[];
const settings={canvas_name:'Project fixture',settings_revision:0,visibility:'private',participants:[{nickname:'Projects',tag_number:1}],group_permissions:{writers:{read:true,write:true,execute:false}}};
async function open(role){
 const admin=role==='admin',writer=role!=='viewer',uid=admin?7:writer?8:9;
 const caps={groups:['writers'],write_groups:writer?['writers']:[],execute_groups:[],is_admin:admin};
 const context=await browser.newContext({viewport:{width:2100,height:1450},locale:'ko-KR',ignoreHTTPSErrors:true});
 await context.addInitScript(({token,user})=>{localStorage.setItem('frelog_tool_categories',JSON.stringify({structure:true}));localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token,user});
 await context.route(url=>url.pathname.startsWith('/api/'),r=>{const path=new URL(r.request().url()).pathname;let data={canvas_id:999011,canvas_name:'Project fixture'};if(path==='/api/auth/me')data=user;else if(path.endsWith('/access'))data={ws_port:8002,canvas_access_token:'fixture'};else if(path.endsWith('/settings'))data={...settings,can_manage:admin};return r.fulfill({json:data});});
 await context.routeWebSocket(/\/wss\/port\//,ws=>{const rtc=ws.url().includes('/rtc/');if(!rtc){peers.add(ws);ws.onClose(()=>peers.delete(ws));}setTimeout(()=>ws.send(JSON.stringify(rtc?{type:'rtc_ready'}:{type:'init_items',items:latest,...caps,sync_protocol:2,sync_user_id:uid,revision,accepted_count:0})),100);
 ws.onMessage(raw=>{const d=JSON.parse(String(raw));if(d.type==='rtc_join')ws.send(JSON.stringify({type:'rtc_peers',self_peer_id:'peer'+uid,peers:[]}));if(d.type==='canvas_sync')ws.send(JSON.stringify({type:'canvas_snapshot',items:latest,...caps,client_id:d.client_id,sync_protocol:2,sync_user_id:uid,revision,accepted_count:receipts.get(d.client_id)||0}));if(d.type==='canvas_ops'){
 const changed={};for(const op of d.operations){if(op.action==='delete'){delete latest[op.id];changed[op.id]=null;}else if(op.action==='translate'){for(const id of op.ids){latest[id]={...latest[id],x:latest[id].x+op.dx,y:latest[id].y+op.dy};changed[id]=latest[id];}}else {latest[op.id]={...latest[op.id],...op.patch};if(op.patch?.animationPlayback)latest[op.id].animationPlayback={...op.patch.animationPlayback,startedAt:Date.now()+300};if(op.patch?.portfolioCursor)latest[op.id].portfolioCursor={...op.patch.portfolioCursor,startedAt:Date.now()+300};for(const key of op.unset||[])delete latest[op.id][key];changed[op.id]=latest[op.id];}}
 revision++;receipts.set(d.client_id,d.request_count);const commit={type:'canvas_commit',client_id:d.client_id,author_id:uid,request_count:d.request_count,revision,items:structuredClone(changed)};setTimeout(()=>{for(const peer of peers)peer.send(JSON.stringify(commit));},d.operations.some(op=>op.patch?.animationPlayback?.action==='play')?180:0);}});});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.error('browser:',m.text());});page.on('requestfailed',r=>console.error('failed:',r.url(),r.failure()?.errorText));await page.goto(origin+'/canvases/999011');await page.waitForFunction(()=>window.frelogCanvas?.read().items.board);await page.locator('.portfolio-controls').waitFor();console.log('opened',role);return {page,context,controls:page.locator('.portfolio-controls')};
}
const wait=async fn=>{for(let n=0;n<100;n++){if(fn())return;await new Promise(r=>setTimeout(r,50));}assert.ok(fn(),'stored state did not converge');};
const active=client=>client.page.locator('[data-item-id=board]').evaluate(el=>el.getAnimations().filter(a=>a.id.startsWith('portfolio:')).map(a=>({id:a.id,time:a.currentTime,state:a.playState})));
async function enter(client){await client.controls.getByRole('button',{name:'프레임 발표 시작',exact:true}).click();await client.page.locator('.portfolio-view[data-frame-view=true]').waitFor();}
async function pressSpace(client){await client.page.locator('.canvas-stage').focus();await client.page.keyboard.press('Space');}
const count=async(client,id)=>client.page.locator(`[data-item-id=${id}]`).evaluate(el=>el.getAnimations().filter(a=>a.id.startsWith('portfolio:')).map(a=>a.id));
try{
 const admin=await open('admin'),viewer=await open('viewer');
 for(const name of ['프레임 만들기','포트폴리오 만들기','선택 객체로 장면 추가'])assert.equal(await admin.controls.getByRole('button',{name,exact:true}).count(),0);assert.equal(await admin.controls.getByLabel('장면 제목',{exact:true}).count(),0);
 await admin.page.evaluate(()=>{window.copiedViewingLink='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copiedViewingLink=value;}}});});assert.ok(await admin.controls.getByRole('button',{name:'보기 링크 복사',exact:true}).isDisabled(),'viewing links require a selected frame');
 await enter(admin);await wait(()=>latest['portfolio-settings'].portfolioCursor?.startedAt>0);await enter(viewer);
 await admin.page.waitForFunction(()=>document.querySelector('[data-item-id=board]')?.classList.contains('presentation-entrance-pending'));
 assert.equal(await admin.page.locator('[data-item-id=final]').count(),0);assert.equal(await admin.page.locator('[data-item-id=f1]').count(),0,'frame border is excluded from presentation');
 const clip=await admin.page.locator('.canvas-scene').evaluate(el=>getComputedStyle(el).clipPath);assert.notEqual(clip,'none');
 // First Space starts both priority-zero objects after the committed broadcast.
 await pressSpace(admin);await new Promise(r=>setTimeout(r,60));assert.equal((await count(admin,'board')).length,0);assert.equal(await admin.page.locator('[data-item-id=board]').evaluate(el=>el.classList.contains('presentation-entrance-pending')),true);
 await wait(()=>latest['portfolio-settings'].portfolioCursor.step===1);await admin.page.waitForFunction(()=>document.querySelector('[data-item-id=board]').getAnimations().some(a=>a.id.startsWith('portfolio:')));await viewer.page.waitForFunction(()=>document.querySelector('[data-item-id=peer]').getAnimations().some(a=>a.id.startsWith('portfolio:')));
 assert.equal(latest.board.animationPlayback.runId,latest.peer.animationPlayback.runId);assert.equal(latest.note.animationPlayback,undefined);assert.ok(await viewer.page.locator('[data-item-id=note]').evaluate(el=>el.classList.contains('presentation-entrance-pending')));
 // Repeated presses while a group is running cannot skip the next priority.
 await pressSpace(admin);assert.equal(latest['portfolio-settings'].portfolioCursor.step,1);await new Promise(r=>setTimeout(r,650));
 await pressSpace(admin);await wait(()=>latest['portfolio-settings'].portfolioCursor.step===2);assert.ok(latest.note.animationPlayback);await new Promise(r=>setTimeout(r,650));
 await pressSpace(admin);await wait(()=>latest['portfolio-settings'].portfolioCursor.frameId==='f2');await viewer.page.locator('[data-item-id=final]').waitFor();assert.equal(await viewer.page.locator('[data-item-id=board]').count(),0);assert.equal(latest['portfolio-settings'].portfolioCursor.step,0);
 await pressSpace(admin);await wait(()=>latest['portfolio-settings'].portfolioCursor.step===1);await new Promise(r=>setTimeout(r,650));assert.equal(latest.final.animationPlayback.config.loop,false);
 await admin.page.screenshot({path:'/tmp/agora-frame-presentation.png'});await admin.page.keyboard.press('Escape');await admin.page.locator('.portfolio-view').waitFor({state:'hidden'});
 // Assignment and priority controls operate on each object, independently of geometry.
 await admin.page.locator('[data-item-id=board]').click({position:{x:10,y:10}});await admin.controls.getByLabel('애니메이션 우선순위',{exact:true}).fill('4');await wait(()=>latest.board.animationPriority===4);await admin.controls.getByLabel('할당 프레임',{exact:true}).selectOption('f2');await wait(()=>latest.board.frameId==='f2');assert.equal(latest.board.x,.05,'assignment does not silently move content');
 await admin.controls.getByRole('button',{name:'선택 객체를 담는 프레임 만들기',exact:true}).click();await wait(()=>Object.values(latest).filter(item=>item.kind==='frame').length===3);const created=latest.board.frameId;assert.notEqual(created,'f2');const beforeFrame={...latest[created]},beforeObject={...latest.board};const caption=admin.page.locator(`[data-item-id="${created}"] .portfolio-frame-caption`);await caption.click();const box=await caption.boundingBox();await admin.page.mouse.move(box.x+box.width/2,box.y+box.height/2);await admin.page.mouse.down();await admin.page.mouse.move(box.x+box.width/2+45,box.y+box.height/2+30,{steps:4});await admin.page.mouse.up();await wait(()=>latest[created].x!==beforeFrame.x);assert.ok(Math.abs((latest.board.x-beforeObject.x)-(latest[created].x-beforeFrame.x))<.00001);assert.ok(Math.abs((latest.board.y-beforeObject.y)-(latest[created].y-beforeFrame.y))<.00001);
 assert.deepEqual(errors,[]);console.log('PASS: full-frame clipping, per-object assignment/priority, equal-priority broadcast, sequential Space steps, busy guard, linked-frame navigation and follower synchronization');
}catch(error){for(const [i,c] of browser.contexts().entries())for(const p of c.pages())await p.screenshot({path:`/tmp/frame-failure-${i}.png`}).catch(()=>{});console.error(errors);throw error;}finally{await browser.close();}
