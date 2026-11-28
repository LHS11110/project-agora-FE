import test from 'node:test';
import assert from 'node:assert/strict';
import { agentProvider, normalizeAgentPreferences, modelOptions } from '../src/components/agentPreferences.js';

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
  assert.equal(options.provider, 'local');
});

test('saved cloud providers and model names resolve to the supported local model', () => {
  const saved = normalizeAgentPreferences({ provider: 'anthropic', model: 'claude-sonnet-5-5' });
  assert.equal(saved.provider, 'local');
  assert.equal(saved.model, '');
  assert.equal(agentProvider('gemini').defaultModel, 'gemma4:12b');
  assert.equal(modelOptions(normalizeAgentPreferences({ model: 'gemma4:12b' })).model, 'gemma4:12b');
});
