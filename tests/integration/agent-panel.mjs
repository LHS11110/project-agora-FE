import {chromium} from '/tmp/agora-ui-verify/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport,ignoreHTTPSErrors:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://127.0.0.1:5191/tests/browser/agent-panel.html');await page.getByRole('dialog').waitFor();await page.getByRole('region',{name:'API 호출 한도'}).getByText('91',{exact:false}).waitFor();
  await page.getByRole('button',{name:'에이전트 설정',exact:true}).click();await page.getByLabel('EXAONE API 키',{exact:true}).fill('personal-browser-fixture');assert.equal(await page.getByLabel('EXAONE API 키',{exact:true}).getAttribute('type'),'password');await page.getByRole('button',{name:'키 적용',exact:true}).click();await page.waitForFunction(()=>window.agentCalls.some(call=>call.operation==='status'&&call.api_key==='personal-browser-fixture'));await page.locator('.canvas-agent-limit-grid>div').nth(2).locator('strong').filter({hasText:/^24/}).waitFor();assert(!await page.evaluate(()=>JSON.stringify({...localStorage}).includes('personal-browser-fixture')));await page.reload();await page.getByRole('button',{name:'에이전트 설정',exact:true}).click();assert.equal(await page.getByLabel('EXAONE API 키',{exact:true}).inputValue(),'personal-browser-fixture');await page.getByLabel('추론 수준',{exact:true}).selectOption('high');await page.getByLabel('응답 토큰 상한',{exact:true}).selectOption('4096');await page.getByLabel('최대 작업 단계',{exact:true}).fill('3');
  await page.getByRole('checkbox',{name:'최근 대화 포함'}).uncheck();await page.getByLabel('에이전트에게 요청').fill('선택한 코드에 예외 처리를 추가해줘');
  await page.getByRole('button',{name:/보내기/,exact:false}).click();await page.getByText('코드를 수정했습니다. 객체 ID: code-a').waitFor();
  const calls=await page.evaluate(()=>window.agentCalls);const run=calls.find(c=>c.message);assert.deepEqual(run.selected_ids,['code-a']);assert.equal(run.allow_delete,false);assert.equal(run.api_key,'personal-browser-fixture');assert.equal(run.options.reasoning_effort,'high');assert.equal(run.options.max_tokens,4096);assert.equal(run.options.max_steps,3);assert.equal(run.include_history,false);
  const bounds=await page.getByRole('dialog').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=viewport.width);assert(bounds.y+bounds.height<=viewport.height);
  assert.deepEqual(errors,[]);await page.screenshot({path:`/tmp/agora-agent-panel-${viewport.width}.png`});await page.getByRole('button',{name:'닫기',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);
  const launcher=await page.getByRole('button',{name:'AI 에이전트',exact:true}).boundingBox(),summary=await page.locator('.board-topline').boundingBox();assert(launcher.y+launcher.height<summary.y,'Launcher must not overlap bottom summary');await page.screenshot({path:`/tmp/agora-agent-launcher-${viewport.width}.png`});
  await page.getByRole('button',{name:'AI 에이전트',exact:true}).click();assert.equal(await page.getByLabel('추론 수준',{exact:true}).inputValue(),'high');
  await page.getByRole('button',{name:'서버 기본 키 사용',exact:true}).click();await page.waitForFunction(()=>sessionStorage.getItem('agora-agent-personal-api-key')===null);await page.getByRole('region',{name:'API 호출 한도'}).getByText('91',{exact:false}).waitFor();
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.canvas-agent-panel').evaluate(el=>getComputedStyle(el).animationName),'none');await page.close();
 }
 console.log('PASS: masked personal key apply / reload / clear, quota isolation, session-only storage, options and desktop/mobile layout');
}finally{await browser.close();}
