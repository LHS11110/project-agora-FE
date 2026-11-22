import RawInkQueue from './RawInkQueue.js';
import { ui } from '../i18n/locale.js';
import { cursorDeadline, cursorIsDue, CURSOR_INTERVAL_MS } from './cursorSchedule.js';
import { useEffect, useRef } from 'react';
import { INK_BRUSH, inkPointAtPointer } from './inkStroke.js';
import { appendInkInput, predictInkTip, recordInkMotion } from './inkInput.js';
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
import { buildCreatedObject, computeDraggedCreationRect, DRAG_CREATE_THRESHOLD_PX, isBoxCreationTool } from './objectCreation.js';

export function useCanvasStageInteractions(options) {
  const {
    canCreateProject = false, presentation = false, canWriteItem = () => true, canWriteCanvas = true, isItemSelectable = () => true, boardRef, camera, setCamera, activeTool, eraserRef, eraserCursorRef, itemsRef, boardSize, eraserWidth = ERASER_RADIUS * 2, eraserMode,
    addItem, setToast, setItems, patchItems, refreshSpatialIndex, spatialIndexRef,
    sendStrokeFrameChanges, pendingItemChangesRef, strokeSaveFlushRef,
    lastCursorSentAtRef, peerMeshRef, panRef, zoomHoldRef, zoomPointerPressRef,
    zoomSensitivity, stageWheelHandlerRef, laserDrawingRef, laserColor = LASER_COLOR, setLaserStrokes,
    selectionRef, selectedItemIds, setSelectionBox, setCreationBox, selectItems,
    canvasSnapshotLoadedRef, finishEditing, setConnectionStartId, spacePressedRef,
    user, userGroupTemplateRef, tableConfig, permission, setSharePosition, shapeType, shapeArrowStartHead, shapeArrowHeadSize,
    shapeArrowEndHead, shapeFillColor, shapeFillOpacity, shapeSketchFillOpacity, shapeVertexCount, shapeCornerStyle, shapeVisualStyle, shapeStrokeEnabled, shapeBorderWidth, color, noteColor, setActiveTool, startEditing, strokeWidth, penBrush, penOpacity,
    drawingRef, drawingSessionRef, draftRef, vectorDraftRef,
  } = options;
  const creationDragRef = useRef(null);
  const rawInk=useRef(null),latestInkMove=useRef(null),rawSession=useRef(null);
  if(!rawInk.current)rawInk.current=new RawInkQueue(event=>latestInkMove.current?.(event));
  useEffect(()=>{
    const stage=boardRef.current;if(!stage||!('onpointerrawupdate' in stage))return;
    const receive=event=>{const session=drawingSessionRef.current;if(!drawingRef.current||!session||session.pointerId!==event.pointerId)return;rawSession.current=session;rawInk.current.push(event);};
    stage.addEventListener('pointerrawupdate',receive,{passive:true});
    return()=>{stage.removeEventListener('pointerrawupdate',receive);rawInk.current.clear();rawSession.current=null;};
  },[boardRef,boardRef.current,drawingRef,drawingSessionRef]);

  const { enqueue: enqueueStrokeChange, discard: discardStrokeChange, flush: flushStrokeChanges } = useCanvasStrokeSaveBatch({
    sendBatch: sendStrokeFrameChanges, pendingItemChangesRef, flushRef: strokeSaveFlushRef,
  });
  const cameraMotionRef = useRef({ frame: 0 });
  const cancelPanInertia = () => {
    if (cameraMotionRef.current.frame) cancelAnimationFrame(cameraMotionRef.current.frame);
    cameraMotionRef.current.frame = 0;
    if (boardRef.current?.classList.contains('camera-coasting')) boardRef.current.classList.remove('camera-coasting');
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
    const bounds = getStageBounds();
    return bounds ? canvasPointAtPointer(event, bounds, camera, boardSize) : { x: 0, y: 0 };
  };
  const updateEraserCursor = (event) => {
    if (activeTool !== 'eraser') return;
    const bounds = getStageBounds();
    const cursor = eraserCursorRef.current;
    if (!cursor || !bounds) return;
    cursor.style.transform = `translate3d(${event.clientX - bounds.left}px,${event.clientY - bounds.top}px,0) translate(-50%,-50%)`;
    cursor.classList.add('is-visible');
  };
  const hideEraserCursor = () => eraserCursorRef.current?.classList.remove('is-visible');
  const eraseStrokesBetween = (from, to) => {
    const radius = eraserWidth / 2 / Math.max(.01, camera.scale);
    const region = {
      minX: Math.min(from.x, to.x) - radius / boardSize.width, minY: Math.min(from.y, to.y) - radius / boardSize.height,
      maxX: Math.max(from.x, to.x) + radius / boardSize.width, maxY: Math.max(from.y, to.y) + radius / boardSize.height
    };
    const entries = spatialIndexRef?.current
      ? spatialIndexRef.current.query(region).filter(entry => entry.item?.kind === 'stroke').map(entry => [entry.id, itemsRef.current[entry.id]])
      : Object.entries(itemsRef.current).filter(([, item]) => item?.kind === 'stroke');
    // One eraser sample is one change set: a single patch, history record and
    // redraw instead of one per stroke the eraser touched.
    const changes = {}, removed = [], previous = {};
    for (const [id, item] of entries) {
      if (itemsRef.current[id]?.kind !== 'stroke' || itemsRef.current[id]?.locked === true || !canWriteItem(itemsRef.current[id])) continue;
      const remainingPaths = eraseStrokeWithEraser(item, from, to, boardSize, camera.scale, eraserWidth / 2, eraserMode);
      if (remainingPaths === null) continue;
      previous[id] = item;
      if (remainingPaths.length === 0) removed.push(id);
      else {
        changes[id] = { ...item, points: remainingPaths[0] };
        for (const points of remainingPaths.slice(1)) {
          const fragmentId = createId();
          changes[fragmentId] = { ...item, points };
          previous[fragmentId] = null;
        }
      }
    }
    if (!removed.length && !Object.keys(changes).length) return;
    if (patchItems(changes, removed) !== false) {
      // Applied: drop any older queued state so the 30 Hz batch cannot resend it.
      for (const id of [...removed, ...Object.keys(changes)]) discardStrokeChange(id);
    } else {
      // Not applied now (e.g. reconnecting): keep it queued for the save batch.
      for (const id of removed) enqueueStrokeChange(id, null, previous[id]);
      for (const [id, item] of Object.entries(changes)) enqueueStrokeChange(id, item, previous[id]);
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
    const payload = {
      type: 'cursor', x: point.x, y: point.y,
      selection: selection ? { start: selection.start, end: point } : null
    };
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
  const stageBoundsCacheRef = useRef({ stage: null, rect: null, at: 0 });
  useEffect(() => {
    const stage = boardRef.current;
    if (!stage) return undefined;
    const refresh = () => {
      stageBoundsCacheRef.current = { stage, rect: stage.getBoundingClientRect(), at: performance.now() };
    };
    refresh();
    window.addEventListener('resize', refresh, { passive: true });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(refresh) : null;
    ro?.observe(stage);
    return () => {
      window.removeEventListener('resize', refresh);
      ro?.disconnect();
    };
  }, [boardRef]);
  const getStageBounds = () => {
    const stage = boardRef.current;
    if (!stage) return null;
    const cached = stageBoundsCacheRef.current;
    if (cached.stage === stage && cached.rect) {
      return cached.rect;
    }
    const rect = stage.getBoundingClientRect();
    stageBoundsCacheRef.current = { stage, rect, at: performance.now() };
    return rect;
  };
  const startPan = (event) => {
    if (panRef.current || drawingRef.current) return;
    cancelPanInertia();
    event.preventDefault();
    event.stopPropagation();
    const stage = boardRef.current;
    if (stage) {
      stageBoundsCacheRef.current = { stage, rect: stage.getBoundingClientRect(), at: performance.now() };
    }
    panRef.current = {
      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      lastX: event.clientX, lastY: event.clientY, lastAt: performance.now(),
      velocityX: 0, velocityY: 0, cameraX: camera.x, cameraY: camera.y,
    };
    if (stage && !stage.classList.contains('panning')) stage.classList.add('panning');
    stage?.setPointerCapture?.(event.pointerId);
  };
  const zoomBy = (factor, clientX, clientY) => {
    cancelPanInertia();
    const bounds = getStageBounds();
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
    const target = event.target;
    if (target !== boardRef.current) {
      if (target?.closest?.('.canvas-minimap')) {
        event.preventDefault();
        return;
      }
      if (!panRef.current && editorCanScroll(event)) return;
    }
    if (presentation) { event.preventDefault(); return; }
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
          x: point.x, y: point.y, color: laserColor,
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
    const bounds = getStageBounds();
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
        || Object.entries(itemsRef.current).map(([id, item]) => ({ id, item, bounds: objectBounds(item, itemsRef.current, boardSize.width, boardSize.height) }));
      const contains = bounds => bounds && bounds.minX >= marquee.minX && bounds.maxX <= marquee.maxX
        && bounds.minY >= marquee.minY && bounds.maxY <= marquee.maxY;
      const hits = candidates.filter(({ id, item, bounds }) => item && isItemSelectable(item, id) && ['image', 'link', 'code', 'note', 'table', 'shape', 'text', 'math', 'stroke', 'pdf', 'user-group', 'question', 'value', 'project', 'frame'].includes(item.kind) && contains(bounds)).map(({ id }) => id);
      const expanded = new Set([...selection.baseIds, ...hits]);
      const selectedGroups = new Set([...expanded].map((id) => itemsRef.current[id]?.groupId).filter(Boolean));
      if (selectedGroups.size) {
        candidates.forEach(({ id, item, bounds }) => {
          if (!item || !isItemSelectable(item, id) || item?.type === 'chat_room' || !item?.groupId || !selectedGroups.has(item.groupId) || ['stroke', 'connector'].includes(item.kind)) return;
          if (contains(bounds)) expanded.add(id);
        });
      }
      selectItems([...expanded]);
    }
    if (boardRef.current?.hasPointerCapture?.(event.pointerId)) boardRef.current.releasePointerCapture(event.pointerId);
  };
  const startDrawing = (event) => {
    if (!canWriteCanvas && !['laser', 'anchor'].includes(activeTool)) return;
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
    if (!canvasSnapshotLoadedRef.current || (!['pen', 'laser', 'anchor'].includes(activeTool) && event.target.closest?.('.canvas-object'))) return;
    if (activeTool === 'anchor') { event.preventDefault(); const point = pointerPosition(event); window.dispatchEvent(new CustomEvent('canvas-open-anchors', { detail: { point: { x: point.x * boardSize.width - boardSize.width / 2, y: point.y * boardSize.height - boardSize.height / 2 } } })); setActiveTool('select'); return; }
    if (activeTool === 'eraser') {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = pointerPosition(event);
      eraserRef.current = { ...point, pointerId: event.pointerId };
      eraseStrokesBetween(point, point);
      return;
    }
    if (isBoxCreationTool(activeTool)) {
      if (activeTool === 'project' && !canCreateProject) {
        setToast(ui('프로젝트 생성은 캔버스 관리자만 가능합니다.'));
        return;
      }
      const stage = boardRef.current;
      const bounds = stage?.getBoundingClientRect();
      if (!bounds) return;
      const point = pointerPosition(event);
      creationDragRef.current = {
        tool: activeTool,
        pointerId: event.pointerId,
        start: point,
        current: point,
        startClient: { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      };
      setCreationBox?.(null);
      event.preventDefault();
      event.stopPropagation();
      stage.setPointerCapture?.(event.pointerId);
      return;
    }
    if (activeTool === 'connect') { setToast(ui('연결할 오브젝트 두 개를 차례로 선택하세요.')); return; }
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
        id: key, color: laserColor, points: [point], active: true, updatedAt: now, endedAt: null,
      }]);
      peerMeshRef.current?.sendLaser({ type: 'laser', phase: 'start', stroke_id: strokeId, sequence: 0, x: point.x, y: point.y, color: laserColor });
      return;
    }
    if (activeTool !== 'pen') return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    const point = inkPointAtPointer(event, pointerPosition(event));
    const strokeId = createId();
    const session = {
      id: strokeId,
      pointerId: event.pointerId,
      pendingTouchStart: event.pointerType === 'touch',
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
    if (!session.pendingTouchStart) {
      sendStrokePreviewStart(peerMeshRef.current, session, point);
      queueDrawingStroke();
    }
  };
  // The draft is painted synchronously in the input task. A short settle timer
  // removes a predicted tip once the pointer stops sending samples.
  const paintDraft = (session, predicted = []) => {
    clearTimeout(session.settleTimer);
    vectorDraftRef.current?.({ id: session.id, brush: session.brush, opacity: session.opacity, simulatePressure: session.simulatePressure, complete: false, points: draftRef.current, predicted: predicted.length ? predicted : undefined, color: session.color, strokeWidth: session.strokeWidth });
    if (predicted.length) session.settleTimer = setTimeout(() => {
      if (drawingSessionRef.current !== session) return;
      session.predicted = false;
      paintDraft(session);
    }, 32);
  };
  const moveDrawing = (event) => {
    if(event.type!=='pointerrawupdate'&&drawingRef.current&&rawSession.current===drawingSessionRef.current)return;
    if (drawingRef.current && drawingSessionRef.current?.pointerId !== event.pointerId) return;
    updateEraserCursor(event);
    if (creationDragRef.current) {
      const drag = creationDragRef.current;
      if (drag.pointerId !== event.pointerId) return;
      const bounds = getStageBounds();
      if (!bounds) return;
      const point = pointerPosition(event);
      drag.current = point;
      const distance = Math.hypot(event.clientX - bounds.left - drag.startClient.x, event.clientY - bounds.top - drag.startClient.y);
      if (distance < DRAG_CREATE_THRESHOLD_PX) {
        setCreationBox?.(null);
        return;
      }
      const rect = computeDraggedCreationRect(drag.start, point, boardSize, { tool: drag.tool, keepSquare: Boolean(event.shiftKey) });
      setCreationBox?.({
        left: camera.x + rect.x * boardSize.width * camera.scale,
        top: camera.y + rect.y * boardSize.height * camera.scale,
        width: rect.width * boardSize.width * camera.scale,
        height: rect.height * boardSize.height * camera.scale,
        label: `${Math.round(rect.width * boardSize.width)} × ${Math.round(rect.height * boardSize.height)}`,
      });
      return;
    }
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
      eraserRef.current = { ...point, pointerId: event.pointerId };
      return;
    }
    if (laserDrawingRef.current) {
      recordLaserPoint(pointerPosition(event));
      return;
    }
    if (!drawingRef.current) return;
    const session = drawingSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const bounds = getStageBounds();
    if(!bounds)return;
    const toPoint = sample => canvasPointAtPointer(sample, bounds, camera, boardSize);
    recordInkMotion(session.motion ||= [], event);
    const added = appendInkInput(event, draftRef.current, {
      toPoint, size: boardSize, scale: camera.scale, brush: session.brush, maxPoints: MAX_REALTIME_STROKE_POINTS,
    });
    // Paint the tip where the pointer is heading even when the sample is below the
    // storage threshold; predictions are display-only and never saved or sent.
    const predicted = predictInkTip(event, session.motion).map(sample => ({ ...toPoint(sample), ...(Number.isFinite(draftRef.current.at(-1)?.pressure) ? { pressure: draftRef.current.at(-1).pressure } : {}) }));
    if (!added.length && !predicted.length && !session.predicted) return;
    if (added.length) {
      if (session.pendingTouchStart) {
        session.pendingTouchStart = false;
        sendStrokePreviewStart(peerMeshRef.current, session, draftRef.current[0]);
      }
      session.pendingPoints.push(...added);
      queueDrawingStroke();
    }
    session.predicted = predicted.length > 0;
    paintDraft(session, predicted);
    const now = performance.now();
    if (now - session.lastSentAt >= REALTIME_STROKE_INTERVAL_MS || session.pendingPoints.length >= REALTIME_STROKE_BATCH_SIZE) {
      sendStrokePreviewPoints(peerMeshRef.current, session, session.pendingPoints.splice(0));
      session.lastSentAt = now;
    }
  };
  latestInkMove.current=moveDrawing;
  const stopDrawing = (event) => {
    rawInk.current.flush();rawSession.current=null;
    if (creationDragRef.current && creationDragRef.current.pointerId === event.pointerId) {
      const drag = creationDragRef.current;
      creationDragRef.current = null;
      setCreationBox?.(null);
      const stage = boardRef.current;
      if (stage?.hasPointerCapture?.(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      if (event.type === 'pointercancel') return;
      const bounds = stage?.getBoundingClientRect();
      const dragged = Boolean(bounds && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
        && Math.hypot(event.clientX - bounds.left - drag.startClient.x, event.clientY - bounds.top - drag.startClient.y) >= DRAG_CREATE_THRESHOLD_PX);
      const endPoint = dragged && bounds ? pointerPosition(event) : drag.start;
      const placement = dragged
        ? { dragged: true, ...computeDraggedCreationRect(drag.start, endPoint, boardSize, { tool: drag.tool, keepSquare: Boolean(event.shiftKey) }) }
        : { dragged: false, point: drag.start };
      if (drag.tool === 'link') {
        setSharePosition(dragged
          ? { x: placement.x + placement.width / 2, y: placement.y + placement.height / 2, bounds: { x: placement.x, y: placement.y, width: placement.width, height: placement.height } }
          : drag.start);
        return;
      }
      const created = buildCreatedObject(drag.tool, placement, {
        boardSize,
        permission,
        user,
        userGroupTemplate: userGroupTemplateRef?.current,
        tableConfig,
        shapeType,
        shapeArrowStartHead,
        shapeArrowHeadSize,
        shapeArrowEndHead,
        shapeFillColor,
        shapeFillOpacity,
        shapeSketchFillOpacity,
        shapeVertexCount,
        shapeCornerStyle,
        shapeVisualStyle,
        shapeStrokeEnabled,
        shapeBorderWidth,
        color,
        noteColor,
      });
      if (!created.item) return;
      const id = createId();
      if (!addItem(id, created.item)) setToast(created.errorToast);
      else {
        setActiveTool('select');
        if (created.startEditing) startEditing(id);
        else if (created.selectAfterCreate) selectItems([id]);
      }
      return;
    }
    if (drawingRef.current && drawingSessionRef.current?.pointerId !== event.pointerId) return;
    if (selectionRef.current) { finishMarqueeSelection(event); return; }
    if (panRef.current) {
      const pan = panRef.current;
      if (pan.pointerId !== event.pointerId) return;
      if (event.type === 'pointerup') samplePanVelocity(pan, event);
      panRef.current = null;
      const stage = boardRef.current;
      if (stage?.classList.contains('panning')) stage.classList.remove('panning');
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
      if (stage && !stage.classList.contains('camera-coasting')) stage.classList.add('camera-coasting');
      const coast = (now) => {
        const elapsed = Math.min(32, Math.max(0, now - previousAt));
        previousAt = now;
        velocityX *= Math.exp(-elapsed / 230);
        velocityY *= Math.exp(-elapsed / 230);
        setCamera((current) => ({ ...current, x: current.x + velocityX * elapsed, y: current.y + velocityY * elapsed }));
        if (Math.hypot(velocityX, velocityY) < 0.025) {
          cameraMotionRef.current.frame = 0;
          if (stage?.classList.contains('camera-coasting')) stage.classList.remove('camera-coasting');
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
    if (drawingSessionRef.current?.pendingTouchStart && event.type === 'pointercancel') {
      drawingRef.current = false; drawingSessionRef.current = null; draftRef.current = [];
      vectorDraftRef.current?.(null);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (drawingSessionRef.current?.pendingTouchStart) {
      drawingSessionRef.current.pendingTouchStart = false;
      sendStrokePreviewStart(peerMeshRef.current, drawingSessionRef.current, draftRef.current[0]);
    }
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
    if (session) clearTimeout(session.settleTimer);
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
    // The finished stroke supersedes any queued partial state. When it is applied
    // directly, do not resend a copy through the batch.
    const previousStroke = itemsRef.current[id] || null;
    if (patchItems({ [id]: item }) !== false) discardStrokeChange(id);
    else enqueueStrokeChange(id, item, previousStroke);
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
  const cancelStageGesture = (point = {}) => {
    const stage = boardRef.current;
    const pointerId = drawingSessionRef.current?.pointerId ?? eraserRef.current?.pointerId ?? panRef.current?.pointerId ?? selectionRef.current?.pointerId ?? creationDragRef.current?.pointerId ?? point.pointerId;
    stopDrawing({ ...point, pointerId, type: 'pointercancel', currentTarget: stage, target: stage });
  };
  return {
    cancelStageGesture,
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
