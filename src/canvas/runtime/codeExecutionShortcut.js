import { isBlueprintCode } from './blueprintGraph.js';

/** Consume only a single selected code object's Shift+Enter, including its inline editor. */
export function selectedCodeForShortcut(event, selectedIds, items, editingId=null) {
  if(event.defaultPrevented||event.isComposing||event.keyCode===229||event.key!=='Enter'||!event.shiftKey||event.ctrlKey||event.metaKey||event.altKey)return null;
  if(selectedIds.length!==1)return null;
  const id=String(selectedIds[0]);
  if(!isBlueprintCode(items[id])||(editingId!=null&&String(editingId)!==id))return null;
  const target=event.target;
  if(target?.closest?.('[role="dialog"], [role="menu"], .canvas-as-code-overlay, .canvas-management-dialog, .runtime-settings-overlay'))return null;
  if(target?.closest?.('.canvas-code-editor'))return target.closest('[data-item-id]')?.dataset.itemId===id?id:null;
  if(target?.isContentEditable||target?.closest?.('input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),[role="textbox"],.monaco-editor'))return null;
  return id;
}
