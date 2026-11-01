// Responsive page and editor chrome regression; HTTP/WebSocket data are isolated fixtures.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost:5191';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.visual';
const user={email:'design@example.invalid',nickname:'디자인 워크스페이스',tag_number:42,role:'ROLE_USER',status:'ACTIVE',created_at:'2026-10-20T10:00:00'};
try{for(const mobile of [false,true]){const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1',locale:'ko-KR'});
await context.addInitScript(({token,user})=>{sessionStorage.setItem('frelog.home-intro.v1','seen');window.__fixture={token,user};},{token,user});
await context.route(url=>url.pathname.startsWith('/api/'),r=>{const p=new URL(r.request().url()).pathname;let data={};if(p==='/api/auth/providers')data={google:true,naver:true,kakao:true};else if(p==='/api/auth/me')data=user;else if(p==='/api/auth/mfa')data={available:true,enabled:false};else if(p==='/api/auth/passkeys')data=[];else if(p==='/api/auth/passkeys/status')data={available:true};else if(p==='/api/auth/email/status')data={available:true};else if(p.endsWith('/settings'))data={password_protected:false,participants:[{nickname:user.nickname,tag_number:42}],admin_nickname:user.nickname,admin_tag_number:42};else if(p.endsWith('/access'))data={ws_port:8002,canvas_access_token:'fixture'};else if(p==='/api/canvases')data=Array.from({length:6},(_,i)=>({canvas_id:999001+i,canvas_name:['브랜드 디자인 시스템','새로운 서비스의 첫 아이디어','팀 프로젝트 · Sprint 04','우리가 만드는 워크스페이스','Research & Development','다음 주를 위한 계획'][i],description:['컴포넌트와 컬러, 팀의 디자인 원칙','아이디어를 모으고 다음 단계를 함께 정해요.','실행 가능한 아이디어를 만드는 공간'][i%3],user_count:i+1,visibility:i%2?'private':'public'}));else if(p.startsWith('/api/canvases/'))data={canvas_id:999001,canvas_name:'브랜드 디자인 시스템',description:'팀과 함께 만드는 공간',user_count:1};return r.fulfill({json:data});});
await context.routeWebSocket(/\/wss\/port\//,ws=>{const rtc=ws.url().includes('/rtc/');setTimeout(()=>ws.send(JSON.stringify(rtc?{type:'rtc_ready'}:{type:'init_items',items:{},groups:['default'],canvas_name:'브랜드 디자인 시스템',sync_protocol:2,revision:0,accepted_count:0,rtc_canvas_connection_id:'fixture-id',rtc_canvas_connection_hash:'fixture-proof'})),150);ws.onMessage(raw=>{const d=JSON.parse(String(raw));if(d.type==='rtc_join')ws.send(JSON.stringify({type:'rtc_peers',self_peer_id:'fixture',peers:[]}));if(d.type==='ping')ws.send(JSON.stringify({type:'pong'}));});});
for(const path of ['/','/login','/docs','/search','/profile','/canvases/999001','/tutorial']){const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));if(['/search','/profile','/canvases/999001'].includes(path))await page.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token,user});await page.goto(origin+path);await page.locator('h1:visible,h2:visible').first().waitFor();await page.waitForTimeout(path.includes('/canvases/')?1800:500);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${path}: no horizontal overflow at ${mobile?'mobile':'desktop'}`);
assert.deepEqual(errors,[],`${path}: no runtime errors`);
if(await page.locator('.frelog-wordmark:visible').count())assert.equal(await page.locator('.frelog-wordmark:visible').first().evaluate(el=>getComputedStyle(el).color),'rgb(32, 33, 36)');
if(process.env.AGORA_E2E_SCREENSHOTS)await page.screenshot({path:'/tmp/agora-redesign-'+(path==='/'?'home':path.replaceAll('/','-'))+(mobile?'-mobile':'-desktop')+'.png',fullPage:path!=='/docs'});
if(path==='/search'){
 assert.equal(await page.locator('.canvas-card').count(),6);
 await page.getByRole('button',{name:'새 캔버스 만들기',exact:true}).click();
 await page.getByRole('dialog').getByLabel('캔버스 이름',{exact:true}).fill('새 디자인 프로젝트');
 await page.getByRole('dialog').getByRole('combobox',{name:'공개 범위',exact:true}).selectOption('public');
 assert.equal(await page.getByRole('dialog').getByRole('combobox',{name:'공개 범위',exact:true}).inputValue(),'public');
 await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
}
if(path==='/profile'){
 await page.getByRole('heading',{name:'2단계 인증',exact:true}).waitFor();
 await page.getByRole('heading',{name:'패스키',exact:true}).waitFor();
 await page.getByLabel('닉네임',{exact:true}).fill('새 프로필');
 assert.equal(await page.getByLabel('닉네임',{exact:true}).inputValue(),'새 프로필');
 await page.getByRole('button',{name:'계정 삭제',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 assert.ok(await page.getByRole('dialog').evaluate(el=>el.getBoundingClientRect().width<=innerWidth));
 await page.keyboard.press('Escape');
}
if(path==='/docs'){
 await page.locator('.docs-toc a[href="#public-api"]').click();
 await page.waitForFunction(()=>location.hash==='#public-api');
 assert.ok(await page.locator('.docs-api-table').first().isVisible());
}
if(path.startsWith('/canvases/')){
 await page.waitForFunction(()=>!document.querySelector('.canvas-loading-status-overlay'));
 const dock=await page.locator('.canvas-quick-dock').boundingBox(),view=await page.locator('.board-topline').boundingBox();
 assert.ok(dock&&view&& !(dock.x<view.x+view.width&&dock.x+dock.width>view.x&&dock.y<view.y+view.height&&dock.y+dock.height>view.y), 'canvas tool dock and view controls do not overlap');
 const panel=page.locator('.canvas-panel-slot-inspector'),toggle=panel.locator('.canvas-panel-toggle');
 const before=await panel.evaluate(el=>el.classList.contains('is-collapsed'));
 await toggle.click();assert.equal(await panel.evaluate(el=>el.classList.contains('is-collapsed')),!before);await toggle.click();
 if(!mobile){await page.getByRole('button',{name:'다크',exact:true}).click();await page.locator('.canvas-app-page[data-theme="dark"]').waitFor();
 assert.equal(await page.locator('.canvas-stage').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(29, 27, 34)');}
}
console.log('PASS',path,mobile?'mobile':'desktop','layout and controls');
await page.close();}await context.close();}}finally{await browser.close();}
