import { createId } from '../canvasIds.js';

// Chat channels, call channels, and channel categories are canvas items without
// a visual footprint, like the portfolio item. A text channel's messages are
// that item's comment thread, so the server applies the item's permission groups
// to reading and writing. The pre-existing room ("general") stays the built-in
// default text channel, and "general" is the default call channel (older
// clients always use it).
export const CHANNEL_KIND = 'channel';
export const CATEGORY_TYPE = 'category';
export const DEFAULT_TEXT_CHANNEL = 'general';
export const DEFAULT_VOICE_CHANNEL = 'general';
export const CHANNEL_NAME_LIMIT = 50;
export const CHANNEL_LIMIT = 50;
export const CATEGORY_LIMIT = 50;

export const isChannelItem = item => Boolean(item && item.kind === CHANNEL_KIND && (item.channelType === 'text' || item.channelType === 'voice'));
export const isCategoryItem = item => Boolean(item && item.kind === CHANNEL_KIND && item.channelType === CATEGORY_TYPE);
export const isChannelRecord = item => isChannelItem(item) || isCategoryItem(item);

export function normalizeChannelName(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, CHANNEL_NAME_LIMIT);
}

export function validChannel(item) {
  return isChannelItem(item)
    && typeof item.name === 'string' && item.name.length > 0 && item.name.length <= CHANNEL_NAME_LIMIT && item.name === normalizeChannelName(item.name)
    && Number.isFinite(item.order);
}

export function validCategory(item) {
  return isCategoryItem(item)
    && typeof item.name === 'string' && item.name.length > 0 && item.name.length <= CHANNEL_NAME_LIMIT && item.name === normalizeChannelName(item.name)
    && Number.isFinite(item.order);
}

/** Valid channel categories sorted by order, name, then id. */
export function listCategories(items) {
  return Object.entries(items || {})
    .filter(([, item]) => validCategory(item))
    .map(([id, item]) => ({ id, name: item.name, order: item.order, item }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** Channels of one type, default first, then by order and name. */
export function listChannels(items, type, defaultName) {
  const source = items || {};
  const custom = Object.entries(source)
    .filter(([, item]) => validChannel(item) && item.channelType === type)
    .map(([id, item]) => {
      const categoryId = typeof item.categoryId === 'string' && validCategory(source[item.categoryId])
        ? item.categoryId
        : null;
      return { id, name: item.name, order: item.order, categoryId, item };
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return [{ id: type === 'text' ? DEFAULT_TEXT_CHANNEL : DEFAULT_VOICE_CHANNEL, name: defaultName, order: -Infinity, categoryId: null, item: null, builtIn: true }, ...custom];
}

/** Groups a channel list into uncategorized channels and ordered category sections. */
export function groupChannelsByCategory(channels, categories = []) {
  const categoryIds = new Set(categories.map(category => category.id));
  const byCategory = new Map(categories.map(category => [category.id, []]));
  const uncategorized = [];
  for (const channel of channels || []) {
    if (channel.categoryId && categoryIds.has(channel.categoryId)) {
      byCategory.get(channel.categoryId).push(channel);
    } else {
      uncategorized.push(channel);
    }
  }
  const sections = categories.map(category => ({
    category,
    channels: byCategory.get(category.id) || [],
  }));
  return { uncategorized, sections };
}

export function newChannelId() {
  return `channel-${createId()}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 96);
}

export function newCategoryId() {
  return `category-${createId()}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 96);
}

export function newChannel(type, name, permission, order, categoryId = null) {
  return {
    kind: CHANNEL_KIND,
    channelType: type,
    name: normalizeChannelName(name),
    order,
    ...(typeof categoryId === 'string' && categoryId ? { categoryId } : {}),
    permission,
    x: 0,
    y: 0,
    width: 0.01,
    height: 0.01,
  };
}

export function newCategory(name, permission, order) {
  return {
    kind: CHANNEL_KIND,
    channelType: CATEGORY_TYPE,
    name: normalizeChannelName(name),
    order,
    permission,
    x: 0,
    y: 0,
    width: 0.01,
    height: 0.01,
  };
}

export function nextChannelOrder(entries) {
  return (entries || []).reduce((max, entry) => Number.isFinite(entry.order) ? Math.max(max, entry.order) : max, 0) + 1;
}

/**
 * Computes item patches to move a custom channel to a target category
 * (null = uncategorized) and optionally place it before targetChannelId.
 */
export function moveChannelPatch(items, channelId, targetCategoryId = null, targetChannelId = null) {
  const source = items || {};
  const moved = source[channelId];
  if (!validChannel(moved)) return null;
  const resolvedCategoryId = typeof targetCategoryId === 'string' && validCategory(source[targetCategoryId])
    ? targetCategoryId
    : null;
  const siblings = Object.entries(source)
    .filter(([id, item]) => id !== channelId && validChannel(item) && item.channelType === moved.channelType)
    .map(([id, item]) => ({
      id,
      item,
      categoryId: typeof item.categoryId === 'string' && validCategory(source[item.categoryId]) ? item.categoryId : null,
    }))
    .filter(entry => entry.categoryId === resolvedCategoryId)
    .sort((a, b) => a.item.order - b.item.order || a.item.name.localeCompare(b.item.name) || a.id.localeCompare(b.id));

  let insertAt = siblings.length;
  if (targetChannelId) {
    const targetIndex = siblings.findIndex(entry => entry.id === targetChannelId);
    if (targetIndex >= 0) insertAt = targetIndex;
  }
  const ordered = [
    ...siblings.slice(0, insertAt),
    { id: channelId, item: moved, categoryId: resolvedCategoryId },
    ...siblings.slice(insertAt),
  ];

  const patches = {};
  ordered.forEach((entry, index) => {
    const nextOrder = index + 1;
    const nextItem = { ...entry.item, order: nextOrder };
    if (resolvedCategoryId) nextItem.categoryId = resolvedCategoryId;
    else delete nextItem.categoryId;
    const prevCategoryId = typeof entry.item.categoryId === 'string' && validCategory(source[entry.item.categoryId])
      ? entry.item.categoryId
      : null;
    if (entry.id === channelId || entry.item.order !== nextOrder || prevCategoryId !== resolvedCategoryId) {
      patches[entry.id] = nextItem;
    }
  });
  return patches;
}

/** Computes item patches to reorder a category before targetCategoryId. */
export function reorderCategoryPatch(items, categoryId, targetCategoryId) {
  const source = items || {};
  if (!categoryId || categoryId === targetCategoryId || !validCategory(source[categoryId])) return null;
  const categories = listCategories(source).filter(category => category.id !== categoryId);
  const targetIndex = targetCategoryId ? categories.findIndex(category => category.id === targetCategoryId) : -1;
  const insertAt = targetIndex >= 0 ? targetIndex : categories.length;
  const moved = { id: categoryId, item: source[categoryId] };
  const ordered = [...categories.slice(0, insertAt), moved, ...categories.slice(insertAt)];
  const patches = {};
  ordered.forEach((entry, index) => {
    const nextOrder = index + 1;
    if (entry.item.order !== nextOrder) {
      patches[entry.id] = { ...entry.item, order: nextOrder };
    }
  });
  return patches;
}

/** History/compose payload fields that address a text channel. */
export function chatTarget(channelId) {
  return channelId && channelId !== DEFAULT_TEXT_CHANNEL ? { room_id: DEFAULT_TEXT_CHANNEL, object_id: channelId } : { room_id: DEFAULT_TEXT_CHANNEL };
}
