import { useEffect, useRef, useState } from 'react';
/** Pointer capture supports mouse, pen and touch without stealing ordinary tool clicks. */
export function useToolFolderDrag({ moveTool, moveFolder, beforeFolderMove, panelRef }) {
  const [drag, setDrag] = useState(null);
  const gesture = useRef(null), suppressClick = useRef(false), scrollFrame = useRef(null);
  const update = event => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.dragging && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
    current.dragging = true; suppressClick.current = true;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const panel = panelRef.current;
    const horizontal = panel && getComputedStyle(panel).flexDirection.startsWith('row');
    let folder = hit?.closest('[data-tool-folder-id]');
    // The insertion line lies in the gap, so a drop between folders must work too.
    if (current.kind === 'folder' && !folder && panel?.contains(hit) && !hit.closest('.tool-folder-toolbar')) {
      let distance = Infinity;
      panel.querySelectorAll('[data-tool-folder-id]').forEach(candidate => {
        const rect = candidate.getBoundingClientRect();
        const start = horizontal ? rect.left : rect.top, end = horizontal ? rect.right : rect.bottom;
        const position = horizontal ? event.clientX : event.clientY;
        const nextDistance = Math.max(start - position, position - end, 0);
        if (nextDistance < distance) { distance = nextDistance; folder = candidate; }
      });
    }
    const targetId = folder && panel?.contains(folder) ? folder.dataset.toolFolderId : null;
    const bounds = folder?.getBoundingClientRect();
    const after = Boolean(bounds && (horizontal ? event.clientX > (bounds.left + bounds.right) / 2 : event.clientY > (bounds.top + bounds.bottom) / 2));
    const beforeToolId = targetId ? hit?.closest('[data-folder-tool-id]')?.dataset.folderToolId : null;
    Object.assign(current, { clientX: event.clientX, clientY: event.clientY, targetId, beforeToolId, after });
    setDrag({ kind: current.kind, toolId: current.toolId, folderId: current.folderId, x: event.clientX, y: event.clientY, targetId, after });
  };
  const stop = (event, commit = true) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null; setDrag(null);
    if (commit && current.dragging && current.targetId) {
      if (current.kind === 'folder') {
        beforeFolderMove?.();
        moveFolder(current.folderId, current.targetId, current.after);
      } else moveTool(current.toolId, current.targetId, current.beforeToolId);
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (current.dragging) { event.preventDefault(); event.stopPropagation(); }
  };
  useEffect(() => {
    if (!drag) return undefined;
    const scroll = () => {
      const current = gesture.current, panel = panelRef.current;
      if (!current || !panel) return;
      const bounds = panel.getBoundingClientRect();
      if (current.clientX >= bounds.left - 20 && current.clientX <= bounds.right + 20 && current.clientY >= bounds.top - 20 && current.clientY <= bounds.bottom + 20) {
        if (getComputedStyle(panel).flexDirection.startsWith('row')) panel.scrollLeft += current.clientX < bounds.left + 24 ? -7 : current.clientX > bounds.right - 24 ? 7 : 0;
        else panel.scrollTop += current.clientY < bounds.top + 28 ? -7 : current.clientY > bounds.bottom - 28 ? 7 : 0;
        update({ pointerId: current.pointerId, clientX: current.clientX, clientY: current.clientY });
      }
      scrollFrame.current = requestAnimationFrame(scroll);
    };
    scrollFrame.current = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(scrollFrame.current);
  }, [Boolean(drag)]);
  const consumeClick = event => {
    if (!suppressClick.current || event.detail === 0) return false;
    suppressClick.current = false; event.preventDefault(); event.stopPropagation(); return true;
  };
  const pointerHandlers = (kind, id) => ({
    onPointerDown: event => {
      if (event.button !== 0 || gesture.current) return;
      suppressClick.current = false;
      gesture.current = { kind, toolId: kind === 'tool' ? id : null, folderId: kind === 'folder' ? id : null, pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    }, onPointerMove: update, onPointerUp: event => stop(event),
    onPointerCancel: event => stop(event, false), onLostPointerCapture: event => stop(event, false),
    onKeyDown: event => { if (event.key === 'Escape' && gesture.current?.dragging) { stop({ ...event, pointerId: gesture.current.pointerId, currentTarget: event.currentTarget, preventDefault: () => event.preventDefault(), stopPropagation: () => event.stopPropagation() }, false); } },
  });
  return { drag, toolPointerHandlers: id => pointerHandlers('tool', id), folderPointerHandlers: id => pointerHandlers('folder', id), consumeClick };
}
