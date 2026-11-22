import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canRemoveChannelGroup,
  chatTarget,
  groupChannelsByCategory,
  isCategoryItem,
  isChannelItem,
  listCategories,
  listChannels,
  moveChannelPatch,
  newCategory,
  newCategoryId,
  newChannel,
  newChannelId,
  nextChannelOrder,
  normalizeChannelGroupsForSave,
  normalizeChannelName,
  reorderCategoryPatch,
  resolveChannelGroupAccess,
  validCategory,
  validChannel,
} from '../src/canvas/channels/channelModel.js';
import { isDrawableCanvasItem } from '../src/canvas/drawableItems.js';
import { exportManifest } from '../src/canvas/asCode/manifest.js';
import en from '../src/i18n/en.js';

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

test('categories are listed by order, group text/voice channels, and deleted categories fall back to uncategorized', () => {
  const items = {
    cat2: newCategory('디자인', ['all'], 2),
    cat1: newCategory('개발', ['all'], 1),
    badCat: { kind: 'channel', channelType: 'category', name: '', order: 3 },
    t1: newChannel('text', '프론트엔드', ['all'], 1, 'cat1'),
    t2: newChannel('text', '자유', ['all'], 2, null),
    tOrphan: newChannel('text', '이전팀', ['all'], 3, 'deleted-cat'),
    v1: newChannel('voice', '데일리', ['all'], 1, 'cat1'),
  };

  assert.equal(isCategoryItem(items.cat1), true);
  assert.equal(isChannelItem(items.cat1), false);
  assert.equal(validCategory(items.cat1), true);
  assert.equal(validCategory(items.badCat), false);
  assert.match(newCategoryId(), /^category-[A-Za-z0-9_-]{1,87}$/);

  const categories = listCategories(items);
  assert.deepEqual(categories.map(c => c.id), ['cat1', 'cat2']);

  const textChannels = listChannels(items, 'text', '일반');
  assert.equal(textChannels.find(c => c.id === 't1')?.categoryId, 'cat1');
  assert.equal(textChannels.find(c => c.id === 'tOrphan')?.categoryId, null);

  const grouped = groupChannelsByCategory(textChannels, categories);
  assert.deepEqual(grouped.uncategorized.map(c => c.id), ['general', 't2', 'tOrphan']);
  assert.deepEqual(grouped.sections.map(s => [s.category.id, s.channels.map(c => c.id)]), [
    ['cat1', ['t1']],
    ['cat2', []],
  ]);

  const voiceGrouped = groupChannelsByCategory(listChannels(items, 'voice', '일반 통화'), categories);
  assert.deepEqual(voiceGrouped.sections[0].channels.map(c => c.id), ['v1']);
});

test('moveChannelPatch moves channels between categories and reorders within a category', () => {
  const items = {
    cat1: newCategory('개발', ['all'], 1),
    cat2: newCategory('디자인', ['all'], 2),
    a: newChannel('text', 'A', ['all'], 1, 'cat1'),
    b: newChannel('text', 'B', ['all'], 2, 'cat1'),
    c: newChannel('text', 'C', ['all'], 1, null),
  };

  // Move C into cat1 before B
  const moveIntoCat = moveChannelPatch(items, 'c', 'cat1', 'b');
  assert.equal(moveIntoCat.c.categoryId, 'cat1');
  const nextItems = { ...items, ...moveIntoCat };
  assert.deepEqual(
    groupChannelsByCategory(listChannels(nextItems, 'text', '일반'), listCategories(nextItems)).sections[0].channels.map(x => x.id),
    ['a', 'c', 'b'],
  );

  // Move A back to uncategorized
  const moveOut = moveChannelPatch(nextItems, 'a', null, null);
  assert.equal('categoryId' in moveOut.a, false);
  const afterMoveOut = { ...nextItems, ...moveOut };
  assert.deepEqual(
    groupChannelsByCategory(listChannels(afterMoveOut, 'text', '일반'), listCategories(afterMoveOut)).uncategorized.map(x => x.id),
    ['general', 'a'],
  );
});

