const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const origin=process.env.AGORA_E2E_ORIGIN||'https://127.0.0.1:5192';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ko-KR',ignoreHTTPSErrors:origin.includes('127.0.0.1')});
const owner={nickname:'Owner',tag_number:1},viewer={nickname:'Viewer',tag_number:1};
const user={...owner,email:'owner@example.invalid',role:'ROLE_USER',status:'ACTIVE'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.fixture';
await context.addInitScript(({user,token})=>{localStorage.setItem('agora_user',JSON.stringify(user));localStorage.setItem('agora_token',token);},{user,token});
let settings={canvas_id:999004,canvas_name:'Groups and bots',description:'',settings_revision:0,visibility:'private',password_protected:false,participants:[owner,viewer],owner,can_manage:true,groups:{'admin-group':[owner],default:[owner,viewer]},initial_group:'default',group_permissions:{'admin-group':{read:true,write:true,execute:true},default:{read:true,write:true,execute:true}}};
let bots=[],rotations=0;const updates=[],errors=[];
await context.route(url=>url.pathname.startsWith('/api/'),async route=>{
 const req=route.request(),path=new URL(req.url()).pathname;let data={canvas_id:999004,canvas_name:'Groups and bots'};
 if(path==='/api/auth/me')data=user;
 else if(path.endsWith('/access'))data={ws_port:'8002',canvas_access_token:'fixture'};
 else if(path.endsWith('/settings'))data=settings;
 else if(path.endsWith('/bots')){
  if(req.method()==='POST'){bots=[{user_id:9,nickname:'[BOT] helper',tag_number:1,canvas_id:999004,active:true}];data={bot:bots[0],token:'agora_bot_9.'+'a'.repeat(43)};}
  else data=bots;
 }else if(path.endsWith('/rotate')){rotations++;data={bot:bots[0],token:'agora_bot_9.'+'b'.repeat(43)};}
 else if(path.endsWith('/bots/9')&&req.method()==='DELETE'){bots[0].active=false;data=null;}
 await route.fulfill({json:data});
});
await context.routeWebSocket(/\/wss\/port\//,ws=>{
 const rtc=ws.url().includes('/rtc/');setTimeout(()=>ws.send(JSON.stringify(rtc?{type:'rtc_ready'}:{type:'init_items',items:{},groups:['admin-group','default'],write_groups:['admin-group','default'],execute_groups:['admin-group','default'],is_admin:true,sync_protocol:2,sync_user_id:1,revision:0,accepted_count:0,rtc_canvas_connection_id:'fixture',rtc_canvas_connection_hash:'proof'})),100);
 ws.onMessage(raw=>{
  const event=JSON.parse(String(raw));
  if(event.type==='rtc_join')ws.send(JSON.stringify({type:'rtc_peers',self_peer_id:'peer',peers:[]}));
  if(event.type==='canvas_settings_get')ws.send(JSON.stringify({type:'canvas_settings_snapshot',request_id:event.request_id,settings}));
  if(event.type!=='canvas_settings_update')return;
  updates.push(event);const v=event.value;
  if(event.field==='group_create'){settings.groups[v.name]=[];settings.group_permissions[v.name]={read:true,write:false,execute:false};}
  if(event.field==='group_members')settings.groups[v.name]=v.members;
  if(event.field==='group_initial')settings.initial_group=v.name;
  if(event.field==='group_rename'){settings.groups[v.new_name]=settings.groups[v.name];settings.group_permissions[v.new_name]=settings.group_permissions[v.name];delete settings.groups[v.name];delete settings.group_permissions[v.name];if(settings.initial_group===v.name)settings.initial_group=v.new_name;}
  if(event.field==='group_delete'){delete settings.groups[v.name];delete settings.group_permissions[v.name];}
  if(event.field==='participant_add'){const p={nickname:event.nickname,tag_number:event.tag_number};settings.participants.push(p);settings.groups[event.group||settings.initial_group].push(p);}
  if(event.field==='participant_remove'){settings.participants=settings.participants.filter(p=>p.nickname!==event.nickname||p.tag_number!==event.tag_number);for(const key of Object.keys(settings.groups))settings.groups[key]=settings.groups[key].filter(p=>p.nickname!==event.nickname||p.tag_number!==event.tag_number);}
  settings.settings_revision++;ws.send(JSON.stringify({type:'canvas_settings_result',request_id:event.request_id,ok:true,settings}));
 });
});
try{
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/canvases/999004');await page.waitForFunction(()=>window.frelogCanvas?.read());await page.getByRole('button',{name:'설정',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('새 그룹 이름',{exact:true}).fill('automation');await dialog.getByRole('button',{name:'그룹 추가',exact:true}).click();await page.waitForFunction(()=>document.querySelector('select[aria-label="관리할 그룹"]')?.value==='automation');
 await dialog.getByText('그룹 참여자와 이름 편집',{exact:true}).click();await dialog.locator('.access-management-members label').filter({hasText:'Viewer#1'}).locator('input').check();await dialog.getByRole('button',{name:'그룹 참여자 저장',exact:true}).click();await page.waitForFunction(()=>document.querySelector('select[aria-label="관리할 그룹"] option:checked')?.textContent.includes('1'));
 await dialog.getByLabel('그룹 이름 변경',{exact:true}).fill('research');await dialog.getByRole('button',{name:'이름 변경',exact:true}).click();await page.waitForFunction(()=>document.querySelector('select[aria-label="관리할 그룹"]')?.value==='research');
 await dialog.getByLabel('초기 참여 그룹',{exact:true}).selectOption('research');await page.waitForTimeout(150);
 await dialog.getByLabel('새 그룹 이름',{exact:true}).fill('discard');await dialog.getByRole('button',{name:'그룹 추가',exact:true}).click();await page.waitForFunction(()=>document.querySelector('select[aria-label="관리할 그룹"]')?.value==='discard');await dialog.getByRole('button',{name:'그룹 삭제',exact:true}).click();await dialog.getByRole('button',{name:'그룹 삭제 확인',exact:true}).click();await page.waitForFunction(()=>!Array.from(document.querySelector('select[aria-label="관리할 그룹"]').options).some(o=>o.value==='discard'));
 await dialog.getByLabel('관리할 그룹',{exact:true}).selectOption('admin-group');assert.ok(await dialog.locator('.access-management-members label').filter({hasText:'Owner#1'}).locator('input').isDisabled());
 await dialog.getByLabel('봇 이름',{exact:true}).fill('helper');await dialog.getByLabel('봇 참여 그룹',{exact:true}).selectOption('research');await dialog.getByRole('button',{name:'봇 생성',exact:true}).click();await dialog.getByRole('region',{name:'새 봇 자격 증명'}).waitFor();assert.equal(await dialog.getByLabel('봇 접속 토큰').inputValue(),'agora_bot_9.'+'a'.repeat(43));assert.equal(updates.find(e=>e.field==='participant_add').group,'research');
 const downloadPromise=page.waitForEvent('download');await dialog.getByRole('button',{name:'자격 증명 저장',exact:true}).click();const downloaded=await downloadPromise;const saved=JSON.parse(await readFile(await downloaded.path(),'utf8'));assert.equal(saved.bot.canvas_id,999004);assert.equal(saved.token,'agora_bot_9.'+'a'.repeat(43));await dialog.getByRole('button',{name:'확인 완료',exact:true}).click();
 await dialog.getByRole('button',{name:'토큰 교체',exact:true}).click();await page.waitForFunction(()=>document.querySelector('input[aria-label="봇 접속 토큰"]')?.value.endsWith('b'.repeat(43)));assert.equal(rotations,1);await dialog.getByRole('button',{name:'확인 완료',exact:true}).click();
 await dialog.getByRole('button',{name:'봇 폐기',exact:true}).click();await dialog.getByRole('button',{name:'봇 폐기 확인',exact:true}).click();await dialog.getByText('폐기된 봇',{exact:true}).waitFor();assert.ok(updates.some(e=>e.field==='participant_remove'));
 await page.setViewportSize({width:390,height:844});assert.ok(await dialog.evaluate(el=>el.getBoundingClientRect().width<=innerWidth));assert.deepEqual(errors,[]);console.log('PASS canvas group create/rename/members/default/delete, bot enrolment/token download/rotation/revocation and mobile dialog');
}finally{await browser.close();}
