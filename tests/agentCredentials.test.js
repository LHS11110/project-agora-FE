import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadAgentKey,
  normalizeAgentKey,
  saveAgentKey,
} from '../src/components/agentCredentials.js';

test('personal agent credential uses tab session storage and can be cleared', () => {
  const data = new Map();
  globalThis.sessionStorage = {
    getItem: key => data.get(key) || null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
    key: index => [...data.keys()][index] ?? null,
    get length() { return data.size; },
  };
  globalThis.localStorage = {
    setItem: () => assert.fail('API key must not enter localStorage'),
  };

  assert.equal(saveAgentKey(' fixture-key ', 'openai'), 'fixture-key');
  assert.equal(loadAgentKey('openai'), 'fixture-key');
  saveAgentKey('', 'openai');
  assert.equal(loadAgentKey('openai'), '');
  assert.equal(data.size, 0);

  // Keys left by removed engines (VM CLI agents, EXAONE) are purged from the tab.
  data.set('agora-agent-cli-api-key:claude', 'sk-left-behind');
  data.set('agora-agent-personal-api-key', 'exaone-left-behind');
  data.set('unrelated', 'kept');
  assert.equal(loadAgentKey('openai'), '');
  assert.equal(data.has('agora-agent-cli-api-key:claude'), false);
  assert.equal(data.has('agora-agent-personal-api-key'), false);
  assert.equal(data.get('unrelated'), 'kept');

  // Keys are kept per provider.
  saveAgentKey('openai-key', 'openai');
  saveAgentKey('claude-key', 'anthropic');
  assert.equal(loadAgentKey('anthropic'), 'claude-key');
  assert.equal(loadAgentKey('gemini'), '');
  assert.equal(loadAgentKey('openai'), 'openai-key');
  saveAgentKey('', 'anthropic');
  assert.equal(loadAgentKey('anthropic'), '');
  assert.equal(loadAgentKey('openai'), 'openai-key');
});

test('malformed credentials cannot enter requests through saved preferences', () => {
  for (const value of ['a\nb', 'a b', '한글', 'a'.repeat(4097), null]) {
    assert.equal(normalizeAgentKey(value), '');
  }
});
