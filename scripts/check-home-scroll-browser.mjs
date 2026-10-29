import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const server=await createServer({server:{host:'127.0.0.1',port:0,https:false,hmr:false,open:false}});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000},locale:'ko-KR'});
 await context.addInitScript(()=>{sessionStorage.setItem('frelog.home-intro.v1','seen');if(!localStorage.getItem('frelog_locale'))localStorage.setItem('frelog_locale','ko')});
 await context.route('https://localhost/**',async route=>{const url=new URL(route.request().url());return route.fulfill({response:await route.fetch({url:`http://127.0.0.1:${server.httpServer.address().port}${url.pathname}${url.search}`})})});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://localhost/');await page.locator('.home-scroll-hero').waitFor();
 assert.equal(await page.locator('.home-slide-track,.home-slide-controls,.pointer-water,.pointer-firework').count(),0);
 await page.mouse.move(200,400);await page.mouse.wheel(0,350);await page.waitForTimeout(300);const y=await page.evaluate(()=>scrollY);assert.ok(y>200,'Wheel must scroll document');
 await page.keyboard.press('PageDown');await page.waitForTimeout(500);assert.ok(await page.evaluate(()=>scrollY)>y,'PageDown must scroll naturally');
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.getByRole('link',{name:'함께 작업하기',exact:true}).click();await page.waitForTimeout(1200);assert.ok(Math.abs((await page.locator('#collaboration').boundingBox()).y-82)<6);
 await page.getByRole('link',{name:'맨 위로 ↑',exact:true}).click();await page.waitForTimeout(1200);
 await page.goto('https://localhost/login');await page.getByLabel('이메일',{exact:true}).fill('person@example.com');await page.getByLabel('비밀번호',{exact:true}).fill('password-test');
 await page.getByRole('button',{name:'비밀번호 표시',exact:true}).click();assert.equal(await page.locator('input[name=password]').getAttribute('type'),'text');
 await page.getByRole('button',{name:'비밀번호 숨기기',exact:true}).click();
 await page.route('**/api/auth/login',r=>r.fulfill({status:401,contentType:'application/json',body:JSON.stringify({message:'입력 정보를 확인해주세요.'})}));
 await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('alert').waitFor();
 await page.getByRole('button',{name:'회원가입',exact:true}).click();await page.getByLabel('닉네임',{exact:true}).fill('팀원');assert.equal(await page.locator('input[name=password]').getAttribute('autocomplete'),'new-password');
 await page.getByRole('button',{name:'로그인',exact:true}).click();
 assert.equal(await page.locator('.pointer-water,.pointer-firework,.motion-field').count(),0);
 for(const width of [390,320,768]){
  await page.setViewportSize({width,height:844});
  for(const path of ['/','/login']){
   await page.goto('https://localhost'+path);await page.locator(path==='/'?'.home-scroll-hero':'.auth-form-wrap').waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow at '+width+' '+path);
  }
 }
 await page.getByLabel('언어 / Language').selectOption('en');await page.getByRole('heading',{name:'Welcome back.'}).waitFor();
 await page.goto('https://localhost/');await page.getByRole('heading',{name:/Beyond the limits/}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'English layout must fit');
 assert.equal(await page.locator('.pointer-water,.pointer-firework,.pointer-water-ring,.motion-field').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: native wheel and keyboard scrolling, anchor navigation, login validation, password visibility, signup switch, responsive layouts and locale.');
}finally{await browser.close();await server.close();}
