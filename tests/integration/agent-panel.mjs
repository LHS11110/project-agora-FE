const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport,ignoreHTTPSErrors:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let accepted = false, failTerms = true;
  const version = 'agent-test-next-version';
  await page.route('**/api/users/agent-terms', async route => {
    if (failTerms) {
      failTerms = false;
      await route.fulfill({status:503,json:{message:'temporary failure'}});
      return;
    }
    if (route.request().method() === 'PUT') {
      const decision = route.request().postDataJSON();
      assert.equal(decision.version, version);
      accepted = decision.accepted;
    }
    await route.fulfill({json:{version:version,body:'DB에 저장된 약관 본문',accepted}});
  });
  await page.goto(new URL('/tests/browser/agent-panel.html?failStatus',process.env.AGENT_TEST_ORIGIN || 'https://127.0.0.1:5191').href);await page.getByRole('dialog').waitFor();
  const termsNotice = page.getByRole('alert').filter({hasText:'에이전트 약관 상태를 확인하지 못했습니다.'});
  await termsNotice.getByRole('button',{name:'다시 시도'}).click();
  const statusNotice = page.getByRole('alert').filter({hasText:'AI 에이전트에 연결하지 못했습니다.'});
  await statusNotice.getByRole('button',{name:'다시 시도'}).click();
  await statusNotice.waitFor({state:'hidden'});
  await page.getByText(`Agora AI 에이전트 이용약관 (${version})`,{exact:true}).click();
  await page.getByText('DB에 저장된 약관 본문',{exact:true}).waitFor();
  await page.locator('[name=agent-consent-terms]').check();
  assert.equal(await page.locator('[name=agent-consent-transfer]').count(),0);
  await page.getByRole('button',{name:'동의하고 사용'}).click();
  await page.waitForFunction(() => !document.querySelector('[name=agent-consent-terms]'));
  assert.equal(accepted,true);
  await page.goto(new URL('/tests/browser/agent-panel.html',page.url()).href);
  await page.getByRole('button',{name:'동의 철회',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'에이전트 설정',exact:true}).count(),0);
  assert.equal(await page.locator('[name=agent-api-key]').count(),0);
  const prompt = page.getByLabel('에이전트에게 요청');
  const editSetting=page.getByRole('checkbox',{name:'선택한 객체만 수정 허용'});
  assert.equal(await editSetting.isChecked(),false);
  await editSetting.check();
  await page.evaluate(()=>window.agentFixture.select({ids:['code-b'],writable:true}));
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('label')).find(label=>label.textContent==='선택한 객체만 수정 허용')?.querySelector('input').checked);
  await page.evaluate(()=>window.agentFixture.select({ids:['code-a'],writable:true}));
  await editSetting.check();
  await prompt.fill('선택한 객체의 제목을 바꿔줘');
  await prompt.press('Shift+Enter');
  assert.match(await prompt.inputValue(),/\n$/);
  await prompt.dispatchEvent('keydown',{key:'Enter',isComposing:true,bubbles:true});
  assert.equal(await page.evaluate(()=>window.agentCalls.some(call=>call.operation==='run')),false);
  await prompt.press('Enter');
  await page.getByText('코드를 수정했습니다. 객체 ID: code-a').waitFor();
  assert.equal(await editSetting.isChecked(),false);
  const run=await page.evaluate(()=>window.agentCalls.find(call=>call.message));
  for (const field of ['api_key','history','allow_delete','include_history']) {
    assert.equal(Object.hasOwn(run,field),false);
  }
  assert.deepEqual(run.options,{provider:'local',max_tokens:768,max_steps:4});
  assert.equal(run.consent_version,version);
  assert.deepEqual(run.selected_ids,['code-a']);
  assert.equal(run.confirmed_delete_id,undefined);
  assert.equal(run.confirmed_edit_id,'code-a');
  const deleteSetting=page.getByRole('checkbox',{name:'선택 객체 삭제 허용'});
  assert.equal(await deleteSetting.isChecked(),false);
  await deleteSetting.check();
  const deleteButton=page.getByRole('button',{name:'선택한 객체 삭제',exact:true});
  for(const selection of [{ids:[],writable:true},{ids:['code-a','code-b'],writable:true},{ids:['code-a'],writable:false}]){
    await page.evaluate(selection=>window.agentFixture.select(selection),selection);
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='선택한 객체 삭제')?.disabled);
  }
  assert.equal(await page.evaluate(()=>window.agentCalls.some(call=>call.confirmed_delete_id)),false);
  await page.evaluate(()=>window.agentFixture.select({ids:['code-a'],writable:true}));
  await page.getByLabel('에이전트에게 요청').fill('선택한 객체를 삭제해줘');
  await page.getByRole('button',{name:/보내기/,exact:false}).click();
  await page.waitForFunction(()=>window.agentCalls.some(call=>call.message==='선택한 객체를 삭제해줘'));
  assert.equal(await page.evaluate(()=>window.agentCalls.some(call=>call.confirmed_delete_id)),false);
  page.once('dialog',dialog=>dialog.dismiss());
  await deleteButton.click();
  assert.equal(await page.evaluate(()=>window.agentCalls.some(call=>call.confirmed_delete_id)),false);
  page.once('dialog',async dialog=>{
    assert.match(dialog.message(),/테스트 코드/);
    await dialog.accept();
  });
  await deleteButton.click();
  await page.waitForFunction(()=>window.agentCalls.some(call=>call.confirmed_delete_id==='code-a'));
  assert.equal(await deleteSetting.isChecked(),false);
  await page.getByText('확인한 객체를 삭제했습니다.',{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.agentFixture.objects),{'code-b':'다른 코드'});
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
  await page.getByRole('button',{name:'동의 철회',exact:true}).click();
  await page.locator('[name=agent-consent-terms]').waitFor();
  assert.equal(accepted,false);
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.canvas-agent-panel').evaluate(el=>getComputedStyle(el).animationName),'none');await page.close();
 }
 console.log('PASS: current consent, one-object deletion, graph review and desktop/mobile layout');
}finally{await browser.close();}
