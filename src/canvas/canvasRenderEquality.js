import { textColorRanges } from './content/textColors.js';
export function renderValueEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (a.kind === 'text' && b.kind === 'text' && (a.automerge_snapshot !== b.automerge_snapshot || a.automerge_changes !== b.automerge_changes)
    && !renderValueEqual(textColorRanges(a), textColorRanges(b))) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value,index) => renderValueEqual(value,b[index]));
  }
  const keys = Object.keys(a).filter(key => !key.startsWith('automerge_'));
  const other = Object.keys(b).filter(key => !key.startsWith('automerge_'));
  return keys.length === other.length && keys.every(key => Object.hasOwn(b,key) && renderValueEqual(a[key],b[key]));
}

export function canvasObjectPropsEqual(previous, next) {
  const keys = Object.keys(next);
  return keys.length === Object.keys(previous).length && keys.every(key =>
    typeof next[key] === 'function' ? previous[key] === next[key] : renderValueEqual(previous[key],next[key]));
}
