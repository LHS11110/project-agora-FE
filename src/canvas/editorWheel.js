// Let an editor scroll its own content while ordinary objects remain transparent to navigation.
export function editorCanScroll(event) {
  if (event.target.closest?.('.canvas-code-editor')) return true;
  // The stage listens in capture phase, before the result's bubbling handler.
  // Contain ordinary scrolling even at the ends so the canvas never drifts.
  if (!event.ctrlKey && !event.metaKey && event.target.closest?.('.blueprint-object.selected .blueprint-node-body')) return true;
  if (!event.ctrlKey && !event.metaKey && selectedScrollArea(event.target))return true;
  const editor = event.target.closest?.('textarea, [contenteditable="true"]');
  if (!editor || event.ctrlKey || event.metaKey) return false;
  const vertical = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
  const delta = vertical ? event.deltaY : event.deltaX;
  const offset = vertical ? editor.scrollTop : editor.scrollLeft;
  const limit = vertical ? editor.scrollHeight - editor.clientHeight : editor.scrollWidth - editor.clientWidth;
  return limit > 1 && (delta < 0 ? offset > 0 : delta > 0 && offset < limit - 1);
}

export function selectedScrollArea(target){
 const object=target.closest?.('.canvas-object.selected');
 if(!object)return null;
 for(let node=target;node&&node!==object.parentElement;node=node.parentElement){
  if(node.matches?.('.xterm, .xterm-viewport, .xterm-scrollable-element'))return node;
  const style=typeof getComputedStyle==='function'?getComputedStyle(node):null;
  if(style&&((/auto|scroll/.test(style.overflowY)&&node.scrollHeight>node.clientHeight+1)||(/auto|scroll/.test(style.overflowX)&&node.scrollWidth>node.clientWidth+1)))return node;
  if(node===object)break;
 }
 return null;
}
