import { hasPolygonVertices } from './shapeAppearance.js';
import { groupMember } from './userGroups/userGroupModel.js';
import { shapeCreationSize } from './shapeCatalog.js';
import { newChartData } from './charts/chartData.js';
import { cursorDeadline, cursorIsDue, CURSOR_INTERVAL_MS } from './cursorSchedule.js';
import { useEffect, useRef } from 'react';
import { INK_BRUSH, inkPointAtPointer } from './inkStroke.js';
import { appendInkInput } from './inkInput.js';
import { canvasPointAtPointer, zoomCanvasCamera } from './canvasSpace.js';
import { useCanvasStrokeSaveBatch } from './useCanvasStrokeSaveBatch.js';
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
    boardRef, camera, setCamera, activeTool, eraserRef, eraserCursorRef, itemsRef, boardSize, eraserWidth = ERASER_RADIUS * 2, eraserMode,
    addItem, setToast, setItems, patchItems, refreshSpatialIndex, spatialIndexRef,
    sendStrokeFrameChanges, pendingItemChangesRef, strokeSaveFlushRef,
    lastCursorSentAtRef, peerMeshRef, panRef, zoomHoldRef, zoomPointerPressRef,
    zoomSensitivity, stageWheelHandlerRef, laserDrawingRef, setLaserStrokes,
    selectionRef, selectedItemIds, setSelectionBox, selectItems,
    canvasSnapshotLoadedRef, finishEditing, setConnectionStartId, spacePressedRef,
    user, tableConfig, permission, setSharePosition, shapeType, shapeArrowStartHead, shapeArrowHeadSize,
    shapeArrowEndHead, shapeFillColor, shapeFillOpacity, shapeSketchFillOpacity, shapeVertexCount, shapeCornerStyle, shapeVisualStyle, shapeStrokeEnabled, shapeBorderWidth, color, noteColor, setActiveTool, startEditing, strokeWidth, penBrush, penOpacity,
    drawingRef, drawingSessionRef, draftRef, vectorDraftRef,
  } = options;

  const { enqueue: enqueueStrokeChange, flush: flushStrokeChanges } = useCanvasStrokeSaveBatch({
    sendBatch: sendStrokeFrameChanges, pendingItemChangesRef, flushRef: strokeSaveFlushRef,
  });
  const cameraMotionRef = useRef({ frame: 0 });
  const cancelPanInertia = () => {
    if (cameraMotionRef.current.frame) cancelAnimationFrame(cameraMotionRef.current.frame);
    cameraMotionRef.current.frame = 0;
    boardRef.current?.classList.remove('camera-coasting');
  };
  useEffect(() => () => {
    if (cameraMotionRef.current.frame) cancelAnimationFrame(cameraMotionRef.current.frame);
  }, []);
  const samplePanVelocity = (pan, event) => {
    const now = performance.now();
    const elapsed = now - pan.lastAt;
    if (elapsed > 0 && elapsed < 90) {
      const instantX = (event.clientX - pan.lastX) / elapsed;
      const instantY = (event.clientY - pan.lastY) / elapsed;
      pan.velocityX = pan.velocityX * 0.55 + instantX * 0.45;
      pan.velocityY = pan.velocityY * 0.55 + instantY * 0.45;
    } else if (elapsed >= 90) {
      pan.velocityX = 0;
      pan.velocityY = 0;
    }
    pan.lastX = event.clientX;
    pan.lastY = event.clientY;
    pan.lastAt = now;
  };
  const queueDrawingStroke = () => {
    const session = drawingSessionRef.current;
    if (!session || !draftRef.current.length) return;
    enqueueStrokeChange(session.id, {
      kind: 'stroke', points: draftRef.current, color: session.color,
      strokeWidth: session.strokeWidth, permission: session.permission,
      brush: session.brush, opacity: session.opacity, simulatePressure: session.simulatePressure, complete: false,
    }, itemsRef.current[session.id] || null);
  };
  const pointerPosition = (event) => {
    const bounds = boardRef.current.getBoundingClientRect();
    return canvasPointAtPointer(event, bounds, camera, boardSize);
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
    const radius = eraserWidth / 2 / Math.max(.01,camera.scale);
    const region = { minX: Math.min(from.x,to.x)-radius/boardSize.width, minY: Math.min(from.y,to.y)-radius/boardSize.height,
      maxX: Math.max(from.x,to.x)+radius/boardSize.width, maxY: Math.max(from.y,to.y)+radius/boardSize.height };
    const entries = spatialIndexRef?.current
      ? spatialIndexRef.current.query(region).filter(entry=>entry.item?.kind === 'stroke').map(entry=>[entry.id,itemsRef.current[entry.id]])
      : Object.entries(itemsRef.current).filter(([, item]) => item?.kind === 'stroke');
    for (const [id, item] of entries) {
      if (itemsRef.current[id]?.kind !== 'stroke') continue;
      const remainingPaths = eraseStrokeWithEraser(item, from, to, boardSize, camera.scale, eraserWidth / 2, eraserMode);
      if (remainingPaths === null) continue;
      const changes={},removed=[];
      if (remainingPaths.length === 0) {
        enqueueStrokeChange(id, null, item);
        removed.push(id);
      } else {
        const updatedItem = { ...item, points: remainingPaths[0] };
        enqueueStrokeChange(id, updatedItem, item);
        changes[id] = updatedItem;
        for (const points of remainingPaths.slice(1)) {
          const fragmentId = createId();
          const fragment = { ...item, points };
          enqueueStrokeChange(fragmentId, fragment, null);
          changes[fragmentId] = fragment;
        }
      }
      patchItems(changes,removed);
    }
  };
  const centeredItemPosition = (width, height) => {
    const bounds = boardRef.current?.getBoundingClientRect();
    const viewWidth = Math.max(1, bounds?.width || boardSize.width);
    const viewHeight = Math.max(1, bounds?.height || boardSize.height);
    return {
      x: (viewWidth / 2 - camera.x) / (boardSize.width * camera.scale) - width / 2,
      y: (viewHeight / 2 - camera.y) / (boardSize.height * camera.scale) - height / 2,
    };
  };
  const cursorSendFrameRef = useRef(0);
  const pendingCursorRef = useRef(null);
  const cursorDeadlineRef = useRef(0);
  const cursorRetryUntilRef = useRef(0);
  const flushCursorFrame = now => {
    if (!cursorIsDue(cursorDeadlineRef.current, now)) {
      cursorSendFrameRef.current = requestAnimationFrame(flushCursorFrame);
      return;
    }
    cursorSendFrameRef.current = 0;
    const payload = pendingCursorRef.current;
    if (payload) {
      if (peerMeshRef.current?.sendCursor(payload) === false && now < cursorRetryUntilRef.current) {
        cursorSendFrameRef.current = requestAnimationFrame(flushCursorFrame);
        return;
      }
      pendingCursorRef.current = null;
      lastCursorSentAtRef.current = now;
      cursorDeadlineRef.current = cursorDeadline(cursorDeadlineRef.current, now);
    }
  };
  useEffect(() => () => cancelAnimationFrame(cursorSendFrameRef.current), []);
  const sendCursorPosition = (event, force = false) => {
    const point = pointerPosition(event);
    const selection = selectionRef.current;
    const payload = { type: 'cursor', x: point.x, y: point.y,
      selection: selection ? { start: selection.start, end: point } : null };
    cursorRetryUntilRef.current = performance.now() + 1000;
    if (force) {
      cancelAnimationFrame(cursorSendFrameRef.current);
      cursorSendFrameRef.current = 0;
      pendingCursorRef.current = null;
      const now = performance.now();
      lastCursorSentAtRef.current = now;
      cursorDeadlineRef.current = now + CURSOR_INTERVAL_MS;
      if (peerMeshRef.current?.sendCursor(payload) === false) {
        pendingCursorRef.current = payload;
        cursorSendFrameRef.current = requestAnimationFrame(flushCursorFrame);
      }
    } else {
      pendingCursorRef.current = payload;
      if (!cursorSendFrameRef.current) cursorSendFrameRef.current = requestAnimationFrame(flushCursorFrame);
    }
  };
  const hideCursor = () => {
    cancelAnimationFrame(cursorSendFrameRef.current);
    cursorSendFrameRef.current = 0;
    pendingCursorRef.current = null;
    const payload = { type: 'cursor', visible: false };
    if (peerMeshRef.current?.sendCursor(payload) === false) {
      pendingCursorRef.current = payload;
      cursorDeadlineRef.current = 0;
      cursorRetryUntilRef.current = performance.now() + 1000;
      cursorSendFrameRef.current = requestAnimationFrame(flushCursorFrame);
    }
    hideEraserCursor();
  };
  const startPan = (event) => {
    if (panRef.current || drawingRef.current) return;
    cancelPanInertia();
    event.preventDefault();
    event.stopPropagation();
    panRef.current = {
      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      lastX: event.clientX, lastY: event.clientY, lastAt: performance.now(),
      velocityX: 0, velocityY: 0, cameraX: camera.x, cameraY: camera.y,
    };
    boardRef.current?.classList.add('panning');
    boardRef.current?.setPointerCapture?.(event.pointerId);
  };
  const zoomBy = (factor, clientX, clientY) => {
    cancelPanInertia();
    const bounds = boardRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const targetX = clientX ?? bounds.left + bounds.width / 2;
    const targetY = clientY ?? bounds.top + bounds.height / 2;
    setCamera(current => zoomCanvasCamera(current, factor,
      { x: targetX - bounds.left, y: targetY - bounds.top }, bounds));
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
    cancelPanInertia();
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      zoomBy(Math.exp(-event.deltaY * 0.003 * zoomSensitivity), event.clientX, event.clientY);
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
    sendCursorPosition(event, true);
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
    sendCursorPosition(event, true);
    setSelectionBox(null);
    if (event.type !== 'pointercancel') {
      const end = pointerPosition(event);
      const marquee = {
        minX: Math.min(selection.start.x, end.x),
        minY: Math.min(selection.start.y, end.y),
        maxX: Math.max(selection.start.x, end.x),
        maxY: Math.max(selection.start.y, end.y),
      };
      const candidates = spatialIndexRef?.current?.query(marquee)
        || Object.entries(itemsRef.current).map(([id,item])=>({id,item,bounds:objectBounds(item,itemsRef.current,boardSize.width,boardSize.height)}));
      const contains = bounds => bounds && bounds.minX >= marquee.minX && bounds.maxX <= marquee.maxX
        && bounds.minY >= marquee.minY && bounds.maxY <= marquee.maxY;
      const hits = candidates.filter(({item,bounds}) => item && ['image','link','code','note','table','shape','text','math','stroke','pdf','user-group'].includes(item.kind) && contains(bounds)).map(({id})=>id);
      const expanded = new Set([...selection.baseIds, ...hits]);
      const selectedGroups = new Set([...expanded].map((id) => itemsRef.current[id]?.groupId).filter(Boolean));
      if (selectedGroups.size) {
        candidates.forEach(({id,item,bounds}) => {
          if (item?.type === 'chat_room' || !item?.groupId || !selectedGroups.has(item.groupId) || ['stroke', 'connector'].includes(item.kind)) return;
          if (contains(bounds)) expanded.add(id);
        });
      }
      selectItems([...expanded]);
    }
    if (boardRef.current?.hasPointerCapture?.(event.pointerId)) boardRef.current.releasePointerCapture(event.pointerId);
  };
  const startDrawing = (event) => {
    if (drawingRef.current || event.button !== 0 && event.button !== 1) return;
    if (activeTool === 'hand') { startPan(event); return; }
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
    if (activeTool === 'user-group') {
      event.preventDefault();
      const point = pointerPosition(event), id = createId();
      const item = { kind: 'user-group', groupTitle: '사용자 그룹', members: user?.user_id != null ? [groupMember(user)] : [], x: point.x - .15, y: point.y - .1, width: .3, height: .2, permission };
      if (!addItem(id, item)) setToast('연결이 복구되면 사용자 그룹을 다시 추가해주세요.');
      else { setActiveTool('select'); selectItems([id]); }
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
    if (activeTool === 'chart') {
      event.preventDefault();
      const point = pointerPosition(event), id = createId();
      const width = .3, height = .25;
      const item = { kind: 'chart', ...newChartData(), x: point.x - width / 2, y: point.y - height / 2, width, height, permission };
      if (!addItem(id, item)) setToast('실시간 서버에 연결된 뒤 그래프를 놓을 수 있어요.');
      else { setActiveTool('select'); selectItems([id]); }
      return;
    }
    if (activeTool === 'shape' || activeTool === 'text' || activeTool === 'markdown' || activeTool === 'math' || activeTool === 'code' || activeTool === 'note') {
      event.preventDefault();
      const point = pointerPosition(event);
      const shapeSize = shapeCreationSize(shapeType, boardSize);
      const itemWidth = activeTool === 'shape' ? shapeSize.width : activeTool === 'math' ? 0.2 : activeTool === 'code' ? 0.32 : activeTool === 'note' ? 0.24 : 0.22;
      const x = point.x - itemWidth / 2;
      const y = point.y - (activeTool === 'shape' ? shapeSize.height / 2 : activeTool === 'code' ? 0.1 : activeTool === 'note' ? 0.08 : 0.06);
      let item;
      if (activeTool === 'shape') item = { kind: 'shape', strokeWidth: shapeBorderWidth, shapeType, fillOpacity: shapeFillOpacity, sketchFillOpacity: shapeSketchFillOpacity, cornerStyle: shapeCornerStyle, ...(hasPolygonVertices(shapeType) ? { vertexCount: shapeVertexCount } : {}), visualStyle: shapeVisualStyle, strokeEnabled: shapeStrokeEnabled, fill: shapeType === 'arrow' ? '' : shapeFillColor, ...(shapeType === 'arrow' ? { bend: DEFAULT_SHAPE_ARROW_BEND, headSize: shapeArrowHeadSize, startHead: shapeArrowStartHead, shapeArrowHeadSize, endHead: shapeArrowEndHead } : {}), x, y, width: itemWidth, height: shapeSize.height, color, permission };
      else if (activeTool === 'text' || activeTool === 'markdown') item = { kind: 'text', text: '', renderMode: 'markdown', ...(activeTool === 'markdown' ? { format: 'markdown' } : {}), x, y, width: itemWidth, permission };
      else if (activeTool === 'note') item = { kind: 'note', text: '', x, y, width: itemWidth, color: noteColor, rotation: Math.random() * 3 - 1.5, permission };
      else if (activeTool === 'code') item = { kind: 'text', text: '', renderMode: 'code', filename: 'idea.js', language: 'javascript', x, y, width: itemWidth, permission };
      else item = { kind: 'text', text: '', renderMode: 'latex', x, y, width: itemWidth, permission };
      const id = createId();
      if (!addItem(id, item)) setToast('실시간 서버에 연결된 뒤 캔버스를 수정할 수 있어요.');
      else {
        setActiveTool('select');
        if (activeTool === 'text' || activeTool === 'markdown' || activeTool === 'code' || activeTool === 'note' || activeTool === 'math') startEditing(id);
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
    const point = inkPointAtPointer(event, pointerPosition(event));
    const strokeId = createId();
    const session = {
      id: strokeId,
      pointerId: event.pointerId,
      brush: penBrush || INK_BRUSH,
      opacity: penOpacity ?? 1,
      simulatePressure: event.pointerType !== 'pen',
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
    vectorDraftRef.current?.({ id: session.id, brush: session.brush, opacity: session.opacity, simulatePressure: session.simulatePressure, complete: false, points: draftRef.current, color: session.color, strokeWidth: session.strokeWidth });
    sendStrokePreviewStart(peerMeshRef.current, session, point);
    queueDrawingStroke();
  };
  const moveDrawing = (event) => {
    if (drawingRef.current && drawingSessionRef.current?.pointerId !== event.pointerId) return;
    updateEraserCursor(event);
    if (selectionRef.current) { moveMarqueeSelection(event); return; }
    if (panRef.current) {
      const pan = panRef.current;
      if (pan.pointerId !== event.pointerId) return;
      samplePanVelocity(pan, event);
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
    const session = drawingSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const bounds = boardRef.current.getBoundingClientRect();
    const added = appendInkInput(event, draftRef.current, {
      toPoint: sample => canvasPointAtPointer(sample, bounds, camera, boardSize),
      size: boardSize, scale: camera.scale, brush: session.brush, maxPoints: MAX_REALTIME_STROKE_POINTS,
    });
    if (!added.length) return;
    session.pendingPoints.push(...added);
    queueDrawingStroke();
    vectorDraftRef.current?.({ id: session.id, brush: session.brush, opacity: session.opacity, simulatePressure: session.simulatePressure, complete: false, points: draftRef.current, color: session.color, strokeWidth: session.strokeWidth });
    const now = performance.now();
    if (now - session.lastSentAt >= REALTIME_STROKE_INTERVAL_MS || session.pendingPoints.length >= REALTIME_STROKE_BATCH_SIZE) {
      sendStrokePreviewPoints(peerMeshRef.current, session, session.pendingPoints.splice(0));
      session.lastSentAt = now;
    }
  };
  const stopDrawing = (event) => {
    if (drawingRef.current && drawingSessionRef.current?.pointerId !== event.pointerId) return;
    if (selectionRef.current) { finishMarqueeSelection(event); return; }
    if (panRef.current) {
      const pan = panRef.current;
      if (pan.pointerId !== event.pointerId) return;
      if (event.type === 'pointerup') samplePanVelocity(pan, event);
      panRef.current = null;
      const stage = boardRef.current;
      stage?.classList.remove('panning');
      if (stage?.hasPointerCapture?.(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      setCamera((current) => ({
        ...current,
        x: pan.cameraX + event.clientX - pan.x,
        y: pan.cameraY + event.clientY - pan.y,
      }));
      if (event.type !== 'pointerup' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      let velocityX = Math.max(-1.25, Math.min(1.25, pan.velocityX * 0.82));
      let velocityY = Math.max(-1.25, Math.min(1.25, pan.velocityY * 0.82));
      if (Math.hypot(velocityX, velocityY) < 0.12) return;
      let previousAt = performance.now();
      stage?.classList.add('camera-coasting');
      const coast = (now) => {
        const elapsed = Math.min(32, Math.max(0, now - previousAt));
        previousAt = now;
        velocityX *= Math.exp(-elapsed / 230);
        velocityY *= Math.exp(-elapsed / 230);
        setCamera((current) => ({ ...current, x: current.x + velocityX * elapsed, y: current.y + velocityY * elapsed }));
        if (Math.hypot(velocityX, velocityY) < 0.025) {
          cameraMotionRef.current.frame = 0;
          stage?.classList.remove('camera-coasting');
          return;
        }
        cameraMotionRef.current.frame = requestAnimationFrame(coast);
      };
      cameraMotionRef.current.frame = requestAnimationFrame(coast);
      return;
    }
    if (eraserRef.current) {
      flushStrokeChanges({ force: true });
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
    if (drawingSessionRef.current?.pointerId !== event.pointerId) return;
    // Capture the final location before pointerup; some devices do not send a
    // pointermove for the last segment. Do not record release pressure (zero).
    if (event.type === 'pointerup') {
      const bounds = boardRef.current.getBoundingClientRect();
      const added = appendInkInput(event, draftRef.current, {
        toPoint: sample => canvasPointAtPointer(sample, bounds, camera, boardSize),
        size: boardSize, scale: camera.scale, brush: drawingSessionRef.current.brush,
        maxPoints: MAX_REALTIME_STROKE_POINTS, final: true,
      });
      drawingSessionRef.current.pendingPoints.push(...added);
    }
    drawingRef.current = false;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const points = draftRef.current;
    const session = drawingSessionRef.current;
    drawingSessionRef.current = null;
    draftRef.current = [];
    vectorDraftRef.current?.(null);
    if (!points.length) return;
    const id = session?.id || createId();
    const item = {
      kind: 'stroke',
      brush: session?.brush || INK_BRUSH,
      opacity: session?.opacity ?? 1,
      simulatePressure: session?.simulatePressure !== false,
      complete: true,
      points,
      color: session?.color || color,
      strokeWidth: session?.strokeWidth || strokeWidth,
      permission: session?.permission || permission,
    };
    if (session) sendStrokePreviewPoints(peerMeshRef.current, session, session.pendingPoints.splice(0));
    enqueueStrokeChange(id, item, itemsRef.current[id] || null);
    patchItems({[id]:item});
    flushStrokeChanges({ force: true });
    const added = true;
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
    cancelPanInertia,
    centeredItemPosition,
    sendCursorPosition,
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
