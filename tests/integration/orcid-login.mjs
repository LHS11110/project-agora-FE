// Browser-level ORCID handoff fixtures; no real ORCID account is authenticated.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://frelog.p-e.kr';
const browser=await chromium.launch({executablePath:process.env.AGORA_E2E_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.orcid-fixture';
const user={user_id:71,email:null,nickname:'ORCID researcher',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
const errors=[];
async function context({enabled=true,returnPath='/docs',locale='ko'}={}){
 const context=await browser.newContext({locale:'ko-KR',viewport:{width:1440,height:1050},ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1'});
 await context.addInitScript(({returnPath,locale})=>{sessionStorage.setItem('frelog_oauth_return',returnPath);localStorage.setItem('frelog_locale',locale);},{returnPath,locale});
 await context.route('**/api/auth/providers',route=>route.fulfill({json:{google:true,naver:true,kakao:true,orcid:enabled}}));
 await context.route('**/api/auth/passkeys/status',route=>route.fulfill({json:{available:false}}));
 await context.route('**/api/auth/me',route=>route.fulfill({json:user}));
 await context.route('**/api/canvases*',route=>route.fulfill({json:[]}));
 return context;
}
try{
 const first=await context();const page=await first.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin+'/login');const button=page.getByRole('button',{name:'ORCID로 계속하기',exact:true});await button.waitFor();
 assert.equal(await button.locator('img').getAttribute('width'),'24');
 await page.screenshot({path:'/tmp/agora-orcid-login-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/agora-orcid-login-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 let starts=0;await first.route('**/api/irade/auth/orcid/start?app=agora',route=>{starts++;return route.fulfill({contentType:'text/html',body:'<title>ORCID authorization fixture</title>'});});
 await button.click();await page.waitForURL('**/api/irade/auth/orcid/start?app=agora');assert.equal(starts,1);assert.equal(await page.evaluate(()=>sessionStorage.getItem('frelog_oauth_return')),'/docs');await first.close();
 for(const mfa of [false,true]){
  const contextWithLogin=await context();let handoffs=0,verifies=0;
  await contextWithLogin.route('**/api/irade/auth/session',route=>{handoffs++;assert.equal(route.request().method(),'POST');return route.fulfill({json:{login:mfa?{mfaRequired:true,challengeToken:'orcid-mfa-challenge'}:{accessToken:token,user,mfaRequired:false},orcid:'0000-0002-1825-0097',issuer:'https://orcid.org'}});});
  await contextWithLogin.route('**/api/auth/mfa/verify',route=>{verifies++;assert.deepEqual(route.request().postDataJSON(),{challengeToken:'orcid-mfa-challenge',code:'123456'});return route.fulfill({json:{accessToken:token,user,mfaRequired:false}});});
  const returned=await contextWithLogin.newPage();returned.on('pageerror',error=>errors.push(error.message));await returned.goto(origin+'/login?orcid=success');
  if(mfa){await returned.getByRole('heading',{name:'2단계 인증',exact:true}).waitFor();assert.equal(await returned.evaluate(()=>localStorage.getItem('agora_token')),null);await returned.getByRole('textbox',{name:'인증 코드',exact:true}).fill('123456');await returned.getByRole('button',{name:'인증하고 로그인',exact:true}).click();}
  await returned.waitForURL('**/docs');assert.equal(handoffs,1);assert.equal(verifies,mfa?1:0);assert.equal(await returned.evaluate(()=>localStorage.getItem('agora_token')),token);assert.equal(JSON.parse(await returned.evaluate(()=>localStorage.getItem('agora_user'))).email,null);await contextWithLogin.close();
 }
 for(const outcome of ['cancelled','failed','success']){
  const contextWithFailure=await context();let handoffs=0;await contextWithFailure.route('**/api/irade/auth/session',route=>{handoffs++;return route.fulfill({status:401,json:{message:'Expired handoff'}});});
  const returned=await contextWithFailure.newPage();await returned.goto(origin+'/login?orcid='+outcome);await returned.getByRole('alert').filter({hasText:outcome==='success'?'ORCID 로그인을 완료하지 못했습니다.':'ORCID 로그인이 취소되었거나 실패했습니다.'}).waitFor();assert.equal(new URL(returned.url()).search,'');assert.equal(await returned.evaluate(()=>localStorage.getItem('agora_token')),null);assert.equal(handoffs,outcome==='success'?1:0);await contextWithFailure.close();
 }
 const unsafe=await context({returnPath:'//attacker.invalid'});await unsafe.route('**/api/irade/auth/session',route=>route.fulfill({json:{login:{accessToken:token,user},orcid:'0000-0002-1825-0097',issuer:'https://orcid.org'}}));const protectedPage=await unsafe.newPage();await protectedPage.goto(origin+'/login?orcid=success');await protectedPage.waitForURL('**/search');assert.equal(new URL(protectedPage.url()).origin,origin);await unsafe.close();
 const disabled=await context({enabled:false});const disabledPage=await disabled.newPage();await disabledPage.goto(origin+'/login');await disabledPage.getByRole('button',{name:'Google로 계속하기',exact:true}).waitFor();assert.equal(await disabledPage.getByRole('button',{name:'ORCID로 계속하기',exact:true}).count(),0);await disabled.close();
 const english=await context({locale:'en'});const englishPage=await english.newPage();await englishPage.goto(origin+'/login');await englishPage.getByRole('button',{name:'Continue with ORCID',exact:true}).waitFor();await english.close();
 assert.deepEqual(errors,[]);console.log('PASS Agora ORCID button, app-bound start, one-use handoff, no-email account, MFA, safe return, cancellation/expired handoff, disabled provider, English and mobile layout (mocked provider)');
}finally{await browser.close();}
