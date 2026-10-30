// Uses only a caller-owned empty temporary canvas given in AGORA_E2E_STATE.
import fs from 'node:fs';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const state=JSON.parse(fs.readFileSync(process.env.AGORA_E2E_STATE,'utf8'));
const browser=await chromium.launch({executablePath:process.env.AGORA_E2E_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost';
const original='runs=globals().get("runs",0)+1\nprint("SHORTCUT",runs)';
const edited='runs=globals().get("runs",0)+1\nprint("EDITED",runs)';
const items={a:{kind:'text',renderMode:'code',language:'python',filename:'selected.py',text:original,x:120,y:200,width:440,height:230,permission:'default'},b:{kind:'text',renderMode:'code',language:'python',filename:'not_selected.py',text:'raise RuntimeError("MUST NOT EXECUTE")',x:120,y:650,width:440,height:200,permission:'default'},out:{kind:'shape',shapeType:'rectangle',runtimeRole:'output',x:820,y:200,width:400,height:260,permission:'default'},mirror:{kind:'shape',shapeType:'rectangle',runtimeRole:'output',x:1280,y:200,width:400,height:260,permission:'default'},e:{kind:'connector',from:'a',to:'out',permission:'default'},m:{kind:'connector',from:'out',to:'mirror',permission:'default'},next:{kind:'connector',from:'a',to:'b',permission:'default'}};
try{
 const pages=[],errors=[];let executions=0;
 for(let i=0;i<2;i++){
  const context=await browser.newContext({locale:'ko-KR',viewport:{width:1920,height:1200}});
  await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},state);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/runtime/execute'))executions++;});
  await page.goto(`${origin}/canvases/${state.canvas_id}`);await page.waitForFunction(()=>window.frelogCanvas&&document.querySelector('.connection-pill.connected')&&!document.querySelector('.canvas-loading-status.is-overlay'),null,{timeout:60000});pages.push(page);
 }
 const [page,observer]=pages;
 await page.evaluate(()=>{if(Object.keys(window.frelogCanvas.read().items).length)throw Error('Only use an empty temporary canvas');});
 await page.evaluate(async({token,canvas_id})=>{const response=await fetch(`/api/canvases/${canvas_id}/runtime/reset`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw Error('Reset failed');},state);
 const node=(p,id)=>p.locator(`.canvas-object[data-item-id="${id}"]`);
 await page.evaluate(items=>{window.frelogCanvas.apply(window.frelogCanvas.plan({version:1,items}));},items);
 await node(page,'a').locator('.unified-content-body').click();await page.keyboard.press('Shift+Enter');
 for(const p of pages)for(const id of ['out','mirror'])await node(p,id).getByText('SHORTCUT 1',{exact:true}).waitFor({timeout:60000});
 assert.equal(executions,1,'only selected code executes, even when another code object is connected');
 await node(page,'a').locator('.unified-content-body').dblclick();await node(page,'a').locator('.canvas-code-editor[data-status="ready"]').waitFor();
 await node(page,'a').locator('.monaco-editor textarea').focus();await page.keyboard.press('Control+a');await page.keyboard.insertText(edited);await page.keyboard.press('Shift+Enter');
 for(const p of pages)for(const id of ['out','mirror'])await node(p,id).getByText('EDITED 2',{exact:true}).waitFor({timeout:60000});
 assert.equal(executions,2);assert.equal(await page.evaluate(()=>window.frelogCanvas.read().items.a.text),edited);assert.deepEqual(errors,[]);
 console.log('PASS production Shift+Enter: selected code only, no executor required, latest Monaco edits without newline, VM state preserved, output chains broadcast to a second browser, no page errors');
}finally{await browser.close()}
