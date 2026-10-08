import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function client(env) {
  const source = (await readFile(new URL('../src/api/client.js', import.meta.url), 'utf8')).replaceAll('import.meta.env', JSON.stringify(env));
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

test('Docker development uses the current browser origin including custom port and HTTPS', async () => {
  globalThis.window = { location: { protocol: 'https:', hostname: 'agora.example.com', host: 'agora.example.com:4443' } };
  const api = await client({ DEV: true, VITE_CPP_WS_HOST: '', VITE_WS_BASE_URL: '' });
  assert.equal(api.canvasSocketUrl(42, 8002, 'a b'), 'wss://agora.example.com:4443/wss/port/8002/canvas/42?token=a%20b');
  assert.equal(api.rtcSocketUrl(42, 8002, 'token'), 'wss://agora.example.com:4443/wss/port/8002/rtc/canvas/42?token=token');
});

test('explicit local host and public WebSocket origins remain supported', async () => {
  globalThis.window = { location: { protocol: 'http:', hostname: 'localhost', host: 'localhost:5173' } };
  const direct = await client({ DEV: true, VITE_CPP_WS_HOST: '127.0.0.1' });
  assert.equal(direct.canvasSocketUrl(42, 8002, 'token'), 'ws://127.0.0.1:8002/ws/canvas/42?token=token');
  const explicit = await client({ DEV: true, VITE_WS_BASE_URL: 'wss://other.example.com/' });
  assert.equal(explicit.rtcSocketUrl(42, 8002, 'token'), 'wss://other.example.com/wss/port/8002/rtc/canvas/42?token=token');
});
