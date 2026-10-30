import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({executablePath:process.env.AGORA_E2E_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const context=await browser.newContext({locale:'ko-KR',ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1',viewport:{width:1280,height:900}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
 await page.goto((process.env.AGORA_E2E_ORIGIN||'https://localhost:5191')+'/tests/browser/code-completions.html');
 const input=()=>page.locator('.canvas-code-editor .monaco-editor textarea');
 const popup=()=>page.locator('.agora-code-widgets .suggest-widget.visible');
 const open=async()=>{await input().focus();await page.keyboard.press('Control+End');await page.keyboard.press('Control+Space');await popup().waitFor();};
 await page.locator('.canvas-code-editor[data-status="ready"]').waitFor();await open();
 assert.equal(await popup().locator('.monaco-list-row').count(),2);assert.equal(await popup().evaluate(e=>getComputedStyle(e).borderRadius),'12px');
 assert.equal(await popup().locator('.monaco-list-row').first().evaluate(e=>e.getBoundingClientRect().height),32);
 await page.keyboard.press('Control+Space');await page.locator('.agora-code-widgets .suggest-details:visible').waitFor();
 assert.match(await page.locator('.agora-code-widgets .suggest-details:visible').innerText(),/print\(value\)/);
 await page.keyboard.press('Tab');await page.keyboard.insertText('message');assert.match(await page.evaluate(()=>window.completionFixture.getValue()),/print\(message\)$/);
 for(const scale of [.5,2]){
  await page.keyboard.press('Escape');await page.evaluate(scale=>{window.completionFixture.setScale(scale);window.completionFixture.setValue('pr');},scale);await open();
  const box=await popup().boundingBox();assert.equal(Math.round(box.width),430,'popup width does not scale with canvas');
  assert.equal(await popup().locator('.monaco-list-row').first().evaluate(e=>e.getBoundingClientRect().height),32);
 }
 await page.keyboard.press('Escape');await page.evaluate(()=>{window.completionFixture.setScale(1);window.completionFixture.setValue('def prepare_report():\n    pass\npr');});await open();
 await popup().getByRole('option',{name:/prepare_report/}).click();
 assert.match(await page.evaluate(()=>window.completionFixture.getValue()),/prepare_report$/);assert.equal(await page.locator('.canvas-code-editor[data-status="ready"]').count(),1,'mouse selection keeps editor open');
 await page.setViewportSize({width:420,height:740});await page.evaluate(()=>window.completionFixture.setValue('pr'));await open();
 const narrow=await popup().boundingBox();assert.ok(narrow.x>=0&&narrow.x+narrow.width<=421,JSON.stringify(narrow));
 await page.keyboard.press('Escape');await page.evaluate(()=>{window.completionFixture.setLanguage('javascript');window.completionFixture.setValue('con');});await open();
 await popup().getByRole('option',{name:/^console/}).waitFor({timeout:15000});
 await page.evaluate(()=>window.completionFixture.setOpen(false));await page.locator('.agora-code-widgets').waitFor({state:'detached'});
 assert.deepEqual(errors,[]);console.log('PASS styled suggestions/docs, snippet insertion and placeholders, stable popup at 50%/200%, mouse selection, narrow viewport, native JavaScript completions and disposal');
}finally{await browser.close()}
