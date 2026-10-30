import fs from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const state=JSON.parse(fs.readFileSync(process.env.AGORA_E2E_STATE,'utf8'));
const origin=process.env.AGORA_E2E_ORIGIN || 'https://localhost';
const browser=await chromium.launch({executablePath:process.env.AGORA_E2E_CHROME || '/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER ? ['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER] : [])]});
const items={
 run:{kind:'shape',shapeType:'rectangle',runtimeRole:'executor',x:60,y:180,width:340,height:230,permission:'default'},
 first:{kind:'text',renderMode:'code',language:'python',filename:'define.py',text:'counter = globals().get("counter", 0) + 1\ndef total(n):\n return counter+n',x:480,y:180,width:440,height:220,permission:'default'},
 second:{kind:'text',renderMode:'code',language:'python',filename:'use.py',text:'print("INHERITED", total(10))',x:480,y:510,width:440,height:200,permission:'default'},
 out:{kind:'shape',shapeType:'rectangle',runtimeRole:'output',x:1040,y:180,width:440,height:300,permission:'default'},
 mirror:{kind:'shape',shapeType:'rectangle',runtimeRole:'output',x:1040,y:540,width:440,height:260,permission:'default'},
 e1:{kind:'connector',from:'run',to:'first',permission:'default'},e2:{kind:'connector',from:'first',to:'second',permission:'default'},
 e3:{kind:'connector',from:'second',to:'out',permission:'default'},e4:{kind:'connector',from:'out',to:'mirror',permission:'default'}
};
try {
 const pages=[],errors=[];
 for(let i=0;i<2;i++){
  const context=await browser.newContext({viewport:{width:1920,height:1200},locale:'ko-KR'});
  await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));localStorage.setItem('frelog_locale','ko')},state);
  const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/canvases/'+state.canvas_id);
  await page.waitForFunction(()=>window.frelogCanvas&&document.querySelector('.connection-pill.connected')&&!document.querySelector('.canvas-loading-status.is-overlay'),null,{timeout:60000});
  pages.push(page);
 }
 const [a,b]=pages;const node=(page,id)=>page.locator(`.canvas-object[data-item-id="${id}"]`);
 await a.evaluate(items=>{if(Object.keys(window.frelogCanvas.read().items).length)throw Error('Only use empty temporary canvas');window.frelogCanvas.apply(window.frelogCanvas.plan({version:1,items}))},items);
 await node(a,'run').getByRole('button',{name:'코드 실행',exact:true}).waitFor();
 for(const n of [11,12]){
  await node(a,'run').getByRole('button',{name:'코드 실행',exact:true}).click();
  for(const page of pages)for(const id of ['out','mirror'])await node(page,id).getByText('INHERITED '+n,{exact:true}).waitFor({timeout:60000});
  await node(a,'run').getByText('실행 완료',{exact:true}).waitFor();
 }
 await a.reload();await a.waitForFunction(()=>window.frelogCanvas&&document.querySelector('.connection-pill.connected')&&!document.querySelector('.canvas-loading-status.is-overlay'),null,{timeout:60000});
 await node(a,'out').getByText('INHERITED 12',{exact:true}).waitFor();
 await node(a,'run').getByRole('button',{name:'코드 실행',exact:true}).click();
 await node(b,'out').getByText('INHERITED 13',{exact:true}).waitFor({timeout:60000});
 await node(a,'run').getByText('실행 완료',{exact:true}).waitFor();
 await node(a,'run').getByRole('button',{name:'실행 환경 초기화',exact:true}).click();
 await node(a,'run').getByText('변수와 함수를 초기화했습니다. 파일은 유지됩니다.',{exact:true}).waitFor();
 await node(a,'out').getByText('INHERITED 13',{exact:true}).waitFor();
 await node(a,'run').getByRole('button',{name:'코드 실행',exact:true}).click();
 await node(b,'out').getByText('INHERITED 11',{exact:true}).waitFor({timeout:60000});
 await node(a,'run').getByText('실행 완료',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: production blueprint uses inherited variables/functions across cells, repeat runs and reload; reset preserves outputs; results broadcast to second browser');
 for(const page of pages)await page.goto(origin+'/');
}finally{await browser.close()}
