const MONACO_CONTROLS = '.monaco-editor, .monaco-menu-container, .context-view, .monaco-hover, .suggest-widget, .parameter-hints-widget, .overflowingContentWidgets, .overflowingOverlayWidgets, .monaco-dialog-box';

export function isMonacoControl(target) {
  return Boolean(target instanceof Element && target.closest(MONACO_CONTROLS));
}

/** Monaco's editable surface contains spans, divs and canvases, not just inputs. */
export function isInternalEditorPointer(editor, event) {
  if (!editor) return false;
  const popupOwner = event.target instanceof Element && event.target.closest('[data-text-selection-owner]')?.dataset.textSelectionOwner;
  if (popupOwner && [editor.closest?.('[data-text-selection-editor]'), ...(editor.querySelectorAll?.('[data-text-selection-editor]') || [])]
    .some(element => element?.dataset.textSelectionEditor === popupOwner)) return true;
  return (event.target instanceof Node && editor.contains(event.target))
    || Boolean(event.composedPath?.().includes(editor))
    || isMonacoControl(event.target);
}
