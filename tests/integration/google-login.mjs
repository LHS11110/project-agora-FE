// UI flow test with mocked provider/handoff responses; never signs into a real Google account.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost';
const browser=await chromium.launch({executablePath:process.env.AGORA_E2E_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
try{
 const context=await browser.newContext({locale:'ko-KR',viewport:{width:1440,height:1100},ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1'});
 await context.route('**/api/auth/providers',r=>r.fulfill({json:{google:true}}));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/login');const button=page.getByRole('button',{name:'Google로 계속하기'});await button.waitFor();
 await page.screenshot({path:process.env.AGORA_E2E_SCREENSHOT||'/tmp/agora-google-login.png'});
 let starts=0;await context.route('**/api/auth/oauth2/authorize/google',r=>{starts++;return r.fulfill({contentType:'text/html',body:'OAuth redirect intercepted by UI test'});});
 await button.click();await page.waitForURL('**/api/auth/oauth2/authorize/google');assert.equal(starts,1);
 await page.goto(origin+'/login?oauth=account_exists');await page.getByRole('alert').filter({hasText:'같은 이메일의 기존 계정'}).waitFor();assert.equal(new URL(page.url()).search,'');
 let exchanges=0;const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.ui-test';
 const user={email:'oauth-ui@example.invalid',nickname:'OAuth UI',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
 await context.route('**/api/auth/oauth2/session',r=>{exchanges++;return r.fulfill({json:{accessToken:token,user,tokenType:'Bearer'}});});
 await context.route('**/api/auth/me',r=>r.fulfill({json:user}));
 await page.evaluate(()=>sessionStorage.setItem('frelog_oauth_return','/docs'));
 await page.goto(origin+'/login?oauth=success');await page.waitForURL('**/docs');
 assert.equal(exchanges,1);assert.equal(await page.evaluate(()=>localStorage.getItem('agora_token')),token);
 assert.equal(new URL(page.url()).search,'');assert.deepEqual(errors,[]);
 console.log('PASS Google button, authorization navigation, existing-account error, one-use handoff, auth persistence and local return navigation (mocked provider)');
}finally{await browser.close();}
