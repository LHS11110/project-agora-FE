import { activateObjectPointer, captureObjectPointer, releaseObjectPointer } from './pointerCapture.js';
import { captureResize, resizeItemAtPointer } from '../components/objectResize.js';
import { rotationAtPointer } from '../components/CanvasRotationHandles.jsx';
import { connectorBendFromPointer, connectorGeometry } from '../components/connectorGeometry.js';
import { createId } from './canvasIds.js';
import { hasItemGeometryChanged } from './useCanvasPeerGeometry.js';
import { isCollaborativeItem } from './collaborativeSync.js';
import { shapeArrowBendFromPointer } from '../components/shapeArrowGeometry.js';
import { rotateGroup } from './groupGeometry.js';

export function useCanvasObjectInteractions(options) {
  const {
    activeTool,
    addItem,
    boardRef,
    boardSize,
    clearPeerItemGeometryBroadcast,
    connectionStartId,
    connectorColor,
    connectorEndHead,
    connectorStartHead,
    connectorWidth,
    dragRef,
    itemsRef,
    markItemDirty,
    permission,
    pointerPosition,
    refreshSpatialIndex,
    saveCollaborativeItemRef,
    sceneRef,
    selectItems,
    selectedObjectIdSet,
    selectedObjectIds,
    sendItemChange,
    sendPeerItemGeometry,
    sendRealtimePeerItemGeometry,
    setActiveTool,
    setConnectionStartId,
    setItems,
    setToast,
    spacePressedRef,
    startPan,
  } = options;

  const startObjectDrag = (event, id, item) => {
    if (activeTool === 'hand' && event.button === 0) { startPan(event); return; }
    if (event.target.closest?.('.canvas-code-editor')) { event.stopPropagation(); return; }
    if (event.button === 1 || spacePressedRef.current) { startPan(event); return; }
    if (event.button !== 0) return;
    const objectElement = event.currentTarget.closest?.('.canvas-object') || event.currentTarget;
    if (activeTool === 'pen' || activeTool === 'laser') {
      if (event.target.closest('button, input, textarea, select')) event.stopPropagation();
      return;
    }
    if (activeTool === 'connect') {
      event.preventDefault(); event.stopPropagation();
      if (!connectionStartId) { setConnectionStartId(id); setToast('도착 오브젝트를 선택해 연결을 완성하세요.'); return; }
      if (connectionStartId === id) { setConnectionStartId(null); return; }
      const from = itemsRef.current[connectionStartId];
      const to = itemsRef.current[id];
      if (from && to) addItem(createId(), { kind: 'connector', bend: 0, from: connectionStartId, to: id, color: connectorColor, strokeWidth: connectorWidth, startHead: connectorStartHead, endHead: connectorEndHead, permission });
      setConnectionStartId(null); setActiveTool('select'); return;
    }
    const key = String(id);
    if (activeTool !== 'select') { event.stopPropagation(); return; }
    const focusCanvas = () => boardRef.current?.focus({ preventScroll: true });
    const groupedIds = item?.groupId
      ? Object.entries(itemsRef.current).filter(([, candidate]) => candidate?.groupId === item.groupId && !['stroke', 'connector'].includes(candidate.kind)).map(([groupedId]) => groupedId)
      : [];
    if (event.shiftKey) {
      const toggleIds = groupedIds.length ? groupedIds : [key];
      const alreadySelected = selectedObjectIdSet.has(key);
      const nextSelection = alreadySelected
        ? selectedObjectIds.filter((selectedId) => !toggleIds.includes(selectedId))
        : [...selectedObjectIds, ...toggleIds];
      selectItems(nextSelection, alreadySelected ? nextSelection[nextSelection.length - 1] : key);
      if (!event.target.closest('button, input, textarea, select')) focusCanvas();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const alreadySelected = selectedObjectIdSet.has(key);
    const targetIds = alreadySelected
      ? [...new Set([...selectedObjectIds, ...groupedIds])]
      : groupedIds.length ? groupedIds : [key];
    selectItems(targetIds, key);
    if (!alreadySelected) {
      focusCanvas();
      event.preventDefault(); event.stopPropagation();
      return;
    }
    const isMoveHandle = event.target.closest?.('.object-move-handle');
    if (event.target.closest?.('button') && !isMoveHandle) { event.stopPropagation(); return; }
    focusCanvas();
    if (item?.kind === 'connector') { event.preventDefault(); event.stopPropagation(); return; }
    event.preventDefault(); event.stopPropagation();
    const start = pointerPosition(event);
    const touchStart = event.pointerType !== 'mouse' ? { x: event.clientX, y: event.clientY } : null;
    const movableIds = targetIds.filter((targetId) => itemsRef.current[targetId] && !['stroke', 'connector'].includes(itemsRef.current[targetId].kind));
    if (movableIds.length > 1) {
      const initialItems = Object.fromEntries(movableIds.map((targetId) => [targetId, itemsRef.current[targetId]]));
      const elements = movableIds.map((targetId) => [...(sceneRef.current?.querySelectorAll('[data-item-id]') || [])].find((node) => node.dataset.itemId === targetId)).filter(Boolean);
      elements.forEach((element) => element.classList.add('object-dragging', 'multi-object-dragging'));
      dragRef.current = { mode: 'multi-move', ids: movableIds, initialItems, startPoint: start, touchStart, elements };
    } else {
      objectElement.classList.add('object-dragging');
      dragRef.current = { mode: 'move', id, initial: item, offsetX: start.x - (item.x || 0), offsetY: start.y - (item.y || 0), startX: start.x, startY: start.y, touchStart, element: objectElement };
    }
    captureObjectPointer(boardRef.current, dragRef.current, event);
  };
  const startObjectResize = (event, id, item, handle) => {
    if (activeTool !== 'select' || item?.kind === 'connector') return;
    const board = boardRef.current?.getBoundingClientRect();
    if (!board) return;
    event.preventDefault();
    event.stopPropagation();
    const key = String(id);
    const initial = itemsRef.current[key] || item;
    const start = pointerPosition(event);
    const element = event.currentTarget.closest('.canvas-object');
    selectItems([key], key);
    element?.classList.add('object-resizing');
    dragRef.current = {
      mode: 'resize',
      id: key,
      initial,
      resize: captureResize(initial, handle, start, element, boardSize),
      viewport: boardSize,
      element,
    };
    captureObjectPointer(boardRef.current, dragRef.current, event);
  };
  const startArrowBend = (event, id, item) => {
    const isShapeArrow = item?.kind === 'shape' && item.shapeType === 'arrow';
    const isConnectorArrow = item?.kind === 'connector';
    if (event.button !== 0 || activeTool !== 'select' || (!isShapeArrow && !isConnectorArrow)) return;
    const board = boardRef.current?.getBoundingClientRect();
    if (!board) return;
    event.preventDefault();
    event.stopPropagation();
    const key = String(id);
    const initial = itemsRef.current[key] || item;
    const element = event.currentTarget.closest('.canvas-object');
    selectItems([key], key);
    element?.classList.add('object-bending');
    dragRef.current = { mode: 'bend', id: key, initial, viewport: boardSize, element };
    captureObjectPointer(boardRef.current, dragRef.current, event);
  };
  const startObjectRotation = (event, id, item) => {
    if (activeTool !== 'select' || item?.kind === 'connector') return;
    const key = String(id);
    const initial = itemsRef.current[key] || item;
    const frame = event.currentTarget.closest('.object-rotation-frame');
    const frameBounds = frame?.getBoundingClientRect();
    const element = sceneRef.current && [...sceneRef.current.querySelectorAll('[data-item-id]')]
      .find((node) => node.dataset.itemId === key);
    if (!initial || !frameBounds || !element) return;
    event.preventDefault();
    event.stopPropagation();
    const centerX = frameBounds.left + frameBounds.width / 2;
    const centerY = frameBounds.top + frameBounds.height / 2;
    selectItems([key], key);
    element.classList.add('object-rotating');
    boardRef.current?.classList.add('rotating');
    dragRef.current = {
      mode: 'rotate',
      id: key,
      initial,
      centerX,
      centerY,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
      initialRotation: Number(initial.rotation) || 0,
      element,
    };
    captureObjectPointer(boardRef.current, dragRef.current, event);
  };
  const moveObject = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    if (!activateObjectPointer(dragRef.current, event)) return;
    const pendingTouchStart = dragRef.current.touchStart;
    if (pendingTouchStart) {
      if (Math.hypot(event.clientX - pendingTouchStart.x, event.clientY - pendingTouchStart.y) < 7) return;
      dragRef.current.touchStart = null;
    }
    const { mode, id, initial, offsetX, offsetY, startX, startY, resize, viewport } = dragRef.current;
    if (mode === 'multi-rotate') {
      const drag = dragRef.current;
      const degrees = rotationAtPointer(0, drag.startAngle, event.clientX, event.clientY, drag.centerX, drag.centerY);
      const changes = rotateGroup(drag.initialItems, drag.layout, degrees, boardSize);
      itemsRef.current = { ...itemsRef.current, ...changes };
      setItems(itemsRef.current);
      for (const [itemId, next] of Object.entries(changes)) sendRealtimePeerItemGeometry(itemId, next);
      return;
    }
    if (mode === 'multi-move') {
      const { ids, initialItems, startPoint } = dragRef.current;
      const point = pointerPosition(event);
      const dx = point.x - startPoint.x;
      const dy = point.y - startPoint.y;
      const nextItems = { ...itemsRef.current };
      ids.forEach((itemId) => {
        const original = initialItems[itemId];
        nextItems[itemId] = { ...original, x: (Number(original.x) || 0) + dx, y: (Number(original.y) || 0) + dy };
        sendRealtimePeerItemGeometry(itemId, nextItems[itemId]);
      });
      itemsRef.current = nextItems;
      setItems(nextItems);
      return;
    }
    if (mode === 'bend') {
      const point = pointerPosition(event);
      const next = initial.kind === 'connector'
        ? { ...initial, ...connectorBendFromPointer(connectorGeometry(initial, itemsRef.current, viewport.width, viewport.height), point, viewport) }
        : { ...initial, bend: shapeArrowBendFromPointer(initial, point, viewport) };
      itemsRef.current = { ...itemsRef.current, [id]: next };
      setItems((current) => ({ ...current, [id]: next }));
      return;
    }
    if (mode === 'rotate') {
      const { centerX, centerY, startAngle, initialRotation } = dragRef.current;
      const next = { ...initial, rotation: rotationAtPointer(initialRotation, startAngle, event.clientX, event.clientY, centerX, centerY) };
      itemsRef.current = { ...itemsRef.current, [id]: next };
      setItems((current) => ({ ...current, [id]: next }));
      sendRealtimePeerItemGeometry(id, next);
      return;
    }
    const point = pointerPosition(event);
    const next = mode === 'resize'
      ? resizeItemAtPointer(initial, resize, point, viewport)
      : initial.kind === 'stroke'
        ? { ...initial, points: initial.points.map((part) => ({ ...part, x: part.x + point.x - startX, y: part.y + point.y - startY })) }
        : { ...initial, x: point.x - offsetX, y: point.y - offsetY };
    itemsRef.current = { ...itemsRef.current, [id]: next };
    setItems((current) => ({ ...current, [id]: next }));
    sendRealtimePeerItemGeometry(id, next);
  };
  const stopObjectDrag = (event) => {
    if (!dragRef.current) return;
    if (event && dragRef.current.pointerId !== event.pointerId) return;
    if (event?.type === 'lostpointercapture' && event.target !== dragRef.current.captureElement) return;
    const drag = dragRef.current;
    dragRef.current = null;
    releaseObjectPointer(drag);
    if (drag.mode === 'multi-move' || drag.mode === 'multi-rotate') {
      drag.elements.forEach((element) => element.classList.remove('object-dragging', 'multi-object-dragging', 'object-rotating'));
      boardRef.current?.classList.remove('rotating');
      refreshSpatialIndex();
      for (const id of drag.ids) {
        const initial = drag.initialItems[id];
        const item = itemsRef.current[id];
        clearPeerItemGeometryBroadcast(id);
        if (!hasItemGeometryChanged(initial, item)) continue;
        sendPeerItemGeometry(id, item);
        if (isCollaborativeItem(item)) {
          markItemDirty(id);
          if (item.kind === 'note') saveCollaborativeItemRef.current?.(id, { silent: true });
        } else if (item && !sendItemChange({ type: 'item_update', item_id: id, item }, initial)) {
          const rolledBack = { ...itemsRef.current, [id]: initial };
          itemsRef.current = rolledBack;
          setItems(rolledBack);
          sendPeerItemGeometry(id, initial);
          setToast('연결이 복구되면 선택한 오브젝트를 다시 이동해주세요.');
        }
      }
      refreshSpatialIndex();
      return;
    }
    const { id, initial, element } = drag;
    element?.classList.remove('object-dragging', 'object-resizing', 'object-rotating', 'object-bending');
    boardRef.current?.classList.remove('rotating');
    const item = itemsRef.current[id];
    clearPeerItemGeometryBroadcast(id);
    if (!hasItemGeometryChanged(initial, item)) return;
    refreshSpatialIndex();
    sendPeerItemGeometry(id, item);
    if (isCollaborativeItem(item)) {
      markItemDirty(id);
      if (item.kind === 'note') saveCollaborativeItemRef.current?.(id, { silent: true });
    } else if (item && !sendItemChange({ type: 'item_update', item_id: id, item }, initial)) {
      itemsRef.current = { ...itemsRef.current, [id]: initial };
      setItems((current) => ({ ...current, [id]: initial }));
      sendPeerItemGeometry(id, initial);
      refreshSpatialIndex();
    }
  };
  const startGroupRotation = (event, ids, layout) => {
    if (event.button !== 0 || activeTool !== 'select' || dragRef.current) return;
    const frame = event.currentTarget.closest('.object-rotation-frame')?.getBoundingClientRect();
    if (!frame || !layout) return;
    event.preventDefault(); event.stopPropagation();
    const centerX = frame.left + frame.width / 2, centerY = frame.top + frame.height / 2;
    const initialItems = Object.fromEntries(ids.map(id => [id, itemsRef.current[id]]));
    const elements = [...(sceneRef.current?.querySelectorAll('[data-item-id]') || [])].filter(element => ids.includes(element.dataset.itemId));
    elements.forEach(element => element.classList.add('object-rotating'));
    boardRef.current?.classList.add('rotating');
    dragRef.current = { mode: 'multi-rotate', ids, initialItems, layout, elements, centerX, centerY,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX) };
    captureObjectPointer(boardRef.current, dragRef.current, event);
  };
  return { startObjectDrag, startObjectResize, startArrowBend, startObjectRotation, startGroupRotation, moveObject, stopObjectDrag };
}
