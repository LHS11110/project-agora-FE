const MONACO_CONTROLS = '.monaco-menu-container, .context-view, .monaco-hover, .suggest-widget, .parameter-hints-widget';

export function isMonacoControl(target) {
  return Boolean(target instanceof Element && target.closest(MONACO_CONTROLS));
}

/** Monaco's editable surface contains spans, divs and canvases, not just inputs. */
export function isInternalEditorPointer(editor, event) {
  if (!editor) return false;
  return (event.target instanceof Node && editor.contains(event.target))
    || Boolean(event.composedPath?.().includes(editor))
    || isMonacoControl(event.target);
}
