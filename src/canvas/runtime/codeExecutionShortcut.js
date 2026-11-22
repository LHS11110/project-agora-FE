import { isBlueprintCode } from './blueprintGraph.js';
import { isAgentCanvasObject, isAgentRunnableItem } from '../agents/agentCanvasModel.js';

/** Consume Shift+Enter for one selected code cell, blueprint executor, or runnable agent node. */
export function selectedRunnableForShortcut(event, selectedIds, items, editingId=null) {
  if(event.defaultPrevented||event.isComposing||event.keyCode===229||event.key!=='Enter'||!event.shiftKey||event.ctrlKey||event.metaKey||event.altKey)return null;
  if(selectedIds.length!==1)return null;
  const id=String(selectedIds[0]);
  const runnableAgent=isAgentRunnableItem(items[id]);
  const executor=!isAgentCanvasObject(items[id])&&items[id]?.kind==='shape'&&items[id]?.runtimeRole==='executor';
  if((!executor&&!runnableAgent&&!isBlueprintCode(items[id]))||(editingId!=null&&(executor||runnableAgent||String(editingId)!==id)))return null;
  const target=event.target;
  if(target?.closest?.('[role="dialog"], [role="menu"], .canvas-as-code-overlay, .canvas-management-dialog, .runtime-settings-overlay'))return null;
  if((executor||runnableAgent)&&target?.closest?.('[data-blueprint-run],[data-agent-run]')?.closest?.('[data-item-id]')?.dataset.itemId===id)return id;
  if(target?.closest?.('.canvas-code-editor'))return target.closest('[data-item-id]')?.dataset.itemId===id?id:null;
  if(target?.isContentEditable||target?.closest?.('input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),[role="textbox"],.monaco-editor'))return null;
  return id;
}

// Backwards-compatible name for existing integrations.
export const selectedCodeForShortcut=selectedRunnableForShortcut;
