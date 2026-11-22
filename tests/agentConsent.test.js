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
  // Another provider or another account on the same browser must consent separately.
  assert.equal(hasAgentConsent(7, 'gemini'), false);
  assert.equal(hasAgentConsent(8, 'anthropic'), false);
  // A run without a provider uses the default provider.
  assert.throws(() => requireAgentConsent(7, 'run', {}));
  // Consent from an older version asks again.
  data.set('agora-agent-consent-v1', JSON.stringify({ '7:openai': '2000-01-01' }));
  assert.equal(hasAgentConsent(7, 'openai'), false);
  revokeAgentConsent(7, 'anthropic');
  assert.equal(hasAgentConsent(7, 'anthropic'), false);
  assert.ok(AGENT_CONSENT_VERSION);
});
