import { createId } from './canvasIds.js';

export const CHAT_ROOM_ID = 'general';
export const CHAT_HISTORY_LIMIT = 50;

export function toChatEntry(message, user) {
  const numericTimestamp = Number(message.created_at);
  const timestamp = Number.isFinite(numericTimestamp) && String(message.created_at ?? '').trim() !== ''
    ? new Date(numericTimestamp < 1e12 ? numericTimestamp * 1000 : numericTimestamp)
    : new Date(message.created_at || Date.now());
  const sequence = Number(message.sequence);
  const hasSequence = Number.isFinite(sequence) && sequence > 0;
  const nickname = message.sender || '알 수 없는 사용자';
  const tagNumber = message.tag_number;
  return {
    id: hasSequence ? `${CHAT_ROOM_ID}-${sequence}` : createId(),
    sequence: hasSequence ? sequence : null,
    sender: `${nickname}#${tagNumber ?? '?'}`,
    text: message.text || '',
    time: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
    own: nickname === user?.nickname && Number(tagNumber) === Number(user?.tag_number),
  };
}

export function mergeChatEntries(current, incoming) {
  const entries = new Map();
  for (const entry of [...current, ...incoming]) {
    entries.set(entry.sequence == null ? entry.id : `sequence-${entry.sequence}`, entry);
  }
  return [...entries.values()].sort((left, right) => {
    if (left.sequence == null) return 1;
    if (right.sequence == null) return -1;
    return left.sequence - right.sequence;
  });
}