test('reorderCategoryPatch reorders categories cleanly', () => {
  const items = {
    c1: newCategory('One', ['all'], 1),
    c2: newCategory('Two', ['all'], 2),
    c3: newCategory('Three', ['all'], 3),
  };
  const patch = reorderCategoryPatch(items, 'c3', 'c1');
  const updated = { ...items, ...patch };
  assert.deepEqual(listCategories(updated).map(c => c.id), ['c3', 'c1', 'c2']);
});

test('text channels address the item comment thread; the default keeps the legacy room', () => {
  assert.deepEqual(chatTarget('general'), { room_id: 'general' });
  assert.deepEqual(chatTarget('channel-x'), { room_id: 'general', object_id: 'channel-x' });
});

test('channel and category items are never drawn or exported as canvas code', () => {
  const channel = newChannel('voice', '회의', ['g'], 1);
  const category = newCategory('팀', ['g'], 1);
  assert.equal(isDrawableCanvasItem(channel), false);
  assert.equal(isDrawableCanvasItem(category), false);
  assert.deepEqual(Object.keys(exportManifest({ c: channel, cat: category }).items), []);
});

test('channel group access helpers enforce admin vs non-admin group selection rules', () => {
  const settings = {
    groups: { 'admin-group': [], engineering: [], design: [], viewer: [] },
    group_permissions: {
      engineering: { read: true, write: true, execute: false },
      design: { read: true, write: false, execute: false },
      viewer: { read: true, write: false, execute: false },
    },
  };

  const adminAccess = resolveChannelGroupAccess({
    settings,
    capabilities: { is_admin: true, groups: ['admin-group'], member_groups: ['admin-group'], write_groups: ['admin-group'] },
    defaultGroups: ['admin-group'],
  });
  assert.deepEqual(adminAccess.available, ['admin-group', 'design', 'engineering', 'viewer']);
  assert.deepEqual(adminAccess.initialGroups, ['admin-group']);
  assert.equal(canRemoveChannelGroup(['admin-group', 'design'], 'admin-group', adminAccess), true);
  assert.equal(canRemoveChannelGroup(['design'], 'design', adminAccess), false);
  assert.deepEqual(normalizeChannelGroupsForSave(['engineering', 'design'], adminAccess), ['design', 'engineering']);

  // Non-admin writer in engineering (write) and design (read-only) must keep one writable group
  // and cannot assign unrelated canvas groups (e.g. viewer) unless already present when editing.
  const writerAccess = resolveChannelGroupAccess({
    settings,
    capabilities: {
      is_admin: false,
      groups: ['engineering', 'design'],
      member_groups: ['engineering', 'design'],
      write_groups: ['engineering'],
    },
    defaultGroups: ['engineering', 'design'],
    existingGroups: ['viewer'],
  });
  assert.deepEqual(writerAccess.available, ['design', 'engineering', 'viewer']);
  assert.deepEqual(writerAccess.initialGroups, ['viewer']);
  assert.equal(canRemoveChannelGroup(['engineering', 'design'], 'engineering', writerAccess), false);
  assert.equal(canRemoveChannelGroup(['engineering', 'design'], 'design', writerAccess), true);
  assert.deepEqual(normalizeChannelGroupsForSave(['design'], writerAccess), []);
  assert.deepEqual(normalizeChannelGroupsForSave(['engineering', 'design'], writerAccess), ['design', 'engineering']);
});

test('channel creation and access group UI strings have English translations', () => {
  const keys = [
    '채널 유형',
    '음성 채널',
    '접속 허용 그룹',
    '전체 선택',
    '최소 하나 이상의 쓰기 가능 그룹이 필요합니다.',
    '선택한 그룹에 채널을 만들 권한이 없습니다.',
    '제한된 그룹 채널',
  ];
  for (const key of keys) {
    assert.ok(typeof en[key] === 'string' && en[key].length > 0, `Missing en translation for: ${key}`);
  }
});
