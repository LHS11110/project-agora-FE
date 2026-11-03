// A private, caller-owned empty canvas and two authorized accounts are required.
import fs from 'node:fs';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const fixture=JSON.parse(fs.readFileSync(process.env.AGORA_E2E_STATE,'utf8'));
const origin=process.env.AGORA_E2E_ORIGIN||'https://frelog.p-e.kr';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const pages=[],errors=[];
const strokes=page=>page.evaluate(()=>Object.fromEntries(Object.entries(window.frelogCanvas.read().items).filter(([,item])=>item.kind==='stroke')));
const waitCount=(page,count)=>page.waitForFunction(n=>Object.values(window.frelogCanvas?.read().items||{}).filter(item=>item.kind==='stroke').length===n,count);
try{
 for(const participant of fixture.users){
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ko-KR'});
  await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));localStorage.setItem('frelog_locale','ko');},participant);
  const page=await context.newPage();pages.push(page);page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+`/canvases/${fixture.canvasId}`);await page.locator('.connection-pill.connected').waitFor();
 }
 const [owner,guest]=pages,dock=owner.locator('.canvas-quick-dock'),undo=dock.getByRole('button',{name:'실행 취소',exact:true});
 const box=await owner.locator('.canvas-stage').boundingBox(),x=box.x+650,y=box.y+270;
 const draw=async()=>{
  await dock.getByRole('button',{name:'드로잉',exact:true}).click();await owner.mouse.move(x,y);await owner.mouse.down();await owner.mouse.move(x+100,y,{steps:10});
  await guest.waitForFunction(()=>Object.values(window.frelogCanvas?.read().items||{}).some(item=>item.kind==='stroke'&&item.complete===false));
  await owner.mouse.move(x+100,y+80,{steps:8});await owner.mouse.move(x+10,y+80,{steps:8});await owner.mouse.up();
  await guest.waitForFunction(()=>Object.values(window.frelogCanvas?.read().items||{}).some(item=>item.kind==='stroke'&&item.complete===true));
 };
 await draw();assert.match(await undo.getAttribute('title'),/\(1\)$/);
 await owner.locator('.canvas-stage').focus();await owner.keyboard.press('Control+z');await waitCount(owner,0);await waitCount(guest,0);
 await draw();const original=await strokes(owner);
 await owner.keyboard.press('Control+1');await owner.mouse.click(x+40,y);await owner.locator('.stroke-selection-path polyline').waitFor();
 await owner.keyboard.press('Control+4');assert.equal(await owner.locator('.stroke-selection-path polyline').evaluate(node=>getComputedStyle(node).fill),'none');
 await owner.mouse.move(x+50,y-20);await owner.mouse.down();await owner.mouse.move(x+50,y+25,{steps:8});await owner.mouse.up();
 assert.notDeepEqual(await strokes(owner),original);
 await undo.click();await owner.waitForTimeout(200);assert.deepEqual(await strokes(owner),original);
 await guest.waitForFunction(before=>{const items=window.frelogCanvas.read().items;return Object.keys(items).length===Object.keys(before).length&&Object.keys(before).every(id=>items[id]&&JSON.stringify(items[id].points)===JSON.stringify(before[id].points)&&items[id].complete===before[id].complete);},original);
 await undo.click();await waitCount(owner,0);await waitCount(guest,0);
 await draw();await guest.reload();await guest.locator('.connection-pill.connected').waitFor();await waitCount(guest,1);
 await undo.click();await waitCount(guest,0);await guest.reload();await guest.locator('.connection-pill.connected').waitFor();await waitCount(guest,0);
 assert.deepEqual(errors,[]);console.log('PASS real broker: partial ink delivery, one undo deletes completed stroke for both users, erase undo restores original stroke, invisible hit SVG and saved deletion survives rejoin');
}finally{await browser.close();}
