/** Apply the latest stroke states without replacing unrelated canvas edits. */
export function applyStrokeFrame(items, frame) {
  const next = { ...items };
  for (const { id, payload } of frame) {
    if (payload.type === 'item_delete') delete next[id];
    else if (payload.type === 'item_update') next[id] = payload.item;
  }
  return next;
}
