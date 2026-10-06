// Let an editor scroll its own content while ordinary objects remain transparent to navigation.
export function editorCanScroll(event) {
  const editor = event.target.closest?.('textarea, [contenteditable="true"]');
  if (!editor || event.ctrlKey || event.metaKey) return false;
  const vertical = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
  const delta = vertical ? event.deltaY : event.deltaX;
  const offset = vertical ? editor.scrollTop : editor.scrollLeft;
  const limit = vertical ? editor.scrollHeight - editor.clientHeight : editor.scrollWidth - editor.clientWidth;
  return limit > 1 && (delta < 0 ? offset > 0 : delta > 0 && offset < limit - 1);
}
