import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentTerms, requireAgentConsent, saveAgentDecision } from '../src/components/agentConsent.js';

test('agent decisions use the account API and require current terms', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://agora.example/api/users/agent-terms');
    if (options.method === 'PUT') {
      const decision = JSON.parse(options.body);
      assert.equal(decision.version, terms.version);
      terms = { ...terms, ...decision };
    }
    return new Response(JSON.stringify(terms), { headers: { 'Content-Type': 'application/json' } });
  });
  globalThis.window = { location: { href: 'https://agora.example/canvases/7' } };
  t.after(() => { delete globalThis.window; });
  let terms = { version: 'agent-test-new-version', body: 'terms', accepted: false };
  await assert.rejects(requireAgentConsent(undefined, 'run'), { code: 'AGENT_CONSENT_REQUIRED' });
  await requireAgentConsent(undefined, 'status');
  await saveAgentDecision(undefined, terms.version, true);
  assert.equal(await requireAgentConsent(undefined, 'run'), terms.version);
  assert.equal((await loadAgentTerms()).accepted, true);
  await saveAgentDecision(undefined, terms.version, false);
  await assert.rejects(requireAgentConsent(undefined, 'run'), { code: 'AGENT_CONSENT_REQUIRED' });
  terms.version = '';
  await assert.rejects(loadAgentTerms());
});
