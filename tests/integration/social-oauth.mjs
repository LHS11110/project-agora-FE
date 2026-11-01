import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://frelog.p-e.kr';
const browser=await chromium.launch({executablePath:process.env.AGORA_E2E_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const user={email:'social@example.invalid',nickname:'Social UI',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.social-ui';
const errors=[];
async function context(providers={google:true,naver:true,kakao:true}){
 const c=await browser.newContext({locale:'ko-KR',viewport:{width:1440,height:1200},ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1'});
 await c.addInitScript(()=>{sessionStorage.setItem('frelog_oauth_return','/docs');history.replaceState({__agora:true,value:{from:'/docs'}},'');});
 await c.route('**/api/auth/providers',r=>r.fulfill({json:providers}));await c.route('**/api/auth/me',r=>r.fulfill({json:user}));await c.route('**/api/auth/passkeys/status',r=>r.fulfill({json:{available:false}}));
 await c.route('**/api/auth/email/status',r=>r.fulfill({json:{available:true}}));return c;
}
try{
 for(const [provider,label] of [['google','Google로 계속하기'],['naver','네이버로 계속하기'],['kakao','카카오로 계속하기']]){
  const c=await context();await c.route('**/api/auth/oauth2/authorize/'+provider,r=>r.fulfill({contentType:'text/html',body:'<title>OAuth vendor redirect fixture</title>'}));
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/login');await p.getByRole('button',{name:label,exact:true}).waitFor();
  if(process.env.AGORA_E2E_SCREENSHOTS&&provider==='naver'){await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:'/tmp/agora-social-login-desktop.png',fullPage:true});await p.setViewportSize({width:390,height:844});await p.screenshot({path:'/tmp/agora-social-login-mobile.png',fullPage:true});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await p.getByRole('button',{name:label,exact:true}).click();await p.waitForURL('**/api/auth/oauth2/authorize/'+provider);assert.equal(await p.evaluate(()=>sessionStorage.getItem('frelog_oauth_return')),'/docs');await c.close();
 }
 for(const provider of ['naver','kakao']){
  const c=await context();let handoffs=0,enrollments=0;
  await c.route('**/api/auth/oauth2/session',r=>{handoffs++;return r.fulfill({json:{oauthEnrollmentRequired:true,provider,email:'social@example.invalid',enrollmentToken:'bound-enrollment'}});});
  await c.route('**/api/auth/oauth2/email/request',r=>r.fulfill({json:{challengeId:'email-fixture',expiresInSeconds:600,resendAfterSeconds:60}}));
  await c.route('**/api/auth/email/verify',r=>r.fulfill({json:{emailVerificationToken:'mail-proof'}}));
  await c.route('**/api/auth/oauth2/enrollment',r=>{enrollments++;assert.deepEqual(r.request().postDataJSON(),{email:'social@example.invalid',emailVerificationToken:'mail-proof',enrollmentToken:'bound-enrollment'});return r.fulfill({json:{accessToken:token,user,mfaRequired:false}});});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/login?oauth=success');await p.getByRole('heading',{name:'이메일 확인',exact:true}).waitFor();assert.equal(handoffs,1);
  const submit=p.getByRole('button',{name:'인증하고 가입하기',exact:true});assert.ok(await submit.isDisabled());assert.equal(await p.evaluate(()=>localStorage.getItem('agora_token')),null);
  await p.getByRole('button',{name:'인증 메일 보내기',exact:true}).click();await p.getByRole('textbox',{name:'이메일 인증 코드',exact:true}).fill('123456');await p.getByRole('button',{name:'인증 코드 확인',exact:true}).click();await p.getByText('이메일 인증이 완료되었습니다.',{exact:false}).waitFor();assert.equal(enrollments,0);assert.equal(await p.evaluate(()=>localStorage.getItem('agora_token')),null);
  if(process.env.AGORA_E2E_SCREENSHOTS&&provider==='naver')await p.screenshot({path:'/tmp/agora-social-enrollment.png',fullPage:true});
  await submit.click();await p.waitForURL('**/docs');assert.equal(enrollments,1);assert.equal(await p.evaluate(()=>localStorage.getItem('agora_token')),token);await c.close();
 }
 for(const provider of ['naver','kakao']){
  const c=await context();let verifies=0;await c.route('**/api/auth/oauth2/session',r=>r.fulfill({json:{mfaRequired:true,challengeToken:provider+'-challenge'}}));await c.route('**/api/auth/mfa/verify',r=>{verifies++;assert.equal(r.request().postDataJSON().challengeToken,provider+'-challenge');return r.fulfill({json:{accessToken:token,user,mfaRequired:false}});});
  const p=await c.newPage();await p.goto(origin+'/login?oauth=success');await p.getByRole('heading',{name:'2단계 인증',exact:true}).waitFor();assert.equal(await p.evaluate(()=>localStorage.getItem('agora_token')),null);await p.getByRole('textbox',{name:'인증 코드',exact:true}).fill('123456');await p.getByRole('button',{name:'인증하고 로그인',exact:true}).click();await p.waitForURL('**/docs');assert.equal(verifies,1);await c.close();
 }
 for(const provider of ['naver','kakao']){
  const c=await context();let handoffs=0;
  await c.route('**/api/auth/oauth2/session',r=>{handoffs++;return r.fulfill({status:401,json:{}});});
  const p=await c.newPage();await p.goto(origin+'/login?oauth=account_exists');await p.getByRole('alert').filter({hasText:'이미 존재하는 계정입니다.'}).waitFor();assert.equal(handoffs,0);assert.equal(await p.getByRole('heading',{name:'이메일 확인',exact:true}).count(),0);assert.equal(await p.getByRole('textbox',{name:'기존 계정 비밀번호',exact:true}).count(),0);assert.equal(await p.evaluate(()=>localStorage.getItem('agora_token')),null);await c.close();
 }
 const collision=await context();let verifies=0,enrollments=0;
 await collision.route('**/api/auth/oauth2/session',r=>r.fulfill({json:{oauthEnrollmentRequired:true,provider:'kakao',email:'',enrollmentToken:'gmail-conflict'}}));
 await collision.route('**/api/auth/oauth2/email/request',r=>{assert.deepEqual(r.request().postDataJSON(),{email:'existing@gmail.com',enrollmentToken:'gmail-conflict'});return r.fulfill({status:409,json:{code:'USER_001',message:'이미 존재하는 계정입니다. 기존 로그인 방식을 사용해주세요.'}});});
 await collision.route('**/api/auth/email/verify',r=>{verifies++;return r.fulfill({status:400,json:{}});});await collision.route('**/api/auth/oauth2/enrollment',r=>{enrollments++;return r.fulfill({status:409,json:{}});});
 const existing=await collision.newPage();await existing.goto(origin+'/login?oauth=success');await existing.getByRole('heading',{name:'이메일 확인',exact:true}).waitFor();await existing.getByRole('textbox',{name:'이메일',exact:true}).fill('existing@gmail.com');await existing.getByRole('button',{name:'인증 메일 보내기',exact:true}).click();await existing.getByRole('alert').filter({hasText:'이미 존재하는 계정입니다.'}).waitFor();assert.equal(await existing.getByRole('textbox',{name:'이메일 인증 코드',exact:true}).count(),0);assert.ok(await existing.getByRole('button',{name:'인증하고 가입하기',exact:true}).isDisabled());assert.equal(verifies,0);assert.equal(enrollments,0);await collision.close();
 const disabled=await context({google:true,naver:false,kakao:false});const p=await disabled.newPage();await p.goto(origin+'/login');await p.getByRole('button',{name:'Google로 계속하기',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'네이버로 계속하기',exact:true}).count(),0);assert.equal(await p.getByRole('button',{name:'카카오로 계속하기',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS Google/Naver/Kakao buttons, provider routes, disabled providers, one-use handoff, email-proof-first enrollment, return paths, duplicate-account notices without mail/linking and no early JWT (mocked vendor APIs)');
}finally{await browser.close()}
