import {chromium} from '/tmp/agora-ui-verify/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport,ignoreHTTPSErrors:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('/tests/browser/agent-panel.html',process.env.AGENT_TEST_ORIGIN || 'https://127.0.0.1:5191').href);await page.getByRole('dialog').waitFor();
  await page.locator('[name=agent-consent-terms]').check();
  await page.locator('[name=agent-consent-transfer]').check();
  await page.getByRole('button',{name:'동의하고 사용'}).click();
  await page.reload();
  await page.getByRole('button',{name:'에이전트 설정',exact:true}).click();
  await page.getByRole('button',{name:'기본값 복원'}).click();
  await page.getByRole('combobox',{name:'Claude 모델',exact:true}).selectOption('claude-sonnet-5-5');
  assert.equal(await page.locator('[name=agent-api-key]').count(),0);
  await page.getByLabel('추론 수준',{exact:true}).selectOption('high');
  await page.getByLabel('응답 토큰 상한',{exact:true}).selectOption('4096');
  await page.getByLabel('최대 작업 단계',{exact:true}).fill('3');
  await page.getByLabel('에이전트에게 요청').fill('새 파이썬 예제를 만들어줘');
  await page.getByRole('button',{name:/보내기/,exact:false}).click();await page.getByText('코드를 수정했습니다. 객체 ID: code-a').waitFor();
  const run=await page.evaluate(()=>window.agentCalls.find(call=>call.message));
  for (const field of ['api_key','selected_ids','history','allow_delete','include_history']) {
    assert.equal(Object.hasOwn(run,field),false);
  }
  assert.equal(run.options.provider,'anthropic');
  assert.equal(run.options.model,'claude-sonnet-5-5');
  assert.equal(run.options.reasoning_effort,'high');
  assert.equal(run.options.max_tokens,4096);
  assert.equal(run.options.max_steps,3);
  await page.evaluate(async ()=>{
    const {reviewAgentPrompt}=await import('/src/components/agentConsent.js');
    window.review=reviewAgentPrompt('<script>connected input</script>');
  });
  const review=page.locator('dialog[aria-labelledby=canvas-agent-review-title]');
  assert.equal(await review.locator('textarea').inputValue(),'<script>connected input</script>');
  await review.getByRole('button',{name:'취소'}).click();
  assert.equal(await page.evaluate(()=>window.review),false);
  const bounds=await page.getByRole('dialog').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=viewport.width);assert(bounds.y+bounds.height<=viewport.height);
  assert.deepEqual(errors,[]);await page.screenshot({path:`/tmp/agora-agent-panel-${viewport.width}.png`});await page.getByRole('button',{name:'닫기',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);
  const launcher=await page.getByRole('button',{name:'AI 에이전트',exact:true}).boundingBox(),summary=await page.locator('.board-topline').boundingBox();assert(launcher.y+launcher.height<summary.y,'Launcher must not overlap bottom summary');await page.screenshot({path:`/tmp/agora-agent-launcher-${viewport.width}.png`});
  await page.getByRole('button',{name:'AI 에이전트',exact:true}).click();assert.equal(await page.getByLabel('추론 수준',{exact:true}).inputValue(),'high');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.canvas-agent-panel').evaluate(el=>getComputedStyle(el).animationName),'none');await page.close();
 }
 console.log('PASS: consent, Claude options, graph review and desktop/mobile layout');
}finally{await browser.close();}
