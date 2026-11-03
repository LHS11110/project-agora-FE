import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const page=await browser.newPage({ignoreHTTPSErrors:true,locale:'ko-KR'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.AGORA_E2E_ORIGIN||'https://localhost:5192')+'/tests/browser/canvas-undo.html');
 await page.waitForFunction(()=>window.undoFixture?.status.editable);
 const settled=()=>page.waitForFunction(()=>window.undoFixture.sessionRef.current.pendingOperations.length===0 && window.undoFixture.status.queued===0);
 await page.evaluate(()=>{const f=window.undoFixture;f.setItems({a:f.box});});await settled();
 await page.getByRole('button',{name:'실행 취소',exact:true}).click();await settled();assert.equal(await page.evaluate(()=>!!window.undoFixture.itemsRef.current.a),false);
 // More than five distinct user actions remain available.
 for(let i=0;i<8;i++){await page.mouse.click(1100,500);await page.evaluate(i=>{const f=window.undoFixture;f.patchItems({['b'+i]:f.box});},i);await settled();}
 assert.equal(await page.evaluate(()=>window.undoFixture.undoCount),8);
 for(let i=0;i<8;i++){await page.getByRole('button',{name:'실행 취소',exact:true}).click();await settled();}
 assert.equal(await page.evaluate(()=>Object.keys(window.undoFixture.itemsRef.current).length),0);
 // One continuous multi-object movement is a single undo step.
 await page.evaluate(()=>{const f=window.undoFixture;f.setItems({a:f.box,b:f.box});});await settled();
 await page.mouse.move(1100,500);await page.mouse.down();
 await page.evaluate(()=>{const f=window.undoFixture;for(let i=0;i<4;i++)f.moveItems(['a','b'],.05,.02);});await page.mouse.up();await settled();
 await page.evaluate(()=>window.undoFixture.remote('a',{fill:'#112233'}));
 await page.getByRole('button',{name:'실행 취소',exact:true}).click();await settled();
 assert.equal(await page.evaluate(()=>window.undoFixture.itemsRef.current.a.x),0);assert.equal(await page.evaluate(()=>window.undoFixture.itemsRef.current.a.fill),'#112233');
 // Text and rich color edits survive broker commits and can be undone.
 await page.mouse.click(1100,500);await page.evaluate(()=>{const f=window.undoFixture;f.patchItems({t:f.makeCollaborativeItem({kind:'text',text:'hello',permission:'default'})});});await settled();
 await page.mouse.click(1100,500);await page.evaluate(()=>window.undoFixture.color('t'));await settled();assert.equal(await page.evaluate(()=>window.undoFixture.colors('t').length),1);
 await page.getByRole('button',{name:'실행 취소',exact:true}).click();await settled();assert.equal(await page.evaluate(()=>window.undoFixture.colors('t').length),0);
 await page.mouse.click(1100,500);await page.evaluate(()=>window.undoFixture.edit('t','changed'));await settled();
 await page.getByRole('button',{name:'실행 취소',exact:true}).click();await settled();assert.equal(await page.evaluate(()=>window.undoFixture.itemsRef.current.t.text),'hello');
 // Deletion restores text with its document and rich formatting.
 await page.mouse.click(1100,500);await page.evaluate(()=>window.undoFixture.color('t'));await settled();
 await page.mouse.click(1100,500);await page.evaluate(()=>window.undoFixture.patchItems({},['t']));await settled();
 await page.getByRole('button',{name:'실행 취소',exact:true}).click();await settled();assert.equal(await page.evaluate(()=>window.undoFixture.itemsRef.current.t.text),'hello');assert.equal(await page.evaluate(()=>window.undoFixture.colors('t').length),1);
 // Existing permission and lock checks apply to undo too.
 await page.evaluate(()=>{window.undoFixture.accessRef.current={groups:['default'],write_groups:[]};});
 const count=await page.evaluate(()=>window.undoFixture.undoCount);await page.getByRole('button',{name:'실행 취소',exact:true}).click();assert.equal(await page.evaluate(()=>window.undoFixture.undoCount),count);assert.match(await page.getByRole('status').innerText(),/권한/);
 assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>window.undoFixture.sent.length>20));
 console.log('PASS unlimited local undo, dock, grouped multi-move, remote field preservation, durable text/color/delete restoration and permission guard');
}finally{await browser.close();}
