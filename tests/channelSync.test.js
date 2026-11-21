import test from 'node:test';
import assert from 'node:assert/strict';
import { itemOperations } from '../src/canvas/host/hostOperations.js';
import { newCategory, newChannel } from '../src/canvas/channels/channelModel.js';

// Channel fields must reach the server; the field whitelist once dropped them,
// so created channels arrived without a type or name and were never listed.
test('channel and category creates carry their channel fields', () => {
  const channel = newChannel('text', '기획', ['default'], 1, 'category-1');
  const category = newCategory('팀', ['default'], 2);
  const operations = itemOperations({}, { c: channel, k: category }, new Map(), ['c', 'k']);
  const byId = Object.fromEntries(operations.map(operation => [operation.id, operation.patch]));
  assert.deepEqual(
    (({ kind, channelType, name, order, categoryId }) => ({ kind, channelType, name, order, categoryId }))(byId.c),
    { kind: 'channel', channelType: 'text', name: '기획', order: 1, categoryId: 'category-1' });
  assert.equal(byId.k.channelType, 'category');
  assert.equal(byId.k.name, '팀');
});

test('moving a channel out of a category unsets categoryId', () => {
  const before = newChannel('voice', '회의', ['default'], 1, 'category-1');
  const after = { ...before }; delete after.categoryId;
  const [operation] = itemOperations({ v: before }, { v: after }, new Map(), ['v']);
  assert.deepEqual(operation.unset, ['categoryId']);
});
