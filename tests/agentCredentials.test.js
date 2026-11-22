import test from 'node:test';
import assert from 'node:assert/strict';
import { purgeAgentKeys } from '../src/components/agentCredentials.js';

test('removed canvas agent credentials are purged from the tab', () => {
  const data = new Map([
    ['agora-agent-api-key:openai', 'legacy-key'],
    ['agora-agent-api-key:anthropic', 'legacy-key'],
    ['agora-agent-api-key:gemini', 'legacy-key'],
    ['agora-agent-cli-api-key:claude', 'legacy-key'],
    ['agora-agent-personal-api-key', 'legacy-key'],
    ['unrelated', 'kept'],
  ]);
  globalThis.sessionStorage = {
    removeItem: key => data.delete(key),
    key: index => [...data.keys()][index] ?? null,
    get length() { return data.size; },
  };
  purgeAgentKeys();
  assert.deepEqual([...data.keys()], ['unrelated']);
});
