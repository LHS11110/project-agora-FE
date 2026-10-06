import { createId } from './canvasIds.js';

/** Bound batch size to the server's envelope limit and WebSocket payload budget. */
export function sendStrokeBatches(socket, entries, onSent) {
  let batch = [];
  let bytes = 0;
  const flush = () => {
    if (!batch.length) return;
    socket.send(JSON.stringify({ type: 'item_batch', request_id: createId(), changes: batch.map(entry => entry.payload) }));
    batch.forEach(onSent);
    batch = [];
    bytes = 0;
  };
  for (const entry of entries) {
    const length = new TextEncoder().encode(JSON.stringify(entry.payload)).length;
    if (batch.length && (batch.length >= 512 || bytes + length > 4 * 1024 * 1024)) flush();
    batch.push(entry);
    bytes += length;
  }
  flush();
}
