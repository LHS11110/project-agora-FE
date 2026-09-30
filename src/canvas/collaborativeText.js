export function textSpliceBetween(previousValue, nextValue) {
  const previous = String(previousValue ?? '');
  const next = String(nextValue ?? '');
  let start = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) start += 1;
  let suffix = 0;
  while (suffix < previous.length - start && suffix < next.length - start
    && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix += 1;
  return {
    index: start,
    deleteCount: previous.length - start - suffix,
    insertText: next.slice(start, next.length - suffix),
  };
}

export function moveTextPosition(position, change) {
  const end = change.index + change.deleteCount;
  if (position <= change.index) return position;
  if (position >= end) return position + change.insertText.length - change.deleteCount;
  return change.index + change.insertText.length;
}
