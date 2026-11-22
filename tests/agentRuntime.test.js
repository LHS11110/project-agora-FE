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
      agent: { message: '코드를 작성해줘', selected_ids: ['code-a'], anchor: { x: 1, y: 2 }, history: [], allow_delete: false },
      pendingRequests: pending,
      sendRaw: event => { sent = event; return true; },
    },
    output => outputs.push(output),
  );
  assert.equal(sent.type, 'runtime_execute');
  assert.equal(sent.action, 'agent');
  assert.deepEqual(sent.selected_ids, ['code-a']);
  assert.equal(sent.operation, 'run');
  assert.equal(sent.allow_delete, false);
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

test('cli_status and cli_install forward cli_tool and stream progress output', async () => {
  const pending = new Map(), outputs = [];
  let sent;
  const statusReq = executeCanvasCode({
    canvasId: '1',
    action: 'agent',
    operation: 'cli_status',
    sendRaw: event => { sent = event; return true; },
    pendingRequests: pending,
  });
  assert.equal(sent.operation, 'cli_status');
  settleRuntimeSocketResponse(pending, { type: 'runtime_result', request_id: sent.request_id, ok: true, result: { ready: true, engine: 'cli', tools: { claude: { installed: false } } } });
  assert.equal((await statusReq).tools.claude.installed, false);

  const installReq = executeCanvasCode(
    {
      canvasId: '1',
      action: 'agent',
      operation: 'cli_install',
      agent: { cli_tool: 'claude' },
      sendRaw: event => { sent = event; return true; },
      pendingRequests: pending,
    },
    output => outputs.push(output),
  );
  assert.equal(sent.operation, 'cli_install');
  assert.equal(sent.cli_tool, 'claude');
  settleRuntimeSocketResponse(pending, { type: 'runtime_output', request_id: sent.request_id, output: 'installing @anthropic-ai/claude-code' });
  settleRuntimeSocketResponse(pending, { type: 'runtime_result', request_id: sent.request_id, ok: true, result: { installed: true, tool: 'claude' } });
  assert.equal((await installReq).installed, true);
  assert.deepEqual(outputs, ['installing @anthropic-ai/claude-code']);
});

test('busy and cli agent errors explain the cause without losing error codes', async () => {
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

  const cliErr = executeCanvasCode({
    action: 'agent',
    agent: { message: 'test', options: { engine: 'cli', cli_tool: 'claude' } },
    pendingRequests: pending,
    sendRaw: event => { sent = event; return true; },
  });
  settleRuntimeSocketResponse(pending, { type: 'runtime_result', request_id: sent.request_id, ok: false, code: 'CLI_TOOL_NOT_INSTALLED' });
  await assert.rejects(cliErr, error => error.code === 'CLI_TOOL_NOT_INSTALLED' && error.message.includes('설치되어 있지 않습니다'));
});
