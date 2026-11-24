import test from 'node:test';
import assert from 'node:assert/strict';
import { installSocketCodec } from '../src/canvas/sync/socketCodec.js';
import { executeCanvasCode, rejectRuntimeSocketRequests, settleRuntimeSocketResponse } from '../src/canvas/runtime/executeCanvasCode.js';

test('a queued runtime result settles before the socket close rejects pending requests', async (t) => {
  let worker;
  class FakeWorker {
    constructor() { worker = this; }
    postMessage() {}
    terminate() { this.terminated = true; }
  }
  const previousWorker = globalThis.Worker;
  const previousWindow = globalThis.window;
  t.after(() => {
    globalThis.Worker = previousWorker;
    globalThis.window = previousWindow;
  });
  globalThis.Worker = FakeWorker;
  globalThis.window = { setTimeout, clearTimeout };

  const socket = new EventTarget();
  socket.readyState = 1;
  socket.send = () => {};
  installSocketCodec(socket);
  const pending = new Map();
  socket.onmessage = event => settleRuntimeSocketResponse(pending, event.data);
  socket.onclose = () => rejectRuntimeSocketRequests(pending);
  socket.addEventListener('close', event => socket.onclose(event));

  let requestId;
  const execution = executeCanvasCode({
    language: 'python',
    pendingRequests: pending,
    sendRaw: event => { requestId = event.request_id; return true; },
  });
  const result = { output: 'None\n'.repeat(13_107), exitCode: 1, truncated: true, environmentReset: true };
  const message = { type: 'runtime_result', request_id: requestId, ok: true, result };
  socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
  socket.readyState = 3;
  socket.dispatchEvent(new Event('close'));
  assert.equal(worker.terminated, undefined);
  worker.onmessage({ data: { type: 'decoded', message } });

  assert.deepEqual(await execution, result);
  assert.equal(worker.terminated, true);
  assert.equal(pending.size, 0);
});
