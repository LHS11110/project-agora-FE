import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenExpired, isCurrentAccountFailure } from '../src/state/authSession.js';
const token = payload => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
test('expired and malformed persisted tokens are rejected before profile requests', () => {
  assert.equal(tokenExpired(token({ exp: 1000 }), 1000000), true);
  assert.equal(tokenExpired(token({ exp: 1001 }), 1000000), false);
  for (const value of ['', 'broken', 'a.b.c', token({})]) assert.equal(tokenExpired(value), true);
});
test('late 401 and canvas access token failures cannot clear a newer account session', () => {
  assert.equal(isCurrentAccountFailure('new-account', 'old-account'), false);
  assert.equal(isCurrentAccountFailure('account', 'canvas-access'), false);
  assert.equal(isCurrentAccountFailure(null, 'old-account'), false);
  assert.equal(isCurrentAccountFailure('account', 'account'), true);
});
