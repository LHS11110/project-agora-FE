// Browser UX regression with mocked auth/MFA responses. Real server security is tested separately.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost';
const browser=await chromium.launch({executablePath:process.env.AGORA_E2E_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.mfa-ui-test';
const user={email:'mfa-ui@example.invalid',nickname:'MFA UI',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
const login={accessToken:token,user,mfaRequired:false},challenge={mfaRequired:true,challengeToken:'opaque-test-challenge',accessToken:null,user:null};
const errors=[];
async function context(){const c=await browser.newContext({locale:'ko-KR',viewport:{width:1440,height:1200},ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1'});await c.route('**/api/auth/providers',r=>r.fulfill({json:{google:true}}));await c.route('**/api/auth/me',r=>r.fulfill({json:user}));return c;}
try{
 for(const google of [false,true]){
  const c=await context();const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));let attempts=0,handoffs=0;
  await c.route('**/api/auth/login',r=>r.fulfill({json:challenge}));
  await c.route('**/api/auth/oauth2/session',r=>{handoffs++;return r.fulfill({json:challenge});});
  await c.route('**/api/auth/mfa/verify',r=>{attempts++;assert.equal(r.request().postDataJSON().challengeToken,challenge.challengeToken);return r.fulfill(attempts===1?{status:400,json:{message:'코드가 올바르지 않거나 이미 사용되었습니다. 새 코드를 확인해주세요.'}}:{json:login});});
  await page.goto(origin+'/login');await page.evaluate(()=>sessionStorage.setItem('frelog_oauth_return','/docs'));
  if(google)await page.goto(origin+'/login?oauth=success');else{await page.getByLabel('이메일',{exact:true}).fill(user.email);await page.getByLabel('비밀번호',{exact:true}).fill('test-password');await page.getByRole('button',{name:'로그인',exact:true}).click();}
  await page.getByRole('heading',{name:'2단계 인증',exact:true}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('agora_token')),null);
  await page.getByRole('textbox',{name:'인증 코드',exact:true}).fill('000000');await page.getByRole('button',{name:'인증하고 로그인'}).click();await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('agora_token')),null);
  await page.getByRole('button',{name:'복구 코드 사용',exact:true}).click();await page.getByRole('textbox',{name:'복구 코드',exact:true}).fill('ABCD-EFGH-IJKL-MNOP');await page.getByRole('button',{name:'인증하고 로그인'}).click();await page.waitForURL('**/docs');await page.waitForTimeout(250);assert.equal(new URL(page.url()).pathname,'/docs');assert.equal(await page.evaluate(()=>localStorage.getItem('agora_token')),token);assert.equal(attempts,2);assert.equal(handoffs,google?1:0);await c.close();
 }
 const c=await context();await c.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token,user});
 let enabled=false;const codes=Array.from({length:10},(_,i)=>`ABCD-EFGH-IJKL-MNO${i}`);const secret='JBSWY3DPEHPK3PXP';
 await c.route('**/api/auth/mfa',r=>r.fulfill({json:{available:true,enabled,recoveryCodesRemaining:enabled?10:0}}));
 await c.route('**/api/auth/mfa/enrollment',r=>r.fulfill({json:{secret,uri:`otpauth://totp/FreLog:demo?secret=${secret}&issuer=FreLog`}}));
 await c.route('**/api/auth/mfa/enrollment/confirm',r=>{enabled=true;return r.fulfill({json:{login,recoveryCodes:codes}});});
 await c.route('**/api/auth/mfa/recovery-codes',r=>r.fulfill({json:{recoveryCodes:codes.map(code=>'NEW-'+code)}}));
 await c.route('**/api/auth/mfa/disable',r=>{enabled=false;return r.fulfill({json:{}});});
 const page=await c.newPage();const requested=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requested.push(r.url()));await page.goto(origin+'/profile');
 const panel=page.getByRole('region',{name:'2단계 인증',exact:true});await panel.getByRole('button',{name:'인증앱 연결하기'}).click();
 const qr=panel.getByRole('img',{name:'인증앱 등록 QR 코드'});await qr.waitFor();assert.match(await qr.getAttribute('src'),/^data:image\/png;base64,/);
 await panel.getByRole('textbox',{name:'인증 코드',exact:true}).fill('123456');await panel.getByRole('button',{name:'확인하고 활성화'}).click();await panel.getByText('ABCD-EFGH-IJKL-MNO0',{exact:true}).waitFor();assert.equal(await panel.locator('.mfa-code-grid code').count(),10);
 await panel.getByRole('button',{name:'저장했어요'}).click();assert.equal(await panel.locator('.mfa-code-grid').count(),0);
 await panel.getByRole('textbox',{name:'보안 설정 인증 코드'}).fill('234567');await panel.getByRole('button',{name:'복구 코드 재발급'}).click();await panel.getByText('NEW-ABCD-EFGH-IJKL-MNO0',{exact:true}).waitFor();
 await panel.getByRole('button',{name:'저장했어요'}).click();await panel.getByRole('textbox',{name:'보안 설정 인증 코드'}).fill('345678');await panel.getByRole('button',{name:'2단계 인증 해제'}).click();await panel.getByRole('button',{name:'인증앱 연결하기'}).waitFor();
 assert.ok(requested.every(url=>!url.includes(secret)));assert.deepEqual(errors,[]);
 console.log('PASS password/Google MFA challenge, no token before verification, recovery login, local QR enrollment, one-time display, regeneration and disable UI (mocked server)');
}finally{await browser.close();}
