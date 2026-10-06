import { useEffect } from 'react';
import { editorCanScroll } from './editorWheel.js';
import { createId } from './canvasIds.js';
import { ERASER_RADIUS, LASER_COLOR, MAX_REALTIME_STROKE_POINTS, REALTIME_STROKE_BATCH_SIZE, REALTIME_STROKE_INTERVAL_MS } from './canvasConstants.js';
import {
  canPeerAccessItem,
  sendStrokePreviewPoints,
  sendStrokePreviewStart,
} from './collaborativeSync.js';
import { objectBounds } from '../components/CanvasSpatialBTree.js';
import { eraseStrokeWithEraser } from '../components/strokeGeometry.js';
import { createTableData } from '../components/tableModel.js';
import { DEFAULT_SHAPE_ARROW_BEND } from '../components/shapeArrowGeometry.js';

export function useCanvasStageInteractions(options) {
  const {
    boardRef, camera, setCamera, activeTool, eraserRef, eraserCursorRef, itemsRef, boardSize,
    addItem, deleteItem, setToast, sendItemChange, setItems, refreshSpatialIndex,
    lastCursorSentAtRef, peerMeshRef, panRef, zoomHoldRef, zoomPointerPressRef,
    zoomSensitivity, stageWheelHandlerRef, laserDrawingRef, setLaserStrokes,
    selectionRef, selectedItemIds, setSelectionBox, selectItems,
    canvasSnapshotLoadedRef, finishEditing, setConnectionStartId, spacePressedRef,
    tableConfig, permission, setSharePosition, shapeType, shapeArrowStartHead,
    shapeArrowEndHead, color, noteColor, setActiveTool, startEditing, strokeWidth,
    drawingRef, drawingSessionRef, draftRef, vectorDraftRef,
  } = options;

  const pointerPosition = (event) => {
    const bounds = boardRef.current.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left - camera.x) / (bounds.width * camera.scale),
      y: (event.clientY - bounds.top - camera.y) / (bounds.height * camera.scale),
    };
  };
  const updateEraserCursor = (event) => {
    if (activeTool !== 'eraser') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const cursor = eraserCursorRef.current;
    if (!cursor) return;
    cursor.style.left = `${event.clientX - bounds.left}px`;
    cursor.style.top = `${event.clientY - bounds.top}px`;
    cursor.classList.add('is-visible');
  };
  const hideEraserCursor = () => eraserCursorRef.current?.classList.remove('is-visible');
  const eraseStrokesBetween = (from, to) => {
    const entries = Object.entries(itemsRef.current).filter(([, item]) => item?.kind === 'stroke');
    for (const [id, item] of entries) {
      if (itemsRef.current[id]?.kind !== 'stroke') continue;
      const remainingPaths = eraseStrokeWithEraser(item, from, to, boardSize, camera.scale, ERASER_RADIUS);
      if (remainingPaths === null) continue;
      if (remainingPaths.length === 0) {
        if (!deleteItem(id)) {
          setToast('연결이 복구되면 지우개를 다시 사용해주세요.');
          return;
        }
        continue;
      }

      const updatedItem = { ...item, points: remainingPaths[0] };
      if (!sendItemChange({ type: 'item_update', item_id: id, item: updatedItem }, item)) {
        setToast('연결이 복구되면 지우개를 다시 사용해주세요.');
        return;
      }

      const nextItems = { ...itemsRef.current, [id]: updatedItem };
      let allFragmentsSent = true;
      for (const points of remainingPaths.slice(1)) {
        const fragmentId = createId();
        const fragment = { ...item, points };
        if (!sendItemChange({ type: 'item_update', item_id: fragmentId, item: fragment }, null)) {
          allFragmentsSent = false;
          break;
        }
        nextItems[fragmentId] = fragment;
      }
      itemsRef.current = nextItems;
      setItems(nextItems);
      refreshSpatialIndex();
      if (!allFragmentsSent) {
        setToast('일부 선을 지우지 못했습니다. 연결이 복구되면 다시 시도해주세요.');
        return;
      }
    }
  };
  const centeredItemPosition = (width, height) => {
    const bounds = boardRef.current?.getBoundingClientRect();
    const viewWidth = Math.max(1, bounds?.width || boardSize.width);
    const viewHeight = Math.max(1, bounds?.height || boardSize.height);
    return {
      x: (viewWidth / 2 - camera.x) / (viewWidth * camera.scale) - width / 2,
      y: (viewHeight / 2 - camera.y) / (viewHeight * camera.scale) - height / 2,
    };
  };
  const sendCursorPosition = (event) => {
    const now = performance.now();
    if (now - lastCursorSentAtRef.current < 40) return;
    lastCursorSentAtRef.current = now;
    const point = pointerPosition(event);
    peerMeshRef.current?.sendCursor({ type: 'cursor', x: point.x, y: point.y });
  };
  const hideCursor = () => {
    peerMeshRef.current?.sendCursor({ type: 'cursor', visible: false });
    hideEraserCursor();
  };
  const startPan = (event) => {
    if (panRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, cameraX: camera.x, cameraY: camera.y };
    boardRef.current?.classList.add('panning');
    boardRef.current?.setPointerCapture?.(event.pointerId);
  };
  const zoomBy = (factor, clientX, clientY) => {
    const bounds = boardRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const targetX = clientX ?? bounds.left + bounds.width / 2;
    const targetY = clientY ?? bounds.top + bounds.height / 2;
    setCamera((current) => {
      const scale = Math.max(0.5, Math.min(4, current.scale * factor));
      const worldX = (targetX - bounds.left - current.x) / (bounds.width * current.scale);
      const worldY = (targetY - bounds.top - current.y) / (bounds.height * current.scale);
      return { scale, x: targetX - bounds.left - worldX * bounds.width * scale, y: targetY - bounds.top - worldY * bounds.height * scale };
    });
  };
  const stopZoomHold = () => {
    const hold = zoomHoldRef.current;
    if (hold?.delay) window.clearTimeout(hold.delay);
    if (hold?.repeat) window.clearInterval(hold.repeat);
    zoomHoldRef.current = null;
    window.setTimeout(() => { zoomPointerPressRef.current = false; }, 0);
  };
  const cancelZoomHold = () => {
    stopZoomHold();
    zoomPointerPressRef.current = false;
  };
  const startZoomHold = (event, factor) => {
    if (event.button !== 0) return;
    zoomPointerPressRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    zoomBy(factor);
    const hold = { delay: null, repeat: null };
    zoomHoldRef.current = hold;
    hold.delay = window.setTimeout(() => {
      if (zoomHoldRef.current !== hold) return;
      zoomBy(factor);
      hold.delay = null;
      hold.repeat = window.setInterval(() => zoomBy(factor), 100);
    }, 300);
  };
  const clickZoom = (factor) => {
    if (zoomPointerPressRef.current) {
      zoomPointerPressRef.current = false;
      return;
    }
    zoomBy(factor);
  };
  useEffect(() => () => {
    const hold = zoomHoldRef.current;
    if (hold?.delay) window.clearTimeout(hold.delay);
    if (hold?.repeat) window.clearInterval(hold.repeat);
  }, []);
  const handleStageWheel = (event) => {
    if (event.target.closest?.('.canvas-minimap')) {
      event.preventDefault();
      return;
    }
    if (!panRef.current && editorCanScroll(event)) return;
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      zoomBy(Math.exp(-event.deltaY * 0.0015 * zoomSensitivity), event.clientX, event.clientY);
    } else {
      setCamera((current) => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
    }
  };
  stageWheelHandlerRef.current = handleStageWheel;
  useEffect(() => {
    const stage = boardRef.current;
    if (!stage) return undefined;
    const onWheel = (event) => stageWheelHandlerRef.current?.(event);
    stage.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => stage.removeEventListener('wheel', onWheel, true);
  }, []);
  const recordLaserPoint = (point, finish = false) => {
    const active = laserDrawingRef.current;
    if (!active) return;
    const previous = active.lastPoint;
    const moved = point && previous && Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.0008;
    if (moved) {
      active.lastPoint = point;
      active.points.push(point);
      const now = Date.now();
      setLaserStrokes((current) => current.map((stroke) => stroke.id === active.key
        ? { ...stroke, points: [...stroke.points, point], updatedAt: now }
        : stroke));
      if (performance.now() - active.lastSentAt >= 32) {
        active.sequence += 1;
        active.lastSentAt = performance.now();
        active.lastSentPoint = point;
        peerMeshRef.current?.sendLaser({
          type: 'laser', phase: 'point', stroke_id: active.strokeId, sequence: active.sequence,
          x: point.x, y: point.y,
        });
      }
    }
    if (!finish) return;

    const lastPoint = active.lastPoint;
    if (!active.lastSentPoint || active.lastSentPoint.x !== lastPoint.x || active.lastSentPoint.y !== lastPoint.y) {
      active.sequence += 1;
      active.lastSentPoint = lastPoint;
    }
    const endedAt = Date.now();
    setLaserStrokes((current) => current.map((stroke) => stroke.id === active.key
      ? { ...stroke, active: false, endedAt, updatedAt: endedAt }
      : stroke));
    peerMeshRef.current?.sendLaser({
      type: 'laser', phase: 'end', stroke_id: active.strokeId, sequence: active.sequence,
      x: lastPoint.x, y: lastPoint.y,
    });
    laserDrawingRef.current = null;
  };

  const startMarqueeSelection = (event) => {
    const stage = boardRef.current;
    const bounds = stage?.getBoundingClientRect();
    if (!bounds) return;
    stage.focus({ preventScroll: true });
    const start = pointerPosition(event);
    const startClient = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    const baseIds = event.shiftKey ? selectedItemIds : [];
    selectionRef.current = { pointerId: event.pointerId, start, startClient, baseIds };
    setSelectionBox({ left: startClient.x, top: startClient.y, width: 0, height: 0 });
    if (!event.shiftKey) selectItems([]);
    event.preventDefault();
    event.stopPropagation();
    stage.setPointerCapture?.(event.pointerId);
  };
  const moveMarqueeSelection = (event) => {
    const selection = selectionRef.current;
    if (!selection || selection.pointerId !== event.pointerId) return;
    const bounds = boardRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    setSelectionBox({
      left: Math.min(selection.startClient.x, x),
      top: Math.min(selection.startClient.y, y),
      width: Math.abs(x - selection.startClient.x),
      height: Math.abs(y - selection.startClient.y),
    });
  };
  const finishMarqueeSelection = (event) => {
    const selection = selectionRef.current;
    if (!selection || selection.pointerId !== event.pointerId) return;
    selectionRef.current = null;
    setSelectionBox(null);
    if (event.type !== 'pointercancel') {
      const end = pointerPosition(event);
      const marquee = {
        minX: Math.min(selection.start.x, end.x),
        minY: Math.min(selection.start.y, end.y),
        maxX: Math.max(selection.start.x, end.x),
        maxY: Math.max(selection.start.y, end.y),
      };
      const hits = Object.entries(itemsRef.current).filter(([, item]) => item && !['stroke', 'connector'].includes(item.kind))
        .filter(([, item]) => {
          const bounds = objectBounds(item, itemsRef.current, boardSize.width, boardSize.height);
          return bounds && bounds.minX >= marquee.minX && bounds.maxX <= marquee.maxX
            && bounds.minY >= marquee.minY && bounds.maxY <= marquee.maxY;
        }).map(([id]) => id);
      const expanded = new Set([...selection.baseIds, ...hits]);
      const selectedGroups = new Set([...expanded].map((id) => itemsRef.current[id]?.groupId).filter(Boolean));
      if (selectedGroups.size) {
        Object.entries(itemsRef.current).forEach(([id, item]) => {
          if (!item?.groupId || !selectedGroups.has(item.groupId) || ['stroke', 'connector'].includes(item.kind)) return;
          const bounds = objectBounds(item, itemsRef.current, boardSize.width, boardSize.height);
          if (bounds && bounds.minX >= marquee.minX && bounds.maxX <= marquee.maxX
            && bounds.minY >= marquee.minY && bounds.maxY <= marquee.maxY) expanded.add(id);
        });
      }
      selectItems([...expanded]);
    }
    if (boardRef.current?.hasPointerCapture?.(event.pointerId)) boardRef.current.releasePointerCapture(event.pointerId);
  };
  const startDrawing = (event) => {
    updateEraserCursor(event);
    const clickedEmptySpace = event.button === 0 && !event.target.closest?.('.canvas-object, .canvas-minimap, .stage-label, .draw-cursor-label, .eraser-cursor');
    if (clickedEmptySpace) {
      finishEditing();
      setConnectionStartId(null);
    }
    if (event.button === 1 || spacePressedRef.current) { startPan(event); return; }
    if (activeTool === 'select' && clickedEmptySpace) { startMarqueeSelection(event); return; }
    if (!canvasSnapshotLoadedRef.current || (!['pen', 'laser'].includes(activeTool) && event.target.closest?.('.canvas-object'))) return;
    if (activeTool === 'eraser') {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = pointerPosition(event);
      eraserRef.current = point;
      eraseStrokesBetween(point, point);
      return;
    }
    if (activeTool === 'link') {
      event.preventDefault();
      setSharePosition(pointerPosition(event));
      return;
    }
    if (activeTool === 'table') {
      event.preventDefault();
      const point = pointerPosition(event);
      const width = tableConfig.width / 100;
      const height = tableConfig.height / 100;
      const id = createId();
      const item = { kind: 'table', ...createTableData(tableConfig.rows, tableConfig.columns), x: point.x - width / 2, y: point.y - height / 2, width, height, permission };
      if (!addItem(id, item)) setToast('실시간 서버에 연결된 뒤 테이블을 놓을 수 있어요.');
      else setActiveTool('select');
      return;
    }
    if (activeTool === 'shape' || activeTool === 'text' || activeTool === 'markdown' || activeTool === 'math' || activeTool === 'code' || activeTool === 'note') {
      event.preventDefault();
      const point = pointerPosition(event);
      const itemWidth = activeTool === 'shape' ? 0.14 : activeTool === 'math' ? 0.2 : activeTool === 'code' ? 0.32 : activeTool === 'note' ? 0.24 : 0.22;
      const x = point.x - itemWidth / 2;
      const y = point.y - (activeTool === 'code' ? 0.1 : activeTool === 'note' ? 0.08 : 0.06);
      let item;
      if (activeTool === 'shape') item = { kind: 'shape', shapeType, ...(shapeType === 'arrow' ? { bend: DEFAULT_SHAPE_ARROW_BEND, startHead: shapeArrowStartHead, endHead: shapeArrowEndHead } : {}), x, y, width: itemWidth, height: 0.12, color, permission };
      else if (activeTool === 'text' || activeTool === 'markdown') item = { kind: 'text', text: '', ...(activeTool === 'markdown' ? { format: 'markdown' } : {}), x, y, width: itemWidth, permission };
      else if (activeTool === 'note') item = { kind: 'note', text: '', x, y, width: itemWidth, color: noteColor, rotation: Math.random() * 3 - 1.5, permission };
      else if (activeTool === 'code') item = { kind: 'code', code: '', filename: 'idea.js', language: 'javascript', x, y, width: itemWidth, permission };
      else {
        const content = window.prompt('수식을 입력하세요. 예: f(x) = x² + 2x + 1');
        if (!content?.trim()) return;
        item = { kind: 'math', formula: content.trim(), x, y, width: itemWidth, permission };
      }
      const id = createId();
      if (!addItem(id, item)) setToast('실시간 서버에 연결된 뒤 캔버스를 수정할 수 있어요.');
      else {
        setActiveTool('select');
        if (activeTool === 'text' || activeTool === 'markdown' || activeTool === 'code' || activeTool === 'note') startEditing(id);
      }
      return;
    }
    if (activeTool === 'connect') { setToast('연결할 오브젝트 두 개를 차례로 선택하세요.'); return; }
    if (activeTool === 'laser') {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = pointerPosition(event);
      const strokeId = createId();
      const key = `local-${strokeId}`;
      const now = Date.now();
      laserDrawingRef.current = {
        strokeId, key, sequence: 0, lastPoint: point, lastSentPoint: point,
        lastSentAt: performance.now(), points: [point],
      };
      setLaserStrokes((current) => [...current, {
        id: key, color: LASER_COLOR, points: [point], active: true, updatedAt: now, endedAt: null,
      }]);
      peerMeshRef.current?.sendLaser({ type: 'laser', phase: 'start', stroke_id: strokeId, sequence: 0, x: point.x, y: point.y });
      return;
    }
    if (activeTool !== 'pen') return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPosition(event);
    const strokeId = createId();
    const session = {
      id: strokeId,
      sequence: 0,
      color,
      strokeWidth,
      permission,
      aclItem: { kind: 'stroke', permission },
      lastSentAt: performance.now(),
      pendingPoints: [],
    };
    drawingRef.current = true;
    drawingSessionRef.current = session;
    draftRef.current = [point];
    vectorDraftRef.current?.({ points: draftRef.current, color: session.color, strokeWidth: session.strokeWidth });
    sendStrokePreviewStart(peerMeshRef.current, session, point);
  };
  const moveDrawing = (event) => {
    updateEraserCursor(event);
    sendCursorPosition(event);
    if (selectionRef.current) { moveMarqueeSelection(event); return; }
    if (panRef.current) {
      const pan = panRef.current;
      if (pan.pointerId !== event.pointerId) return;
      setCamera((current) => ({ ...current, x: pan.cameraX + event.clientX - pan.x, y: pan.cameraY + event.clientY - pan.y }));
      return;
    }
    if (eraserRef.current) {
      const point = pointerPosition(event);
      eraseStrokesBetween(eraserRef.current, point);
      eraserRef.current = point;
      return;
    }
    if (laserDrawingRef.current) {
      recordLaserPoint(pointerPosition(event));
      return;
    }
    if (!drawingRef.current) return;
    const point = pointerPosition(event);
    const previous = draftRef.current[draftRef.current.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.0018) return;
    if (draftRef.current.length >= MAX_REALTIME_STROKE_POINTS) return;
    draftRef.current.push(point);
    const session = drawingSessionRef.current;
    if (!session) return;
    session.pendingPoints.push(point);
    vectorDraftRef.current?.({ points: draftRef.current, color: session.color, strokeWidth: session.strokeWidth });
    const now = performance.now();
    if (now - session.lastSentAt >= REALTIME_STROKE_INTERVAL_MS || session.pendingPoints.length >= REALTIME_STROKE_BATCH_SIZE) {
      sendStrokePreviewPoints(peerMeshRef.current, session, session.pendingPoints.splice(0));
      session.lastSentAt = now;
    }
  };
  const stopDrawing = (event) => {
    if (selectionRef.current) { finishMarqueeSelection(event); return; }
    if (panRef.current) {
      if (panRef.current.pointerId !== event.pointerId) return;
      panRef.current = null;
      const stage = boardRef.current;
      stage?.classList.remove('panning');
      if (stage?.hasPointerCapture?.(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      return;
    }
    if (eraserRef.current) {
      eraserRef.current = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (laserDrawingRef.current) {
      recordLaserPoint(pointerPosition(event), true);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (!drawingRef.current) return;
    drawingRef.current = false; event.currentTarget.releasePointerCapture?.(event.pointerId);
    const points = draftRef.current;
    const session = drawingSessionRef.current;
    drawingSessionRef.current = null;
    draftRef.current = [];
    vectorDraftRef.current?.(null);
    if (!points.length) return;
    const id = session?.id || createId();
    const item = {
      kind: 'stroke',
      points,
      color: session?.color || color,
      strokeWidth: session?.strokeWidth || strokeWidth,
      permission: session?.permission || permission,
    };
    if (session) sendStrokePreviewPoints(peerMeshRef.current, session, session.pendingPoints.splice(0));
    const added = addItem(id, item);
    if (!added) setToast('실시간 서버에 연결된 뒤 그릴 수 있어요.');
    if (session) {
      session.sequence += 1;
      peerMeshRef.current?.sendData({
        type: 'stroke_preview',
        phase: added ? 'end' : 'cancel',
        stroke_id: session.id,
        sequence: session.sequence,
        points: [],
      }, (peer) => canPeerAccessItem(session.aclItem, peer));
    }
  };
  return {
    pointerPosition,
    startPan,
    centeredItemPosition,
    hideCursor,
    startZoomHold,
    stopZoomHold,
    cancelZoomHold,
    clickZoom,
    startDrawing,
    moveDrawing,
    stopDrawing,
  };
}
