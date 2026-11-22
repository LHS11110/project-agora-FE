import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAgentPreferences, modelOptions } from '../src/components/agentPreferences.js';

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

test('valid reasoning and token budgets survive normalization; context flags stay client-side', () => {
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
  assert.equal(value.includeHistory, false);
  assert.equal(modelOptions(value).includeHistory, undefined);
});

test('cli mode preferences validate cli_tool, cli_model, and single-line cli_command', () => {
  const cli = normalizeAgentPreferences({
    engine: 'cli',
    cli_tool: 'codex',
    cli_model: 'gpt-5-codex',
    cli_command: 'echo ignored',
    max_steps: 6,
  });
  assert.deepEqual(modelOptions(cli), {
    engine: 'cli',
    cli_tool: 'codex',
    max_steps: 6,
    cli_model: 'gpt-5-codex',
  });

  const custom = normalizeAgentPreferences({
    engine: 'cli',
    cli_tool: 'custom',
    cli_command: 'agora-canvas list && echo done',
  });
  assert.equal(modelOptions(custom).cli_command, 'agora-canvas list && echo done');

  const sanitized = normalizeAgentPreferences({
    engine: 'cli',
    cli_tool: 'unknown-tool',
    cli_model: 'bad\nmodel',
    cli_command: 'line1\nline2',
  });
  assert.equal(sanitized.cli_tool, 'claude');
  assert.equal(sanitized.cli_model, '');
  assert.equal(sanitized.cli_command, '');
});
