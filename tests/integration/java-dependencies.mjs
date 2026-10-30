// Creates a scene only in an empty, caller-owned temporary canvas specified by AGORA_E2E_STATE.
import fs from 'node:fs';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const state=JSON.parse(fs.readFileSync(process.env.AGORA_E2E_STATE,'utf8'));
const browser=await chromium.launch({executablePath:process.env.AGORA_E2E_CHROME || '/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const origin=process.env.AGORA_E2E_ORIGIN || 'https://localhost';
const items={
 jrun:{kind:'shape',shapeType:'rectangle',runtimeRole:'executor',x:60,y:120,width:320,height:230,permission:'default'},
 jfirst:{kind:'text',renderMode:'code',language:'java',filename:'define.java',text:'import org.apache.commons.lang3.StringUtils; import com.fasterxml.jackson.databind.ObjectMapper; String reversed=StringUtils.reverse("agora"); int answer(){return 42;}',x:450,y:120,width:440,height:200,permission:'default'},
 jsecond:{kind:'text',renderMode:'code',language:'java',filename:'use.java',text:'System.out.println("JAVA "+new ObjectMapper().valueToTree(java.util.Map.of("v",answer())).get("v").asInt()+" "+reversed);',x:450,y:420,width:440,height:180,permission:'default'},
 jout:{kind:'shape',shapeType:'rectangle',runtimeRole:'output',x:1030,y:120,width:440,height:300,permission:'default'},
 prun:{kind:'shape',shapeType:'rectangle',runtimeRole:'executor',x:60,y:750,width:320,height:230,permission:'default'},
 pcode:{kind:'text',renderMode:'code',language:'python',filename:'numpy_test.py',text:'import numpy as np\nprint("NUMPY",np.dot([1,2,3],[4,5,6]))',x:450,y:750,width:440,height:220,permission:'default'},
 pout:{kind:'shape',shapeType:'rectangle',runtimeRole:'output',x:1030,y:750,width:440,height:250,permission:'default'},
 e1:{kind:'connector',from:'jrun',to:'jfirst',permission:'default'},e2:{kind:'connector',from:'jfirst',to:'jsecond',permission:'default'},e3:{kind:'connector',from:'jsecond',to:'jout',permission:'default'},
 e4:{kind:'connector',from:'prun',to:'pcode',permission:'default'},e5:{kind:'connector',from:'pcode',to:'pout',permission:'default'}
};
try{
 const context=await browser.newContext({locale:'ko-KR',viewport:{width:1920,height:1400}});
 await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},state);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${origin}/canvases/${state.canvas_id}`);
 await page.waitForFunction(()=>window.frelogCanvas&&document.querySelector('.connection-pill.connected')&&!document.querySelector('.canvas-loading-status.is-overlay'),null,{timeout:60000});
 await page.getByRole('button',{name:'실행 환경',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('실행 언어',{exact:true}).selectOption('java');
 await dialog.getByLabel('Maven 라이브러리',{exact:true}).fill('org.apache.commons:commons-lang3:3.17.0\ncom.fasterxml.jackson.core:jackson-databind:2.18.2');
 await dialog.getByRole('button',{name:'이 언어에 적용',exact:true}).click();
 await dialog.getByText('Java 라이브러리를 설치했습니다. 코드 객체에서 import할 수 있습니다.',{exact:true}).waitFor({timeout:240000});
 await dialog.getByRole('button',{name:'실행 환경 설정 닫기',exact:true}).click();
 const pip=await page.evaluate(async({token,canvas_id})=>{const r=await fetch(`/api/canvases/${canvas_id}/runtime/execute`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({language:'bash',code:'python3 -m pip install --only-binary=:all: --no-input numpy'})});return {status:r.status,body:await r.json()};},state);
 assert.equal(pip.status,200);assert.equal(pip.body.exitCode,0);assert.match(pip.body.output,/Successfully installed numpy-/);
 await page.evaluate(items=>{if(Object.keys(window.frelogCanvas.read().items).length)throw Error('Temporary canvas must be empty');window.frelogCanvas.apply(window.frelogCanvas.plan({version:1,items}));},items);
 const node=id=>page.locator(`.canvas-object[data-item-id="${id}"]`);
 await node('jrun').getByRole('button',{name:'코드 실행',exact:true}).click();
 await node('jout').getByText('JAVA 42 aroga',{exact:true}).waitFor({timeout:60000});await node('jrun').getByText('실행 완료',{exact:true}).waitFor();
 await node('prun').getByRole('button',{name:'코드 실행',exact:true}).click();
 await node('pout').getByText('NUMPY 32',{exact:true}).waitFor({timeout:60000});await node('prun').getByText('실행 완료',{exact:true}).waitFor();
 await page.getByRole('button',{name:'실행 환경',exact:true}).click();await page.getByRole('dialog').getByLabel('실행 언어',{exact:true}).selectOption('java');
 assert.match(await page.getByRole('dialog').getByLabel('Maven 라이브러리',{exact:true}).inputValue(),/commons-lang3/);
 await page.getByRole('dialog').getByRole('button',{name:'실행 환경 설정 닫기',exact:true}).click();
 assert.deepEqual(errors,[]);
 console.log('PASS production UI: Maven settings save/install/reopen; real Java blueprint imports Commons Lang + Jackson/transitives with inherited variables/functions; real pip NumPy install and Python blueprint output; trusted HTTPS and no page errors');
}finally{await browser.close()}
