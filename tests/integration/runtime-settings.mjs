// Run against Vite with AGORA_E2E_RUNTIME_CATALOG pointing to manager settings_get JSON.
import fs from 'node:fs';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const snapshot=JSON.parse(fs.readFileSync(process.env.AGORA_E2E_RUNTIME_CATALOG,'utf8'));const writes=[];
const browser=await chromium.launch({executablePath:process.env.AGORA_E2E_CHROME || '/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1100,height:900},locale:'ko-KR',ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS === '1'});
 let javaInstalls=0;
 await context.route('**/api/canvases/123/runtime/java/dependencies',async route=>{
  javaInstalls++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({installed:true,jarCount:1,cached:false})});
 });
 await context.route('**/api/canvases/123/runtime/disk',async route=>{
  const body=route.request().postDataJSON();assert.equal(body.revision,snapshot.revision);assert.equal(body.sizeGiB,12);
  snapshot.revision++;snapshot.diskGiB=body.sizeGiB;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(snapshot)});
 });
 await context.route('**/api/canvases/123/runtime/resources',async route=>{
  const body=route.request().postDataJSON();assert.equal(body.revision,snapshot.revision);
  assert.equal(body.template,'medium');snapshot.revision++;snapshot.resourceTemplate=body.template;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(snapshot)});
 });
 await context.route('**/api/canvases/123/runtime/settings',async route=>{
  if(route.request().method()==='PUT'){
   const body=route.request().postDataJSON();writes.push(body);assert.equal(body.revision,snapshot.revision);
   snapshot.revision++;snapshot.languages[body.language]=body.config;
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(snapshot)});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto((process.env.AGORA_E2E_ORIGIN || 'https://localhost:5191')+'/tests/browser/runtime-settings.html');
 const dialog=page.getByRole('dialog');await dialog.getByLabel('컴파일러 / 인터프리터',{exact:true}).waitFor();
 await dialog.getByLabel('디스크 용량',{exact:true}).selectOption('12');
 await dialog.getByRole('button',{name:'디스크 용량 적용',exact:true}).click();await dialog.getByRole('status').waitFor();
 await page.waitForFunction(()=>document.querySelector('select[aria-label="디스크 용량"] option[value="6"]').disabled);
 assert.equal(snapshot.diskGiB,12);assert.equal(await dialog.getByLabel('디스크 용량',{exact:true}).locator('option[value="6"]').evaluate(option=>option.disabled),true);
 await dialog.getByRole('radio',{name:/표준/}).check();
 await dialog.getByRole('button',{name:'VM 템플릿 적용',exact:true}).click();await dialog.getByRole('status').waitFor();
 assert.equal(snapshot.resourceTemplate,'medium');
 await dialog.getByLabel('컴파일러 / 인터프리터',{exact:true}).selectOption('clang21');
 await dialog.getByLabel('언어 표준',{exact:true}).selectOption('c++20');await dialog.getByLabel('최적화',{exact:true}).selectOption('2');
 await dialog.getByRole('checkbox',{name:'추가 경고',exact:true}).check();await dialog.getByRole('button',{name:'이 언어에 적용',exact:true}).click();
 await dialog.getByRole('status').waitFor();assert.equal(writes[0].config.engine,'clang21');assert.equal(writes[0].config.standard,'c++20');assert.equal(writes[0].config.optimization,'2');assert.equal(writes[0].config.warnings,true);
 await dialog.getByLabel('실행 언어',{exact:true}).selectOption('java');await dialog.getByLabel('컴파일러 / 인터프리터',{exact:true}).selectOption('jdk17');
 assert.equal(await dialog.getByLabel('대상 Java 버전',{exact:true}).inputValue(),'17');
 assert.equal(await dialog.getByLabel('대상 Java 버전',{exact:true}).locator('option').count(),1);
 await dialog.getByLabel('최대 힙 메모리 (MiB)',{exact:true}).selectOption('128');
 await dialog.getByLabel('Maven 라이브러리',{exact:true}).fill('org.apache.commons:commons-lang3:3.17.0');
 await dialog.getByRole('button',{name:'이 언어에 적용',exact:true}).click();await dialog.getByRole('status').waitFor();assert.equal(writes[1].config.engine,'jdk17');assert.equal(writes[1].config.heapMiB,'128');
 await dialog.getByText('Java 라이브러리를 설치했습니다. 코드 객체에서 import할 수 있습니다.',{exact:true}).waitFor();
 assert.equal(javaInstalls,1);assert.deepEqual(writes[1].config.dependencies,['org.apache.commons:commons-lang3:3.17.0']);
 await dialog.getByRole('button',{name:'라이브러리 설치 / 다시 시도',exact:true}).click();
 await dialog.getByText('Java 라이브러리를 설치했습니다. 코드 객체에서 import할 수 있습니다.',{exact:true}).waitFor();assert.equal(javaInstalls,2);
 await dialog.getByRole('button',{name:'실행 환경 설정 닫기',exact:true}).click();await page.getByText('Open runtime settings',{exact:true}).click();
 await page.getByRole('dialog').getByLabel('컴파일러 / 인터프리터',{exact:true}).waitFor();
 assert.equal(await page.getByRole('dialog').getByLabel('디스크 용량',{exact:true}).inputValue(),'12');
 assert.equal(await page.getByRole('dialog').getByRole('radio',{name:/표준/}).isChecked(),true);
 assert.equal(await page.getByRole('dialog').getByLabel('컴파일러 / 인터프리터',{exact:true}).inputValue(),'clang21');
 assert.equal(await page.getByRole('dialog').getByLabel('언어 표준',{exact:true}).inputValue(),'c++20');
 await page.getByRole('dialog').getByLabel('컴파일러 / 인터프리터',{exact:true}).selectOption('gcc14');
 await page.getByText('독립 프로그램 모드: main이 필요하며 코드 객체 사이에 메모리를 공유하지 않습니다.',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: disk growth selection/no-shrink/reload, VM template apply/reload, compiler/standard/optimization, JDK release constraints, settings persistence, GCC mode explanation');
}finally{await browser.close()}
