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

test('only secure explicit origins are accepted', async () => {
  globalThis.window = { location: { protocol: 'https:', host: 'localhost:8443', href: 'https://localhost:8443/' } };
  const explicit = await client({ DEV: true, VITE_WS_BASE_URL: 'wss://other.example.com/' });
  assert.equal(explicit.rtcSocketUrl(42, 8002, 'token'), 'wss://other.example.com/wss/port/8002/rtc/canvas/42?token=token');
  assert.equal(explicit.apiUrl('/api/auth/me'), 'https://localhost:8443/api/auth/me');
  assert.throws(() => explicit.apiUrl('http://localhost:8080/api/auth/me'), /HTTPS/);
  const insecure = await client({ VITE_WS_BASE_URL: 'ws://localhost:4173', VITE_API_BASE_URL: 'http://localhost:8080' });
  assert.throws(() => insecure.canvasSocketUrl(42,8002,'token'), /WSS/);
  assert.throws(() => insecure.apiUrl('/api/auth/me'), /HTTPS/);
  globalThis.window.location = { protocol: 'http:', host: 'localhost:5173', href: 'http://localhost:5173/' };
  assert.throws(() => explicit.rtcSocketUrl(42,8002,'token'), /HTTPS/);
  const relative = await client({});
  assert.throws(() => relative.apiUrl('/api/auth/me'), /HTTPS/);
});
