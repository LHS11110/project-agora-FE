// Keep keyboard order and the visible dock in one place. Undo and the panel
// toggle retain their own actions and are not numbered drawing tools.
export const QUICK_DOCK_GROUPS=[['select','hand'],['pen','eraser','laser'],['note','shape','connect','text','table','chart','image']];
export const QUICK_DOCK_TOOLS=QUICK_DOCK_GROUPS.flat();
export const quickDockShortcut=index=>index<9?String(index+1):index===9?'0':`Shift+${index-9}`;
export function quickDockShortcutTool(event){
 if(event.isComposing||!(event.ctrlKey||event.metaKey)||event.altKey)return null;
 const code=String(event.code||''),match=/^(Digit|Numpad)([0-9])$/.exec(code);
 if(code&&!match)return null;
 if(match?.[1]==='Numpad'&&!/^\d$/.test(event.key||''))return null;
 const digit=match?Number(match[2]):/^\d$/.test(event.key||'')?Number(event.key):NaN;
 if(!Number.isInteger(digit))return null;
 const index=event.shiftKey?digit>=1&&digit<=2?9+digit:-1:digit===0?9:digit-1;
 return QUICK_DOCK_TOOLS[index]||null;
}
export function isQuickDockEditingTarget(target){
 return Boolean(target?.isContentEditable||target?.closest?.('input,textarea,select,[contenteditable="true"],.monaco-editor,[role="dialog"],[role="menu"],.canvas-as-code-overlay,.canvas-management-dialog'));
}
