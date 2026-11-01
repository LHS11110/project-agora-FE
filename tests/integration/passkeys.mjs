import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://frelog.p-e.kr';
const browser=await chromium.launch({executablePath:process.env.AGORA_E2E_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const user={user_id:1,email:'passkey-ui@example.invalid',nickname:'Passkey UI',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.passkey-ui';
const challenge=Buffer.from('0123456789abcdef0123456789abcdef').toString('base64url');
const errors=[];
async function context(authenticated){
 const c=await browser.newContext({locale:'ko-KR',viewport:{width:1440,height:1100}});
 if(process.env.AGORA_E2E_ASSET_PROXY)await c.route(origin+'/**',async r=>{
  if(new URL(r.request().url()).pathname.startsWith('/api/'))return r.fallback();
  const response=await c.request.get(process.env.AGORA_E2E_ASSET_PROXY+new URL(r.request().url()).pathname,{ignoreHTTPSErrors:true});
  await r.fulfill({response});
 });
 if(authenticated)await c.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token,user});
 await c.route('**/api/auth/me',r=>r.fulfill({json:user}));await c.route('**/api/auth/providers',r=>r.fulfill({json:{google:true}}));await c.route('**/api/auth/mfa',r=>r.fulfill({json:{available:true,enabled:false}}));await c.route('**/api/auth/passkeys/status',r=>r.fulfill({json:{available:true}}));
 return c;
}
async function authenticator(c,page){const cdp=await c.newCDPSession(page);await cdp.send('WebAuthn.enable');const {authenticatorId}=await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});return {cdp,authenticatorId};}
try{
 const c=await context(true);let keys=[],registrations=0,removals=0;
 await c.route('**/api/auth/passkeys',r=>r.fulfill({json:keys}));
 await c.route('**/api/auth/passkeys/registration/options',r=>r.fulfill({json:{challengeToken:'registration-fixture',options:{publicKey:{challenge,rp:{id:'frelog.p-e.kr',name:'FreLog'},user:{id:challenge,name:'1',displayName:'Passkey UI'},pubKeyCredParams:[{type:'public-key',alg:-7}],timeout:60000,attestation:'none',authenticatorSelection:{residentKey:'required',userVerification:'required'}}}}}));
 await c.route('**/api/auth/passkeys/registration/verify',r=>{const body=r.request().postDataJSON();assert.equal(body.challengeToken,'registration-fixture');assert.ok(body.credential.response.attestationObject);assert.ok(body.credential.response.clientDataJSON);registrations++;keys=[{id:'fixture-key',name:body.name,createdAt:'2026-11-01T00:00:00',lastUsedAt:null}];return r.fulfill({status:200,body:''});});
 await c.route('**/api/auth/passkeys/fixture-key',r=>{assert.equal(r.request().method(),'DELETE');keys=[];removals++;return r.fulfill({status:200,body:''});});
 const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));const {cdp,authenticatorId}=await authenticator(c,page);
 await page.goto(origin+'/profile');const panel=page.getByRole('region',{name:'패스키',exact:true});await panel.getByText('등록된 패스키가 없습니다.').waitFor();await panel.getByRole('textbox',{name:'패스키 이름',exact:true}).fill('개인 노트북');await panel.getByRole('button',{name:'패스키 추가',exact:true}).click();await panel.getByText('개인 노트북',{exact:true}).waitFor();assert.equal(registrations,1);
 await page.evaluate(()=>document.fonts.ready);if(process.env.AGORA_E2E_SCREENSHOTS)await panel.screenshot({path:'/tmp/agora-passkeys-settings.png'});
 await page.setViewportSize({width:390,height:844});assert.ok(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth));if(process.env.AGORA_E2E_SCREENSHOTS)await panel.screenshot({path:'/tmp/agora-passkeys-settings-mobile.png'});
 const credentials=await cdp.send('WebAuthn.getCredentials',{authenticatorId});assert.equal(credentials.credentials.length,1);
 await panel.getByRole('button',{name:'개인 노트북 삭제',exact:true}).click();await panel.getByText('등록된 패스키가 없습니다.').waitFor();assert.equal(removals,1);
 // A second browser uses the real virtual authenticator credential from enrollment.
 for(const mfa of [false,true]){
  const loginContext=await context(false);let verifies=0;
  await loginContext.addInitScript(()=>history.replaceState({__agora:true,value:{from:'/docs'}},''));
  await loginContext.route('**/api/auth/passkeys/login/options',r=>r.fulfill({json:{challengeToken:'login-fixture',options:{publicKey:{challenge,rpId:'frelog.p-e.kr',userVerification:'required',timeout:60000}}}}));
  await loginContext.route('**/api/auth/mfa',r=>r.fulfill({json:{available:true,enabled:mfa}}));
  await loginContext.route('**/api/auth/passkeys/login/verify',r=>{const body=r.request().postDataJSON();assert.equal(body.challengeToken,'login-fixture');assert.ok(body.credential.response.signature);assert.ok(body.credential.response.userHandle);verifies++;return r.fulfill({json:{accessToken:token,user,mfaRequired:false}});});
  const loginPage=await loginContext.newPage();loginPage.on('pageerror',e=>errors.push(e.message));const auth=await authenticator(loginContext,loginPage);await auth.cdp.send('WebAuthn.addCredential',{authenticatorId:auth.authenticatorId,credential:credentials.credentials[0]});
  await loginPage.goto(origin+'/login');await loginPage.getByRole('button',{name:'패스키로 로그인',exact:true}).waitFor();
  if(process.env.AGORA_E2E_SCREENSHOTS&&!mfa)await loginPage.screenshot({path:'/tmp/agora-passkeys-login.png',fullPage:true});
  await loginPage.getByRole('button',{name:'패스키로 로그인',exact:true}).click();
  await loginPage.waitForURL('**/docs');assert.equal(await loginPage.evaluate(()=>localStorage.getItem('agora_token')),token);
  assert.equal(verifies,1);await loginContext.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS real browser WebAuthn UI: registration, names, desktop/mobile, removal, passwordless login, return path, direct login with MFA enabled or disabled');
}finally{await browser.close()}
