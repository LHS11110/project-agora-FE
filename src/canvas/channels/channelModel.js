import { createId } from '../canvasIds.js';

// Chat and call channels are canvas items without a visual footprint, like the
// portfolio item. A text channel's messages are that item's comment thread, so
// the server applies the item's permission groups to reading and writing.
// The pre-existing room ("general") stays the built-in default text channel,
// and "general" is the default call channel (older clients always use it).
export const CHANNEL_KIND = 'channel';
export const DEFAULT_TEXT_CHANNEL = 'general';
export const DEFAULT_VOICE_CHANNEL = 'general';
export const CHANNEL_NAME_LIMIT = 50;
export const CHANNEL_LIMIT = 50;

export const isChannelItem = item => Boolean(item && item.kind === CHANNEL_KIND && (item.channelType === 'text' || item.channelType === 'voice'));

export function normalizeChannelName(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, CHANNEL_NAME_LIMIT);
}

export function validChannel(item) {
  return isChannelItem(item)
    && typeof item.name === 'string' && item.name.length > 0 && item.name.length <= CHANNEL_NAME_LIMIT && item.name === normalizeChannelName(item.name)
    && Number.isFinite(item.order);
}

/** Channels of one type, default first, then by order and name. */
export function listChannels(items, type, defaultName) {
  const custom = Object.entries(items || {})
    .filter(([, item]) => validChannel(item) && item.channelType === type)
    .map(([id, item]) => ({ id, name: item.name, order: item.order, item }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return [{ id: type === 'text' ? DEFAULT_TEXT_CHANNEL : DEFAULT_VOICE_CHANNEL, name: defaultName, order: -Infinity, item: null, builtIn: true }, ...custom];
}

export function newChannelId() {
  return `channel-${createId()}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 96);
}

export function newChannel(type, name, permission, order) {
  return { kind: CHANNEL_KIND, channelType: type, name: normalizeChannelName(name), order, permission, x: 0, y: 0, width: 0.01, height: 0.01 };
}

export function nextChannelOrder(channels) {
  return channels.reduce((max, channel) => Number.isFinite(channel.order) ? Math.max(max, channel.order) : max, 0) + 1;
}

/** History/compose payload fields that address a text channel. */
export function chatTarget(channelId) {
  return channelId && channelId !== DEFAULT_TEXT_CHANNEL ? { room_id: DEFAULT_TEXT_CHANNEL, object_id: channelId } : { room_id: DEFAULT_TEXT_CHANNEL };
}
