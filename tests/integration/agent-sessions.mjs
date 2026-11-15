import {chromium} from '/tmp/agora-ui-verify/node_modules/playwright-core/index.mjs';import assert from 'node:assert/strict';
async function choose(page,id){await page.getByRole('button',{name:'대화 세션',exact:true}).click();await page.locator(`[data-session-id="${id}"]`).click();}
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const context=await browser.newContext({ignoreHTTPSErrors:true});const first=await context.newPage();const errors=[];first.on('pageerror',e=>errors.push(e.message));
 await first.goto('https://127.0.0.1:5191/tests/browser/agent-panel.html');const input=first.getByLabel('에이전트에게 요청');await first.waitForFunction(()=>!document.querySelector('textarea[aria-label="에이전트에게 요청"]').disabled);
 const initial=await first.getByRole('button',{name:'대화 세션',exact:true}).getAttribute('data-active-id');await input.fill('429에도 이 프롬프트는 그대로 남아야 합니다');await first.evaluate(()=>window.agentFixture.failNext429=true);await first.getByRole('button',{name:/보내기/}).click();
 await first.waitForFunction(()=>document.querySelector('textarea[aria-label="에이전트에게 요청"]').value==='429에도 이 프롬프트는 그대로 남아야 합니다');await first.waitForFunction(()=>!document.querySelector('textarea[aria-label="에이전트에게 요청"]').disabled);
 const stored=await first.evaluate(()=>window.agentFixture.read());assert.notEqual(stored.drafts[7],initial);assert.equal(stored.sessions[initial].status,'failed');assert.equal(stored.sessions[initial].messages[0].content,'429에도 이 프롬프트는 그대로 남아야 합니다');assert.equal(Object.values(stored.sessions).filter(s=>s.owner_id===7&&s.status==='draft').length,1);
 await input.fill('');await first.getByRole('button',{name:'이 프롬프트 다시 사용'}).first().click();assert.equal(await input.inputValue(),'429에도 이 프롬프트는 그대로 남아야 합니다');
 await first.getByRole('button',{name:/보내기/}).click();await first.getByText('코드를 수정했습니다. 객체 ID: code-a').waitFor();await first.waitForFunction(()=>!document.querySelector('textarea[aria-label="에이전트에게 요청"]').disabled);assert.equal(await input.inputValue(),'');
 // Simulate a first page that omits an already opened session (pagination
 // or a stale list arriving during the draft switch).
 await first.evaluate(id=>window.agentFixture.omitSession=id,initial);
 await first.getByRole('button',{name:'새 대화',exact:true}).click();
 await first.waitForFunction(()=>document.querySelector('button[aria-label="대화 세션"]').dataset.activeId!==window.agentFixture.read().index[0]);
 await first.waitForTimeout(300);
 await first.getByRole('button',{name:'대화 세션',exact:true}).click();assert(await first.locator(`[data-session-id="${initial}"]`).count(),'previous session remains available after switching to the draft');await first.getByRole('button',{name:'대화 세션',exact:true}).click();
 await choose(first,initial);
 await first.getByText('코드를 수정했습니다. 객체 ID: code-a').waitFor();
 await first.evaluate(()=>window.agentFixture.omitSession=null);
 const peer=await context.newPage();peer.on('pageerror',e=>errors.push(e.message));await peer.goto('https://127.0.0.1:5191/tests/browser/agent-panel.html?user=8');await choose(peer,initial);await peer.getByText('코드를 수정했습니다. 객체 ID: code-a').waitFor();assert(await peer.getByLabel('에이전트에게 요청').isDisabled());
 await peer.getByRole('button',{name:'이 프롬프트 다시 사용'}).first().click();await peer.waitForFunction(()=>!document.querySelector('textarea[aria-label="에이전트에게 요청"]').disabled);assert.equal(await peer.getByLabel('에이전트에게 요청').inputValue(),'429에도 이 프롬프트는 그대로 남아야 합니다');assert.equal(await peer.getByRole('button',{name:'대화 세션',exact:true}).getAttribute('data-active-id'),stored.drafts[8]);
 await first.reload();await choose(first,initial);await first.getByText('코드를 수정했습니다. 객체 ID: code-a').waitFor();assert.deepEqual(errors,[]);
 console.log('PASS: 429 restores exact prompt, reuse only copies input, one empty draft per user, first prompt allocates next draft, shared read-only history and reload persistence');await context.close();
}finally{await browser.close();}
