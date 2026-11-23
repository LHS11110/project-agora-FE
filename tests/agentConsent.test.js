import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_CONSENT_VERSION, hasAgentConsent, requireAgentConsent, revokeAgentConsent, saveAgentConsent } from '../src/components/agentConsent.js';

test('model runs require per-account, per-provider consent; status checks do not', () => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  };
  assert.throws(() => requireAgentConsent(7, 'run', { provider: 'anthropic' }), error => error.code === 'AGENT_CONSENT_REQUIRED');
  assert.doesNotThrow(() => requireAgentConsent(7, 'status', { provider: 'anthropic' }));
  saveAgentConsent(7, 'anthropic');
  assert.doesNotThrow(() => requireAgentConsent(7, 'run', { provider: 'anthropic' }));
  assert.equal(hasAgentConsent(8, 'anthropic'), false);
  assert.doesNotThrow(() => requireAgentConsent(7, 'run', {}));
  revokeAgentConsent(7, 'anthropic');
  data.set('agora-agent-consent-v1', JSON.stringify({ '7:anthropic': 'claude-prompt-v1' }));
  assert.equal(hasAgentConsent(7, 'anthropic'), false);
  assert.ok(AGENT_CONSENT_VERSION);
});
