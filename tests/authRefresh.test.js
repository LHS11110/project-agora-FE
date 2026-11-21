import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const token = payload => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.window = { location: { href: 'https://app.example/', host: 'app.example', protocol: 'https:' }, dispatchEvent() {} };

async function load() {
  const session = new URL(`../src/state/authSession.js?${Math.random()}`, import.meta.url).href;
  const transport = new URL('../src/api/canvasTransport.js', import.meta.url).href;
  const source = (await readFile(new URL('../src/api/client.js', import.meta.url), 'utf8'))
    .replaceAll('import.meta.env', '{}')
    .replaceAll("'./canvasTransport.js'", JSON.stringify(transport))
    .replaceAll("'../state/authSession.js'", JSON.stringify(session));
  return { client: await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`), session: await import(session) };
}

test('refresh sends the session header with cookies and stores the new access token', async () => {
  const { session } = await load();
  const calls = [];
  const next = token({ sid: 's', exp: Date.now() / 1000 + 900 });
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return json(200, { accessToken: next, user: { user_id: 1 } }); };
  const [a, b] = await Promise.all([session.refreshAccessToken(), session.refreshAccessToken()]);
  assert.equal(calls.length, 1, 'concurrent refreshes share one request');
  assert.equal(calls[0].url, 'https://app.example/api/auth/session/refresh');
  assert.equal(calls[0].init.credentials, 'include');
  assert.equal(calls[0].init.headers['X-Agora-Session'], '1');
  assert.equal(a.accessToken, next); assert.equal(b, a);
  assert.equal(session.currentAccessToken(token({ sid: 's', exp: 1 })), next);
});

test('a refresh that lost a cross-tab rotation race retries once; a dead session resolves to null', async () => {
  const { session } = await load();
  const responses = [json(401, { reason: 'REFRESH_RACE' }), json(200, { accessToken: token({ sid: 's', exp: 9e9 }) })];
  globalThis.fetch = async () => responses.shift();
  assert.ok((await session.refreshAccessToken()).accessToken);
  globalThis.fetch = async () => json(401, { reason: 'SESSION_REVOKED' });
  assert.equal(await session.refreshAccessToken(), null);
  globalThis.fetch = async () => json(503, {});
  await assert.rejects(session.refreshAccessToken());
});

test('api retries a 401 once with the refreshed token of the same session', async () => {
  const { client } = await load();
  const stale = token({ sid: 's', exp: Date.now() / 1000 + 900 }), fresh = token({ sid: 's', exp: Date.now() / 1000 + 1800 });
  const seen = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/api/auth/session/refresh')) return json(200, { accessToken: fresh });
    seen.push(init.headers.Authorization);
    return seen.length === 1 ? json(401, { reason: 'SESSION_EXPIRED' }) : json(200, { ok: true });
  };
  assert.deepEqual(await client.api('/api/canvases', { token: stale }), { ok: true });
  assert.deepEqual(seen, [`Bearer ${stale}`, `Bearer ${fresh}`]);
});

test('api reports the session as over when the refresh is rejected', async () => {
  const { client } = await load();
  const events = [];
  window.dispatchEvent = event => events.push(event.type);
  globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  globalThis.fetch = async url => String(url).endsWith('/api/auth/session/refresh') ? json(401, { reason: 'SESSION_REVOKED' }) : json(401, { reason: 'SESSION_REVOKED' });
  await assert.rejects(client.api('/api/canvases', { token: token({ sid: 's', exp: Date.now() / 1000 + 900 }) }), { status: 401 });
  assert.ok(events.includes('agora:unauthorized'));
});
