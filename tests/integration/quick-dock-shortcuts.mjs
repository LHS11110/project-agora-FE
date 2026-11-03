import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const page=await browser.newPage({locale:'ko-KR',ignoreHTTPSErrors:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.AGORA_E2E_ORIGIN||'https://localhost:5192')+'/tests/browser/quick-dock-shortcuts.html');await page.locator('.background').click();
 const pairs=[['1','select'],['2','hand'],['3','pen'],['4','eraser'],['5','laser'],['6','note'],['7','shape'],['8','connect'],['9','text'],['0','table'],['Shift+1','chart']];
 for(const [key,tool] of pairs){await page.keyboard.press('Control+'+key);await page.waitForFunction(tool=>window.toolFixture.active===tool,tool);}
 const upload=page.waitForEvent('filechooser');await page.keyboard.press('Control+Shift+2');await (await upload).setFiles([]);
 let count=await page.evaluate(()=>window.toolFixture.count);await page.getByRole('textbox',{name:'Chat'}).focus();await page.keyboard.press('Control+1');assert.equal(await page.evaluate(()=>window.toolFixture.count),count);
 await page.getByRole('dialog').focus();await page.keyboard.press('Control+2');assert.equal(await page.evaluate(()=>window.toolFixture.count),count);
 await page.locator('.monaco-editor').focus();await page.keyboard.press('Control+3');assert.equal(await page.evaluate(()=>window.toolFixture.count),count);
 await page.evaluate(()=>window.toolFixture.setWrite(false));await page.waitForFunction(()=>window.toolFixture.write===false);await page.locator('.background').click();await page.keyboard.press('Control+3');assert.equal(await page.evaluate(()=>window.toolFixture.count),count);
 await page.keyboard.press('Control+2');await page.waitForFunction(()=>window.toolFixture.active==='hand');
 await page.evaluate(()=>window.toolFixture.setAllowed(false));await page.waitForFunction(()=>window.toolFixture.allowed===false);count=await page.evaluate(()=>window.toolFixture.count);await page.keyboard.press('Control+1');assert.equal(await page.evaluate(()=>window.toolFixture.count),count);
 await page.evaluate(()=>window.toolFixture.setAllowed(true));await page.waitForFunction(()=>window.toolFixture.allowed===true);
 const canceled=await page.locator('.background').evaluate(el=>!el.dispatchEvent(new KeyboardEvent('keydown',{key:'1',code:'Digit1',ctrlKey:true,repeat:true,bubbles:true,cancelable:true})));assert.equal(canceled,true);assert.equal(await page.evaluate(()=>window.toolFixture.count),count);
 assert.deepEqual(errors,[]);console.log('PASS toolbar order, all number shortcuts, upload picker, input/Monaco/dialog exclusion, write permissions and session/gesture guard');
}finally{await browser.close();}
