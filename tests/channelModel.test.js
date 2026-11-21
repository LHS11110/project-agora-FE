import test from 'node:test';
import assert from 'node:assert/strict';
import { chatTarget, listChannels, newChannel, newChannelId, nextChannelOrder, normalizeChannelName, validChannel } from '../src/canvas/channels/channelModel.js';
import { isDrawableCanvasItem } from '../src/canvas/drawableItems.js';
import { exportManifest } from '../src/canvas/asCode/manifest.js';

test('channels are listed per type after the built-in default, by order then name', () => {
  const items = {
    b: newChannel('text', '디자인', ['all'], 2), a: newChannel('text', '공지', ['all'], 1), v: newChannel('voice', '회의', ['all'], 1),
    bad: { kind: 'channel', channelType: 'text', name: '', order: 3 }, note: { kind: 'note', text: 'x' },
  };
  assert.deepEqual(listChannels(items, 'text', '일반').map(c => c.id), ['general', 'a', 'b']);
  assert.deepEqual(listChannels(items, 'voice', '일반 통화').map(c => c.id), ['general', 'v']);
  assert.equal(nextChannelOrder(listChannels(items, 'text', '일반')), 3);
});

test('channel names are normalized and bounded; ids are usable as broker call channels', () => {
  assert.equal(normalizeChannelName('  a   b  '), 'a b');
  assert.equal(normalizeChannelName('x'.repeat(80)).length, 50);
  assert.equal(validChannel(newChannel('text', ' ok ', ['g'], 1)), true);
  assert.equal(validChannel({ kind: 'channel', channelType: 'other', name: 'x', order: 1 }), false);
  assert.match(newChannelId(), /^channel-[A-Za-z0-9_-]{1,88}$/);
});

test('text channels address the item comment thread; the default keeps the legacy room', () => {
  assert.deepEqual(chatTarget('general'), { room_id: 'general' });
  assert.deepEqual(chatTarget('channel-x'), { room_id: 'general', object_id: 'channel-x' });
});

test('channel items are never drawn or exported as canvas code', () => {
  const channel = newChannel('voice', '회의', ['g'], 1);
  assert.equal(isDrawableCanvasItem(channel), false);
  assert.deepEqual(Object.keys(exportManifest({ c: channel }).items), []);
});
