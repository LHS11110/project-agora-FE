const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport,ignoreHTTPSErrors:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let accepted = false;
  await page.route('**/api/users/agent-terms', async route => {
    if (route.request().method() === 'PUT') {
      const decision = route.request().postDataJSON();
      assert.equal(decision.version, 'agent-local-v2');
      accepted = decision.accepted;
    }
    await route.fulfill({json:{version:'agent-local-v2',body:'DB에 저장된 약관 본문',accepted}});
  });
  await page.goto(new URL('/tests/browser/agent-panel.html',process.env.AGENT_TEST_ORIGIN || 'https://127.0.0.1:5191').href);await page.getByRole('dialog').waitFor();
  await page.getByText('Agora AI 에이전트 이용약관 (agent-local-v2)',{exact:true}).click();
  await page.getByText('DB에 저장된 약관 본문',{exact:true}).waitFor();
  await page.locator('[name=agent-consent-terms]').check();
  assert.equal(await page.locator('[name=agent-consent-transfer]').count(),0);
  await page.getByRole('button',{name:'동의하고 사용'}).click();
  await page.waitForFunction(() => !document.querySelector('[name=agent-consent-terms]'));
  assert.equal(accepted,true);
  await page.reload();
  await page.getByRole('button',{name:'에이전트 설정',exact:true}).click();
  await page.getByText('Agora AI 에이전트 이용약관에 동의함',{exact:true}).waitFor();
  assert.equal(await page.locator('[name=agent-api-key]').count(),0);
  await page.getByLabel('에이전트에게 요청').fill('회의 준비 메모를 추가해줘');
  await page.getByRole('button',{name:/보내기/,exact:false}).click();await page.getByText('코드를 수정했습니다. 객체 ID: code-a').waitFor();
  const run=await page.evaluate(()=>window.agentCalls.find(call=>call.message));
  for (const field of ['api_key','selected_ids','history','allow_delete','include_history']) {
    assert.equal(Object.hasOwn(run,field),false);
  }
  assert.deepEqual(run.options,{provider:'local',max_tokens:768,max_steps:1});
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
  await page.getByRole('button',{name:'AI 에이전트',exact:true}).click();assert.equal(await page.locator('[name=agent-consent-terms]').count(),0);
  const settings=page.getByRole('button',{name:'에이전트 설정',exact:true});
  if (await settings.getAttribute('aria-expanded') !== 'true') await settings.click();
  await page.getByRole('button',{name:'동의 철회',exact:true}).click();
  await page.locator('[name=agent-consent-terms]').waitFor();
  assert.equal(accepted,false);
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.canvas-agent-panel').evaluate(el=>getComputedStyle(el).animationName),'none');await page.close();
 }
 console.log('PASS: current consent, local-only model, graph review and desktop/mobile layout');
}finally{await browser.close();}
