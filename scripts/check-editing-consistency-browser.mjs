import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright-core');
const server=await createServer({server:{host:'127.0.0.1',port:0,https:false,open:false}});
let browser;
const source='// Keep the same canvas object\nconst answer = 42;\nconsole.log("Hello", answer);';
const base={kind:'text',x:.1,y:.1,width:.35,text:source,renderMode:'code',language:'javascript',filename:'example.js'};
const scenarios=[
 ['code / natural height',{}],
 ['code / narrow + explicit height',{width:.16,height:.16,text:Array.from({length:30},(_,i)=>`console.log("Long line ${i} should scroll horizontally, without wrapping.");`).join('\n')}],
 ['code / font scale',{fontSize:22,height:.38,width:.5}],
 ['plain / natural height',{renderMode:'plain',text:'한글과 English, 같은 자리에서 편집합니다.\n두 번째 줄의 여백과 색상도 유지합니다.',color:'#bd3758'}],
 ['plain / custom height',{renderMode:'plain',width:.2,height:.13,text:'긴 문장도 같은 너비로 줄바꿈되어야 합니다.\n'.repeat(8)}],
 ['plain / large font',{renderMode:'plain',fontSize:28,width:.4,text:'같은 크기\n같은 위치'}],
 ['markdown / headings and lists',{renderMode:'markdown',text:'# Project\n\n**A bold idea**\n- 첫 번째 항목\n- 두 번째 항목\n> 팀의 메모',height:undefined}],
 ['markdown / custom height',{renderMode:'markdown',height:.18,text:'# Heading\n\nA paragraph with **bold text**.\n\n- One\n- Two'}],
 ['note / natural height',{kind:'note',renderMode:undefined,height:undefined,text:'## 준비물\n- 편한 신발\n- 물과 간식\n**여기서 만나요.**',color:'#f6eccb',fontSize:12}],
 ['note / explicit height',{kind:'note',renderMode:undefined,height:.24,text:'## 회의 메모\n- 첫 번째 의견\n- 두 번째 의견\n'.repeat(3),color:'#e8efd9',fontSize:14}],
 ['math / natural height',{kind:'math',renderMode:'latex',formula:'f(x) = x^2 + 2x + 1',fontSize:20}],
 ['math / explicit height',{kind:'math',renderMode:'latex',formula:'\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}',height:.16,fontSize:22}],
 ['empty text',{renderMode:'plain',text:''}],
 ['empty code',{text:''}],
];
try{
 await server.listen();browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1600,height:1100},locale:'ko-KR'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/browser/editing-consistency.html`);await page.waitForFunction(()=>window.setEditingFixture);
 const measure=()=>page.evaluate(()=>{
  const rect=selector=>{const e=document.querySelector(selector);if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}};
  return {object:rect('.canvas-object'),surface:rect('.editing-surface'),header:rect('.code-object-head'),footer:rect('.code-object-foot'),filename:rect('.code-file-heading'),language:rect('.code-language-badge')};
 });
 const equalGeometry=(a,b,name)=>{for(const key of Object.keys(a)){if(!a[key]&&!b[key])continue;assert.ok(a[key]&&b[key],name+' '+key+' stays present');for(const axis of ['x','y','width','height'])assert.ok(Math.abs(a[key][axis]-b[key][axis])<1.1,`${name} ${key}.${axis}: ${a[key][axis]} -> ${b[key][axis]}`)}};
 for(const [name,patch]of scenarios){
  const item={...base,...patch};await page.evaluate(item=>window.setEditingFixture({item}),item);await page.waitForTimeout(100);
  if(item.renderMode==='latex')await page.locator('.mathjax-output svg').waitFor({timeout:30000});
  const before=await measure();await page.evaluate(()=>window.toggleFixtureEditing(true));
  if(item.renderMode==='code')await page.locator('.canvas-code-editor[data-status=ready]').waitFor({timeout:30000});else await page.locator('.editing-surface-editor textarea').waitFor();
  equalGeometry(before,await measure(),name+' entering');
  if(item.renderMode==='code'&&item.text){
   const typography=await page.evaluate(()=>{
    const preview=getComputedStyle(document.querySelector('.syntax-code-preview')),line=getComputedStyle(document.querySelector('.monaco-editor .view-line'));
    const body=document.querySelector('.syntax-code-preview').getBoundingClientRect();const first=document.querySelector('.monaco-editor .view-line').getBoundingClientRect();
    return {preview:{font:preview.fontFamily,size:preview.fontSize,line:preview.lineHeight},editor:{font:line.fontFamily,size:line.fontSize,line:line.lineHeight},offset:{x:first.x-body.x,y:first.y-body.y},scale:document.querySelector('.syntax-code-preview').getBoundingClientRect().width/document.querySelector('.syntax-code-preview').offsetWidth};
   });
   assert.equal(typography.preview.size,typography.editor.size,name+' font size');assert.equal(typography.preview.line,typography.editor.line,name+' line height');
   assert.ok(Math.abs(typography.offset.x-12*typography.scale)<1.1,name+' text left padding');assert.ok(Math.abs(typography.offset.y-12*typography.scale)<1.1,name+' text top padding');
   assert.equal(await page.locator('.monaco-editor .line-numbers').count(),0,name+' no new gutter');
  }else if(item.kind!=='note'&&item.renderMode==='plain'&&item.text){
   const type=await page.evaluate(()=>{const p=getComputedStyle(document.querySelector('.unified-plain-preview')),i=getComputedStyle(document.querySelector('.inline-content-input'));return [p.fontFamily,i.fontFamily,p.fontSize,i.fontSize,p.lineHeight,i.lineHeight,p.color,i.color]});
   for(let i=0;i<type.length;i+=2)assert.equal(type[i],type[i+1],name+' typography/color');
  }
  await page.evaluate(()=>window.toggleFixtureEditing(false));equalGeometry(before,await measure(),name+' leaving');console.log(name+': stable');
 }
 // While typing, preserve the frame and leave expensive rendered content frozen.
 await page.evaluate(item=>window.setEditingFixture({item}),{...base,renderMode:'markdown',text:'# Original\n\nKeep this layout.'});await page.waitForTimeout(100);
 const frame=await measure();await page.evaluate(()=>window.toggleFixtureEditing(true));const input=page.locator('.inline-content-input');await input.fill('# Changed\n\n'+('More content\n'.repeat(50)));
 equalGeometry(frame,await measure(),'typing');assert.equal(await page.locator('.editing-surface-preview h2').textContent(),'Original');
 await input.dispatchEvent('compositionstart');await input.dispatchEvent('compositionend');equalGeometry(frame,await measure(),'IME');
 await page.mouse.click(20,20);await input.waitFor({state:'detached'});await page.locator('.editing-surface-preview h2').filter({hasText:'Changed'}).waitFor();
 // Zoom and theme must not reintroduce layout jumps.
 for(const scale of [.5,1.5]){
  await page.evaluate(({item,scale})=>window.setEditingFixture({item,scale,theme:'dark'}),{item:base,scale});await page.waitForTimeout(100);const before=await measure();
  await page.evaluate(()=>window.toggleFixtureEditing(true));await page.locator('.canvas-code-editor[data-status=ready]').waitFor();equalGeometry(before,await measure(),'zoom '+scale);
 }
 // A compact editor must not clip completion lists to its short code frame.
 await page.evaluate(item=>window.setEditingFixture({item}),{...base,text:'pri',language:'python'});await page.waitForTimeout(100);
 await page.evaluate(()=>window.toggleFixtureEditing(true));await page.locator('.canvas-code-editor[data-status=ready]').waitFor();
 await page.locator('.monaco-editor textarea.inputarea').first().focus();await page.keyboard.press('Control+End');await page.keyboard.press('Control+Space');
 const suggestions=page.locator('.suggest-widget.visible');await suggestions.waitFor();
 const menu=await suggestions.boundingBox(),editor=await page.locator('.canvas-code-editor').boundingBox();
 assert.ok(menu.y+menu.height>editor.y+editor.height,'Suggestions must escape the short editor frame');
 assert.ok(await suggestions.evaluate(e=>e.parentElement.closest('.editing-surface-editor')===null),'Completion menu must live outside the clipped object');
 await suggestions.locator('.monaco-list-row').filter({hasText:'print'}).first().click();
 assert.equal(await page.locator('.canvas-code-editor[data-status=ready]').count(),1,'Choosing a completion must keep editing open');
 assert.deepEqual(errors,[]);console.log('PASS: preview/edit geometry, code typography, fixed/auto heights, text colors, source editing, IME, notes, zoom and dark theme.');
}finally{await browser?.close();await server.close()}
