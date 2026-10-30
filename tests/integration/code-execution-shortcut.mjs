import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const browser=await chromium.launch({executablePath:process.env.AGORA_E2E_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const context=await browser.newContext({locale:'ko-KR',ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.AGORA_E2E_ORIGIN||'https://localhost:5191')+'/tests/browser/code-execution-shortcut.html');
 await page.locator('.canvas-code-editor[data-status="ready"]').waitFor();
 await page.locator('.monaco-editor textarea').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText('print(9)');await page.keyboard.press('Shift+Enter');
 await page.waitForFunction(()=>document.querySelector('.output').textContent==='print(9)');
 assert.equal(await page.evaluate(()=>window.shortcutFixture.items.current.a.text),'print(9)');assert.equal(await page.evaluate(()=>window.shortcutFixture.calls.length),1);
 await page.locator('.monaco-editor textarea').evaluate(element=>element.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',shiftKey:true,repeat:true,bubbles:true,cancelable:true})));
 assert.equal(await page.evaluate(()=>window.shortcutFixture.calls.length),1);
 await page.locator('.background').click();await page.keyboard.press('Shift+Enter');await page.waitForFunction(()=>window.shortcutFixture.calls.length===2&&!window.shortcutFixture.store.isRunning());
 await page.getByRole('textbox',{name:'Chat'}).fill('message');await page.keyboard.press('Shift+Enter');assert.equal(await page.evaluate(()=>window.shortcutFixture.calls.length),2);
 await page.getByRole('dialog').focus();await page.keyboard.press('Shift+Enter');assert.equal(await page.evaluate(()=>window.shortcutFixture.calls.length),2);
 await page.evaluate(()=>window.shortcutFixture.select(['a','b']));await page.locator('.background').click();await page.keyboard.press('Shift+Enter');assert.equal(await page.evaluate(()=>window.shortcutFixture.calls.length),2);
 await page.evaluate(()=>window.shortcutFixture.syncSelection(['b']));await page.keyboard.press('Shift+Enter');
 await page.waitForFunction(()=>window.shortcutFixture.calls.length===3&&!window.shortcutFixture.store.isRunning());
 assert.equal(await page.evaluate(()=>window.shortcutFixture.calls.at(-1).code),'other','immediate selection is read before a React rerender');
 assert.deepEqual(errors,[]);console.log('PASS real Monaco edited source, no newline, selected-only execution, repeated-key suppression, chat/dialog/multi-selection exclusion and immediate selection refs');
}finally{await browser.close()}
