function legacyCopy(text) {
  const active = document.activeElement;
  const selection = window.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : [];
  const input = document.createElement('textarea');
  input.value = text; input.readOnly = true; input.tabIndex = -1;
  input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.append(input);
  try {
    input.focus({ preventScroll: true }); input.select();
    if (!document.execCommand('copy')) throw new Error('Copy failed');
  } finally {
    input.remove();
    if (active?.isConnected) active.focus?.({ preventScroll: true });
    if (selection) { selection.removeAllRanges(); ranges.forEach(range => selection.addRange(range)); }
  }
}

export async function copyCode(value) {
  const text = String(value ?? '');
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* Try the browser's local copy fallback. */ }
  }
  legacyCopy(text);
}
