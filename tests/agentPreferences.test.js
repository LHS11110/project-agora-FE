import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_PROVIDERS, agentProvider, normalizeAgentPreferences, modelOptions } from '../src/components/agentPreferences.js';

test('invalid stored options cannot override bounds or connection credentials', () => {
  const config = normalizeAgentPreferences({
    reasoning_effort: 'medium',
    max_steps: 100,
    max_tokens: NaN,
    top_p: -1,
    api_key: 'hidden',
  });
  assert.equal(config.reasoning_effort, 'low');
  assert.equal(config.max_steps, 8);
  assert.equal(config.max_tokens, 8192);
  assert.equal(config.engine, 'api');
  assert.equal(modelOptions(config).api_key, undefined);
});

test('valid reasoning and token budgets survive normalization; legacy context flags are dropped', () => {
  const value = normalizeAgentPreferences({
    reasoning_effort: 'max',
    max_tokens: 32768,
    max_steps: 12,
    temperature: 0,
    top_p: 0.1,
    includeHistory: false,
    attachSelection: false,
  });
  assert.equal(modelOptions(value).reasoning_effort, 'max');
  assert.equal(modelOptions(value).temperature, 0);
  assert.equal(value.includeHistory, undefined);
  assert.equal(modelOptions(value).includeHistory, undefined);
});

test('saved VM CLI preferences fall back to the API engine and never send CLI options', () => {
  const legacy = normalizeAgentPreferences({
    engine: 'cli',
    cli_tool: 'custom',
    cli_model: 'some-model',
    cli_command: 'agora-canvas list',
    max_steps: 6,
  });
  assert.equal(legacy.engine, 'api');
  assert.equal(legacy.max_steps, 6);
  const options = modelOptions(legacy);
  for (const name of ['engine', 'cli_tool', 'cli_model', 'cli_command', 'locale', 'api_key']) assert.equal(options[name], undefined, name);
  assert.deepEqual(Object.keys(options).sort(), ['max_steps', 'max_tokens', 'provider', 'reasoning_effort', 'temperature', 'top_p']);
  assert.equal(options.provider, 'anthropic');
});

test('provider and model preferences are normalized and sent as options', () => {
  const value = normalizeAgentPreferences({ provider: 'anthropic', model: ' claude-sonnet-5-5 ' });
  assert.equal(value.provider, 'anthropic');
  assert.equal(value.model, 'claude-sonnet-5-5');
  assert.deepEqual([modelOptions(value).provider, modelOptions(value).model], ['anthropic', 'claude-sonnet-5-5']);
  // Unknown providers fall back to the default; malformed model names are dropped.
  const invalid = normalizeAgentPreferences({ provider: 'https://evil.example', model: 'gpt 5; rm' });
  assert.equal(invalid.provider, 'anthropic');
  assert.equal(invalid.model, '');
  assert.equal('model' in modelOptions(invalid), false);
  assert.equal(agentProvider('gemini').id, 'anthropic');
});

test('EXAONE is not offered and saved EXAONE preferences move to the default provider', () => {
  // EXAONE API terms forbid integrating the API into products or services.
  assert.equal(AGENT_PROVIDERS.some(provider => provider.id === 'exaone'), false);
  assert.equal(normalizeAgentPreferences({ provider: 'exaone', model: 'k-exaone_v2.5' }).provider, 'anthropic');
  // Every provider links its terms and states its data use for the consent card.
  for (const provider of AGENT_PROVIDERS) {
    assert.match(provider.termsUrl, /^https:\/\//);
    assert.match(provider.policyUrl, /^https:\/\//);
    assert.ok(provider.dataNotice.length > 10);
  }
  assert.deepEqual(AGENT_PROVIDERS.map(provider => provider.id), ['anthropic']);
});
