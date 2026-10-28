import * as Automerge from '@automerge/automerge/slim';
import { loadItemDoc } from '../host/hostOperations.js';

export const TEXT_COLOR_MARK = 'textColor';
const cache = new WeakMap();
const validColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

// Automerge's marks are anchored to characters, so inserts and concurrent
// edits cannot leave absolute offsets pointing at unrelated text.
export function colorRangesFromDoc(doc) {
  let offset = 0;
  return Automerge.spans(doc, ['content']).flatMap(span => {
    if (span.type !== 'text') return [];
    const start = offset; offset += span.value.length;
    const color = span.marks?.[TEXT_COLOR_MARK];
    return validColor(color) ? [{ start, end: offset, color }] : [];
  });
}

export function textColorRanges(item) {
  if (!item || item.kind !== 'text' || !item.automerge_snapshot) return [];
  if (cache.has(item)) return cache.get(item);
  let ranges = [];
  try { ranges = colorRangesFromDoc(loadItemDoc(item)); } catch { /* Preserve legacy text when its document cannot be read. */ }
  cache.set(item, ranges);
  return ranges;
}

export function applyTextColor(doc, start, end, color) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > doc.content.length || (color !== '' && !validColor(color))) return doc;
  return Automerge.change(doc, draft => {
    const range = { start, end, expand: 'none' };
    if (color) Automerge.mark(draft, ['content'], range, TEXT_COLOR_MARK, color);
    else Automerge.unmark(draft, ['content'], range, TEXT_COLOR_MARK);
  });
}

export function colorPieces(value, ranges, offset = 0) {
  const text = String(value ?? ''), end = offset + text.length;
  const pieces = []; let cursor = offset;
  for (const range of ranges || []) {
    if (range.end <= offset || range.start >= end) continue;
    const start = Math.max(cursor, range.start, offset), stop = Math.min(end, range.end);
    if (start > cursor) pieces.push({ text: text.slice(cursor - offset, start - offset) });
    if (stop > start) { pieces.push({ text: text.slice(start - offset, stop - offset), color: range.color }); cursor = stop; }
  }
  if (cursor < end) pieces.push({ text: text.slice(cursor - offset) });
  return pieces;
}
