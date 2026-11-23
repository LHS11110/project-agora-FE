import test from 'node:test';
import assert from 'node:assert/strict';
import { executeCanvasCode, settleRuntimeSocketResponse } from '../src/canvas/runtime/executeCanvasCode.js';

globalThis.window = { setTimeout, clearTimeout };

test('agent request uses existing websocket and routes streamed output and final result', async () => {
  const pending = new Map(), outputs = [];
  let sent;
  const result = executeCanvasCode(
    {
      canvasId: '1',
      action: 'agent',
      agent: { message: '코드를 작성해줘', selected_ids: ['code-a'], anchor: { x: 1, y: 2 }, history: [{ role: 'user', content: 'old prompt' }], allow_delete: true, api_key: 'legacy-key', consent_version: 'claude-prompt-v1' },
      pendingRequests: pending,
      sendRaw: event => { sent = event; return true; },
    },
    output => outputs.push(output),
  );
  assert.equal(sent.type, 'runtime_execute');
  assert.equal(sent.action, 'agent');
  assert.equal(sent.consent_version, 'claude-prompt-v1');
  for (const field of ['selected_ids', 'history', 'allow_delete', 'api_key']) {
    assert.equal(Object.hasOwn(sent, field), false);
  }
  assert.equal(sent.operation, 'run');
  assert.equal(sent.token, undefined);
  settleRuntimeSocketResponse(pending, { type: 'runtime_output', request_id: sent.request_id, output: '생성 중' });
  settleRuntimeSocketResponse(pending, { type: 'runtime_result', request_id: sent.request_id, ok: true, result: { answer: '완료' } });
  assert.deepEqual(await result, { answer: '완료' });
  assert.deepEqual(outputs, ['생성 중']);
  assert.equal(pending.size, 0);
});

test('agent status returns explicit missing-key readiness', async () => {
  const pending = new Map();
  let sent;
  const result = executeCanvasCode({
    action: 'agent',
    operation: 'status',
    sendRaw: event => { sent = event; return true; },
    pendingRequests: pending,
  });
  settleRuntimeSocketResponse(pending, { type: 'runtime_result', request_id: sent.request_id, ok: true, result: { ready: true, configured: false } });
  assert.equal((await result).configured, false);
});

test('busy errors explain the cause without losing error codes', async () => {
  const pending = new Map();
  let sent;
  const result = executeCanvasCode({
    action: 'agent',
    agent: { message: 'test' },
    pendingRequests: pending,
    sendRaw: event => { sent = event; return true; },
  });
  settleRuntimeSocketResponse(pending, { type: 'error', request_id: sent.request_id, code: 'AGENT_REQUEST_BUSY' });
  await assert.rejects(result, error => error.code === 'AGENT_REQUEST_BUSY' && error.message.includes('이 캔버스에서 AI 에이전트가 작업 중'));
  assert.equal(pending.size, 0);

});

test('an external key appears only in an explicit external run frame', async () => {
  const pending = new Map();
  const options = { provider: 'openrouter', model: 'anthropic/claude-approved' };
  for (const operation of ['run', 'status']) {
    let sent;
    const result = executeCanvasCode({
      action: 'agent', operation, pendingRequests: pending,
      agent: { message: 'test', api_key: 'sk-or-v1-test', options, endpoint: 'https://example.invalid' },
      sendRaw: event => { sent = event; return true; },
    });
    assert.equal(sent.api_key, operation === 'run' ? 'sk-or-v1-test' : undefined);
    assert.equal(sent.endpoint, undefined);
    assert.equal(sent.options.api_key, undefined);
    settleRuntimeSocketResponse(pending, { type: 'runtime_result', request_id: sent.request_id, ok: true, result: {} });
    await result;
  }
});
