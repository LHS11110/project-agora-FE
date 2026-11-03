const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
import assert from 'node:assert/strict';
const origin=process.env.AGORA_E2E_ORIGIN||'https://frelog.p-e.kr';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const context=await browser.newContext({locale:'ko-KR',ignoreHTTPSErrors:origin.includes('127.0.0.1')});
const owner={nickname:'Owner',tag_number:1}, user={...owner,email:'owner@example.invalid',role:'ROLE_USER',status:'ACTIVE'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.fixture';
await context.addInitScript(({user,token})=>{localStorage.setItem('frelog_locale','ko');localStorage.setItem('agora_user',JSON.stringify(user));localStorage.setItem('agora_token',token);},{user,token});
let settings={canvas_id:999004,canvas_name:'Visibility policy',description:'',settings_revision:0,visibility:'private',password_protected:false,participants:[owner],owner,can_manage:true,groups:{'admin-group':[owner],default:[]},initial_group:'default',group_permissions:{'admin-group':{read:true,write:true,execute:true},default:{read:true,write:true,execute:true}}};
const updates=[],errors=[];let socketCount=0,accessCount=0,page;
await context.route(url=>url.pathname.startsWith('/api/'),async route=>{
 const req=route.request(),path=new URL(req.url()).pathname;
 let data={canvas_id:999004,canvas_name:'Visibility policy'};
 if(path==='/api/auth/me')data=user;
 else if(path==='/api/canvases')data=req.method()==='GET'?[]:data;
 else if(path.endsWith('/access')){accessCount++;data={ws_port:'8002',canvas_access_token:'fixture'};}
 else if(path.endsWith('/settings'))data=settings;
 else if(path.endsWith('/bots'))data=[];
 await route.fulfill({json:data});
});
await context.routeWebSocket(/\/wss\/port\//,ws=>{
 socketCount++;const rtc=ws.url().includes('/rtc/');setTimeout(()=>ws.send(JSON.stringify(rtc?{type:'rtc_ready'}:{type:'init_items',items:{},groups:['admin-group','default'],write_groups:['admin-group','default'],execute_groups:['admin-group','default'],is_admin:true,sync_protocol:2,sync_user_id:1,revision:0,accepted_count:0,rtc_canvas_connection_id:'fixture',rtc_canvas_connection_hash:'proof'})),100);
 ws.onMessage(raw=>{
  const e=JSON.parse(String(raw));
  if(e.type==='rtc_join')ws.send(JSON.stringify({type:'rtc_peers',self_peer_id:'peer',peers:[]}));
  if(e.type==='canvas_settings_get')ws.send(JSON.stringify({type:'canvas_settings_snapshot',request_id:e.request_id,settings}));
  if(e.type!=='canvas_settings_update')return;
  updates.push(e);if(e.field==='visibility'){settings.visibility=e.value;settings.password_protected=false;}
  if(e.field==='password')settings.password_protected=!!e.value;
  settings.settings_revision++;ws.send(JSON.stringify({type:'canvas_settings_result',request_id:e.request_id,ok:true,settings}));ws.send(JSON.stringify({type:'canvas_access_changed',settings,groups:['admin-group','default'],member_groups:['admin-group'],write_groups:['admin-group','default'],execute_groups:['admin-group','default'],is_admin:true,settings_revision:settings.settings_revision}));
 });
});
try{
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/search');await page.locator('.workspace-page-heading button').click();
 let dialog=page.getByRole('dialog');const visibility=dialog.getByLabel('공개 범위',{exact:true});
 assert.equal(await dialog.locator('input[type=password]').count(),0);
 await visibility.selectOption('public');await dialog.locator('input[type=password]').fill('draft-secret');
 await visibility.selectOption('private');assert.equal(await dialog.locator('input[type=password]').count(),0);
 await visibility.selectOption('public');assert.equal(await dialog.locator('input[type=password]').inputValue(),'');
 await page.goto(origin+'/canvases/999004');await page.waitForFunction(()=>window.frelogCanvas?.read());await page.getByRole('button',{name:'설정',exact:true}).click();
 dialog=page.getByRole('dialog');assert.equal(await dialog.locator('input[type=password]').count(),0);
 await dialog.getByLabel('공개 범위',{exact:true}).selectOption('public');await dialog.getByLabel('공개 범위',{exact:true}).locator('..').getByRole('button',{name:'저장',exact:true}).click();
 await dialog.locator('input[type=password]').fill('public-secret');await dialog.getByRole('button',{name:'적용',exact:true}).click();await dialog.getByRole('button',{name:'비밀번호 해제',exact:true}).waitFor();
 await dialog.getByLabel('공개 범위',{exact:true}).selectOption('private');await dialog.getByLabel('공개 범위',{exact:true}).locator('..').getByRole('button',{name:'저장',exact:true}).click();
 await dialog.locator('input[type=password]').waitFor({state:'detached'});
 assert.ok(updates.some(e=>e.field==='password'&&e.value==='public-secret'));
 assert.equal(settings.visibility,'private');assert.equal(settings.password_protected,false);assert.equal(socketCount,2);assert.equal(accessCount,1);assert.deepEqual(errors,[]);
 console.log('PASS private hides password; public exposes password; creation discards hidden password; protected public can switch to private; same canvas/RTC sockets stay open');
}catch(error){console.error({socketCount,accessCount,errors,url:page?.url(),body:(await page?.locator('body').innerText())?.slice(-1800)});throw error;}finally{await browser.close();}
