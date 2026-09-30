import { captureResize, resizeItemAtPointer } from '../components/objectResize.js';
import { rotationAtPointer } from '../components/RotationHandles.jsx';
import { connectorBendFromPointer, connectorGeometry } from '../components/connectorGeometry.js';
import { shapeArrowBendFromPointer } from '../components/shapeArrowGeometry.js';

export function useTutorialObjectInteractions(options) {
  const {
    activeTool,
    addItem,
    boardRef,
    color,
    connectionStartId,
    connectorColor,
    connectorEndHead,
    connectorStartHead,
    connectorWidth,
    draftSetterRef,
    dragRef,
    drawingRef,
    eraseStrokesBetween,
    eraserRef,
    items,
    laserDrawingRef,
    panRef,
    pointsRef,
    position,
    recordLaserPoint,
    sceneRef,
    setActiveTool,
    setCamera,
    setConnectionStartId,
    setItems,
    setSelectedItemId,
    spacePressedRef,
    strokeWidth,
    updateEraserCursor,
  } = options;

  const startItemInteraction = (event, id) => {
    if (event.button === 1 || spacePressedRef.current) return;
    if (activeTool === 'pen' || activeTool === 'laser') {
      if (event.target.closest?.('button, input, textarea, select')) event.stopPropagation();
      return;
    }
    event.stopPropagation();
    if (event.target.closest?.('button, input, textarea, select')) return;
    if (activeTool === 'connect') {
      event.preventDefault();
      setSelectedItemId(id);
      if (!connectionStartId) setConnectionStartId(id);
      else if (connectionStartId === id) setConnectionStartId(null);
      else {
        addItem({ kind: 'connector', from: connectionStartId, to: id, color: connectorColor, strokeWidth: connectorWidth, startHead: connectorStartHead, endHead: connectorEndHead });
        setConnectionStartId(null);
        setActiveTool('select');
      }
      return;
    }
    if (activeTool !== 'select') return;
    event.preventDefault();
    const point = position(event);
    const item = items[id];
    if (!item) return;
    setSelectedItemId(id);
    if (item.kind === 'connector') return;
    event.currentTarget.classList.add('object-dragging');
    dragRef.current = {
      mode: 'move',
      id,
      initial: item,
      offsetX: point.x - (Number(item.x) || 0),
      offsetY: point.y - (Number(item.y) || 0),
      startX: point.x,
      startY: point.y,
      element: event.currentTarget,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const startItemResize = (event, id, handle) => {
    if (activeTool !== 'select') return;
    const item = items[id];
    const board = boardRef.current?.getBoundingClientRect();
    if (!item || item.kind === 'connector' || !board) return;
    event.preventDefault();
    event.stopPropagation();
    const point = position(event);
    const element = event.currentTarget.closest('.tutorial-item');
    setSelectedItemId(id);
    element?.classList.add('object-resizing');
    dragRef.current = {
      mode: 'resize',
      id,
      initial: item,
      resize: captureResize(item, handle, point, element, board),
      viewport: { width: board.width, height: board.height },
      element,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const startArrowBend = (event, id, item) => {
    const isShapeArrow = item?.kind === 'shape' && item.shapeType === 'arrow';
    const isConnectorArrow = item?.kind === 'connector';
    if (event.button !== 0 || activeTool !== 'select' || (!isShapeArrow && !isConnectorArrow)) return;
    const board = boardRef.current?.getBoundingClientRect();
    if (!board) return;
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget.closest('.tutorial-item');
    setSelectedItemId(id);
    element?.classList.add('object-bending');
    dragRef.current = { mode: 'bend', id, initial: item, viewport: { width: board.width, height: board.height }, element };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const startItemRotation = (event, id, item) => {
    if (activeTool !== 'select' || item?.kind === 'connector') return;
    const scene = sceneRef.current;
    const key = String(id);
    const initial = items[key] || item;
    const frame = event.currentTarget.closest('.object-rotation-frame');
    const frameBounds = frame?.getBoundingClientRect();
    const element = scene && [...scene.querySelectorAll('[data-item-id]')]
      .find((node) => node.dataset.itemId === key);
    if (!initial || !frameBounds || !element) return;
    event.preventDefault();
    event.stopPropagation();
    const centerX = frameBounds.left + frameBounds.width / 2;
    const centerY = frameBounds.top + frameBounds.height / 2;
    setSelectedItemId(key);
    element.classList.add('object-rotating');
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
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveOnBoard = (event) => {
    updateEraserCursor(event);
    if (panRef.current) {
      const pan = panRef.current;
      setCamera((current) => ({ ...current, x: pan.cameraX + event.clientX - pan.x, y: pan.cameraY + event.clientY - pan.y }));
      return;
    }
    if (eraserRef.current) {
      const point = position(event);
      eraseStrokesBetween(eraserRef.current, point);
      eraserRef.current = point;
      return;
    }
    if (laserDrawingRef.current) {
      recordLaserPoint(position(event));
      return;
    }
    if (dragRef.current) {
      const { mode, id, initial, offsetX, offsetY, startX, startY, resize, viewport } = dragRef.current;
      if (mode === 'rotate') {
        const { centerX, centerY, startAngle, initialRotation } = dragRef.current;
        const rotation = rotationAtPointer(initialRotation, startAngle, event.clientX, event.clientY, centerX, centerY);
        setItems((current) => current[id] ? { ...current, [id]: { ...initial, rotation } } : current);
        return;
      }
      const point = position(event);
      if (mode === 'bend') {
        setItems((current) => {
          if (!current[id]) return current;
          const bend = initial.kind === 'connector'
            ? connectorBendFromPointer(connectorGeometry(initial, current, viewport.width, viewport.height), point, viewport)
            : { bend: shapeArrowBendFromPointer(initial, point, viewport) };
          return { ...current, [id]: { ...initial, ...bend } };
        });
        return;
      }
      setItems((current) => {
        const item = current[id];
        if (!item) return current;
        const next = mode === 'resize'
          ? resizeItemAtPointer(initial, resize, point, viewport)
          : initial?.kind === 'stroke'
            ? { ...initial, points: initial.points.map((part) => ({ ...part, x: part.x + point.x - startX, y: part.y + point.y - startY })) }
            : { ...item, x: point.x - offsetX, y: point.y - offsetY };
        return { ...current, [id]: next };
      });
      return;
    }
    if (!drawingRef.current) return;
    const point = position(event);
    const previous = pointsRef.current[pointsRef.current.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.0018) return;
    pointsRef.current.push(point);
    draftSetterRef.current?.({ points: pointsRef.current, color, strokeWidth });
  };

  const finishInteraction = (event) => {
    if (panRef.current) {
      panRef.current = null;
      boardRef.current?.classList.remove('panning');
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (eraserRef.current) {
      eraserRef.current = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (laserDrawingRef.current) {
      recordLaserPoint(position(event), true);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (dragRef.current) { dragRef.current.element?.classList.remove('object-dragging', 'object-resizing', 'object-rotating', 'object-bending'); dragRef.current = null; return; }
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const points = pointsRef.current;
    pointsRef.current = [];
    draftSetterRef.current?.(null);
    if (points.length) addItem({ kind: 'stroke', points, color, strokeWidth });
  };

  return { startItemInteraction, startItemResize, startArrowBend, startItemRotation, moveOnBoard, finishInteraction };
}
