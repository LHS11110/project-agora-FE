import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_CONSENT_VERSION, loadAgentTerms, requireAgentConsent, saveAgentDecision } from '../src/components/agentConsent.js';

test('agent decisions use the account API and require current terms', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://agora.example/api/users/agent-terms');
    if (options.method === 'PUT') {
      const decision = JSON.parse(options.body);
      assert.equal(decision.version, AGENT_CONSENT_VERSION);
      terms = { ...terms, ...decision };
    }
    return new Response(JSON.stringify(terms), { headers: { 'Content-Type': 'application/json' } });
  });
  globalThis.window = { location: { href: 'https://agora.example/canvases/7' } };
  t.after(() => { delete globalThis.window; });
  let terms = { version: 'agent-local-v1', body: 'terms', accepted: true };
  await assert.rejects(requireAgentConsent(undefined, 'run'), { code: 'AGENT_CONSENT_REQUIRED' });
  await requireAgentConsent(undefined, 'status');
  await saveAgentDecision(undefined, true);
  await requireAgentConsent(undefined, 'run');
  assert.equal((await loadAgentTerms()).accepted, true);
  await saveAgentDecision(undefined, false);
  await assert.rejects(requireAgentConsent(undefined, 'run'), { code: 'AGENT_CONSENT_REQUIRED' });
});
