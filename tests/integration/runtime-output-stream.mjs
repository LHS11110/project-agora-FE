// Requires an isolated, caller-owned fixture with users, canvasId and the graph below.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const state=JSON.parse(fs.readFileSync(process.env.AGORA_E2E_STATE,'utf8'));
const origin=process.env.AGORA_E2E_ORIGIN||'https://frelog.p-e.kr';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const pages=[],errors=[];let executions=0;
const object=(page,id)=>page.locator(`.canvas-object[data-item-id="${id}"]`);
try{
 for(const participant of state.users){
  const context=await browser.newContext({viewport:{width:1920,height:1200},locale:'ko-KR'});
  await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));localStorage.setItem('frelog_locale','ko');},participant);
  const page=await context.newPage();pages.push(page);page.on('pageerror',error=>errors.push(error.message));
  page.on('request',r=>{if(r.url().endsWith('/runtime/execute/stream'))executions++;});
  await page.goto(origin+`/canvases/${state.canvasId}`);await page.waitForFunction(()=>window.frelogCanvas?.read().items.out);
 }
 const previousRun=await pages[0].evaluate(()=>window.frelogCanvas.read().items.out.runtimeResults?.[0]?.runId);
 const started=Date.now();await pages[0].locator('[data-blueprint-run]').click();
 await pages[0].waitForFunction(previous=>{const value=window.frelogCanvas?.read().items.out.runtimeResults?.[0]?.runId;return value&&value!==previous;},previousRun);
 for(const page of pages)for(const id of ['out','mirror']){
  await object(page,id).locator('pre').filter({hasText:'FIRST_STAGE'}).waitFor();
  assert.ok(!(await object(page,id).innerText()).includes('DONE'),'partial output must render before completion');
  assert.ok((await object(page,id).innerText()).includes('실행 중'));
 }
 assert.equal(await object(pages[0],'code').getAttribute('data-runtime-state'),'running');
 console.log('PASS two users and both connected result objects display first output while the code is still running; elapsed ms',Date.now()-started);
 await object(pages[1],'mirror').locator('pre').filter({hasText:'SECOND_STAGE'}).waitFor();
 assert.ok(!(await object(pages[1],'mirror').innerText()).includes('DONE'));
 await pages[0].waitForFunction(()=>document.querySelector('.canvas-object[data-item-id="code"]')?.getAttribute('data-runtime-state')==='success');
 for(const page of pages)for(const id of ['out','mirror']){
  await object(page,id).locator('pre').filter({hasText:'DONE'}).waitFor();
  assert.equal(await object(page,id).locator('.blueprint-results section').count(),1);
  assert.equal(await object(page,id).locator('pre').innerText(),'FIRST_STAGE\nSECOND_STAGE\nDONE\n');
 }
 assert.equal(executions,1);assert.deepEqual(errors,[]);
 await pages[1].reload();await pages[1].waitForFunction(()=>window.frelogCanvas?.read().items.out?.runtimeResults?.[0]?.exitCode===0);
 assert.equal(await object(pages[1],'out').locator('pre').innerText(),'FIRST_STAGE\nSECOND_STAGE\nDONE\n');
 console.log('PASS terminal result replaces the same record, single execution, persistent broker broadcast and rejoin restoration');
}finally{await browser.close();}
