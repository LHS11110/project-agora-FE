import { changeItems } from './itemSnapshots.js';

/** Apply the latest stroke states without replacing unrelated canvas edits. */
export function applyStrokeFrame(items, frame) {
  const updates = new Map(), removed = [];
  for (const { id, payload } of frame) {
    if (payload.type === 'item_delete') { updates.delete(id); removed.push(id); }
    else if (payload.type === 'item_update') updates.set(id, payload.item);
  }
  return changeItems(items, updates, removed.filter(id => !updates.has(id)));
}
