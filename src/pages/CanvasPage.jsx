import CanvasAxisTicks from '../canvas/CanvasAxisTicks.jsx';
import CanvasPresenceStack from '../components/canvas/CanvasPresenceStack.jsx';
import { onlineCanvasParticipants } from '../canvas/onlineParticipants.js';
import LanguageSwitcher from '../i18n/LanguageSwitcher.jsx';
import CanvasQuickDock from '../canvas/CanvasQuickDock.jsx';
import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import useCanvasChrome from '../canvas/panels/useCanvasChrome.js';
import ChromeToggle from '../canvas/panels/ChromeToggle.jsx';
import '../canvas/panels/canvas-chrome.css';
import { logicPorts } from '../canvas/logicGates.js';
import useCanvasKeyboardNudge from '../canvas/useCanvasKeyboardNudge.js';
import { validShapeAppearance } from '../canvas/shapeAppearance.js';
import { isVolumeShape } from '../canvas/volumeGeometry.js';
import { overviewScale } from '../canvas/sceneRepresentation.js';
import { numericObjectPatch } from '../canvas/objectNumericGeometry.js';
import SceneViewModel from '../canvas/SceneViewModel.js';
import { itemCount } from '../canvas/itemSnapshots.js';
import { useCanvasCamera } from '../canvas/useCanvasCamera.js';
import { isRasterText } from '../canvas/plainTextRaster.js';
import CanvasLayerObjects from '../canvas/CanvasLayerObjects.jsx';
import { buildDepthLayers, itemDepth } from '../canvas/itemDepth.js';
import CanvasMinimapObjects from '../canvas/CanvasMinimapObjects.jsx';
import { hitTestVector } from '../canvas/vectorHitTest.js';
import { renderWindow } from '../canvas/renderWindow.js';
import { handleObjectDoubleClick } from '../canvas/objectDoubleClick.js';
import StableSpatialQuery from '../canvas/StableSpatialQuery.js';
import { usePdfUpload } from '../canvas/pdf/usePdfUpload.js';
import { useCanvasBackground } from '../canvas/background/useCanvasBackground.js';
import { useParticipantProfiles } from '../canvas/useParticipantProfiles.js';
import ResizablePanel from '../canvas/panels/ResizablePanel.jsx';
import { usePanelLayout } from '../canvas/panels/usePanelLayout.js';
import { useObjectClipboard } from '../canvas/clipboard/useObjectClipboard.js';
import { MAX_BEND_POINTS, connectorBendPatch, resizeConnectorControls } from '../canvas/connectors/controlPoints.js';
import { isContentMode, isTextContent } from '../canvas/content/contentPresentation.js';
import { applyTextColor, colorRangesFromDoc, TEXT_COLOR_MARK } from '../canvas/content/textColors.js';
import { isCodeLanguage } from '../canvas/codeLanguages.js';
import { useContentSettings } from '../canvas/content/useContentSettings.js';
import { CONNECTOR_METRICS_EVENT } from '../canvas/connectors/objectMetrics.js';
import CanvasAsCodeDialog from '../canvas/asCode/CanvasAsCodeDialog.jsx';
import { createBlueprintStore } from '../canvas/runtime/blueprintStore.js';
import { executeCanvasCode } from '../canvas/runtime/executeCanvasCode.js';
import { useCommentsAndMentions } from '../canvas/comments/useCommentsAndMentions.js';
import ObjectCommentsPanel from '../canvas/comments/ObjectCommentsPanel.jsx';
import MentionNotifications from '../canvas/comments/MentionNotifications.jsx';
import { uniqueCanvasParticipants } from '../canvas/canvasParticipants.js';
import { useCanvasAsCode } from '../canvas/asCode/useCanvasAsCode.js';
import { isInternalEditorPointer } from '../canvas/editorInteraction.js';
import { usePenStyle } from '../canvas/usePenStyle.js';
import { isObjectFontSize, hasIndependentContentSize } from '../canvas/objectSize.js';
import { canvasGridStyle } from '../canvas/canvasGrid.js';
import { useEraserSize } from '../canvas/useEraserSize.js';
import { useCanvasPalette } from '../canvas/useCanvasPalette.js';
import { stagePointerHandlers } from '../canvas/stagePointerHandlers.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Automerge from '@automerge/automerge/slim';
import automergeWasmUrl from '@automerge/automerge/automerge.wasm?url';
import { Link, useNavigate, useParams } from '../routing.jsx';
import Icon from '../components/Icon.jsx';
import InteractiveAtmosphere from '../components/frelog/InteractiveAtmosphere.jsx';
import ShareComposer from '../components/ShareComposer.jsx';
import VectorLayer from '../canvas/DepthVectorLayer.jsx';
import { SocketSendBudget } from '../canvas/socketSendBudget.js';
import { GRAPHICS_QUALITY_KEY, normalizeGraphicsQuality } from '../canvas/graphicsQuality.js';
import LaserLayer from '../components/LaserLayer.jsx';
import RotationHandles from '../components/CanvasRotationHandles.jsx';
import GroupRotationHandles from '../components/GroupRotationHandles.jsx';
import { useGroupShortcuts } from '../canvas/useGroupShortcuts.js';
import CanvasSpatialBTree, { objectBounds } from '../components/CanvasSpatialBTree.js';
import CanvasToolPanel from '../canvas/CanvasToolPanel.jsx';
import RemoteCursorLayer from '../components/canvas/RemoteCursorLayer.jsx';
import SettingsDialog from '../components/canvas/CanvasSettingsDialog.jsx';
import CanvasParticipantsDialog from '../components/canvas/CanvasParticipantsDialog.jsx';
import CanvasInspectorPanel from '../components/canvas/CanvasInspectorPanel.jsx';
import CanvasChatPanel from '../components/canvas/CanvasChatPanel.jsx';
import CanvasLoadingStatus from '../components/canvas/CanvasLoadingStatus.jsx';
import { CHAT_HISTORY_LIMIT, CHAT_ROOM_ID } from '../canvas/canvasChat.js';
import { createId } from '../canvas/canvasIds.js';
import {
  canPeerAccessItem,
  collaborativeContent,
  collaborativeField,
  createActorId,
  decodeBase64,
  encodeBase64,
  isCollaborativeItem,
  makeCollaborativeItem,
  nextPeerSyncVersion,
} from '../canvas/collaborativeSync.js';
import { LASER_FADE_MS, MAX_STROKE_WIDTH, MIN_STROKE_WIDTH, stickyNoteColors, MIN_ZOOM_SENSITIVITY, MAX_ZOOM_SENSITIVITY } from '../canvas/canvasConstants.js';
import { textSpliceBetween } from '../canvas/collaborativeText.js';
import { isCanvasSyncItem, useCanvasPeerGeometry } from '../canvas/useCanvasPeerGeometry.js';
import { useServerCanvas } from '../canvas/sync/useServerCanvas.js';
import { applyStrokeFrame } from '../canvas/strokeFrameChanges.js';
import { useCanvasStageInteractions } from '../canvas/useCanvasStageInteractions.js';
import { useCanvasPeerEvents } from '../canvas/useCanvasPeerEvents.js';
import { useCanvasObjectInteractions } from '../canvas/useCanvasObjectInteractions.js';
import { useCanvasConnection } from '../canvas/useCanvasConnection.js';
import { formatCanvasZoom, CANVAS_SPACE, fitCanvasCamera } from '../canvas/canvasSpace.js';
import { useCanvasViewport } from '../canvas/useCanvasViewport.js';
import { useCanvasMinimap } from '../canvas/useCanvasMinimap.js';
import { useCanvasServerChangeQueue } from '../canvas/useCanvasServerChangeQueue.js';
import { connectorGeometry } from '../components/connectorGeometry.js';
import { DEFAULT_ARROW_END_HEAD, DEFAULT_ARROW_START_HEAD, normalizeArrowHead } from '../components/arrowheadGeometry.js';
import { DEFAULT_SHAPE_ARROW_BEND, shapeArrowGeometry, resizeShapeArrowControls, shapeArrowBendPatch } from '../components/shapeArrowGeometry.js';
import { normalizeTableCount, resizeTableData, MAX_TABLE_COLUMNS, MAX_TABLE_ROWS } from '../components/tableModel.js';
import { useAuth } from '../state/AuthContext.jsx';

import '../canvas/canvas-studio.css';

const ZOOM_SENSITIVITY_KEY = 'agora_canvas_zoom_sensitivity';
const STROKE_WIDTH_KEY = 'agora_canvas_stroke_width';
const automergeReady = Automerge.initializeWasm(automergeWasmUrl);

function CanvasWorkspace() {
  useUiLocale();
  const [showCanvasCode, setShowCanvasCode] = useState(false);
  const { canvasId } = useParams();
  const { token, user } = useAuth();
  const runtimeRequestRef = useRef(null);
  runtimeRequestRef.current = request => executeCanvasCode({ ...request, canvasId, token, user });
  const saveBlueprintOutputRef = useRef(() => false);
  const runtimeStore = useMemo(() => createBlueprintStore({ getItems: () => itemsRef.current,
    execute: request => runtimeRequestRef.current(request), saveOutput: (id, records) => saveBlueprintOutputRef.current(id, records) }), []);
  useEffect(() => { runtimeStore.resume(); return () => runtimeStore.dispose(); }, [runtimeStore]);
  const navigate = useNavigate();
  const boardRef = useRef(null);
  const cancelCameraMotionRef = useRef(() => {});
  const sceneRef = useRef(null);
  const selectionRef = useRef(null);
  const stageWheelHandlerRef = useRef(null);
  const wsRef = useRef(null);
  const strokeSaveFlushRef = useRef(null);
  const rtcWsRef = useRef(null);
  const autoReconnectRef = useRef(false);
  const serverReconnectRequestedRef = useRef(false);
  const reconnectRequestRef = useRef(null);
  const canvasSnapshotLoadedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const itemsRef = useRef({});
  const pendingItemChangesRef = useRef([]);
  const {
    enqueue: enqueueServerChange,
    markSent: markServerChangeSent,
    acknowledge: acknowledgeServerChange,
    reject: rejectServerChange,
    pending: getPendingServerChanges,
    replacePersistedItems,
  } = useCanvasServerChangeQueue();
  const rejectedEventPongsRef = useRef(0);
  const syncClockRef = useRef(Date.now());
  const syncActorRef = useRef(null);
  if (!syncActorRef.current) syncActorRef.current = createId();
  const itemSyncVersionsRef = useRef(new Map());
  const deletedItemSyncVersionsRef = useRef(new Map());
  const pendingPeerItemEventsRef = useRef(new Map());
  const pendingPeerItemEventsSizeRef = useRef(0);
  const collaborativeDocsRef = useRef(new Map());
  const collaborativeBaseDocsRef = useRef(new Map());
  const groupsRef = useRef([]);
  const dirtyItemsRef = useRef(new Set());
  const peerMeshRef = useRef(null);
  const stageOfflineGeometryRef = useRef(null);
  const {
    sendPeerItemGeometry,
    sendRealtimePeerItemGeometry,
    clearPeerItemGeometryBroadcast,
  } = useCanvasPeerGeometry({
    peerMeshRef,
    syncClockRef,
    syncActorRef,
    itemSyncVersionsRef,
    canPeerAccessItem,
    nextPeerSyncVersion,
    onLocalGeometryRef: stageOfflineGeometryRef,
  });
  const remoteCursorUpdaterRef = useRef(null);
  const syncedPeersRef = useRef(new Set());
  const newCollaborativeItemsRef = useRef(new Set());
  const saveCollaborativeItemRef = useRef(null);
  const editingIdRef = useRef(null);
  const chatHistoryRequestRef = useRef(null);
  const chatHistoryPageRef = useRef({ hasMore: false, nextToSequence: null });
  const itemEditRevisionRef = useRef(new Map());
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const zoomHoldRef = useRef(null);
  const zoomPointerPressRef = useRef(false);
  const spacePressedRef = useRef(false);
  const lastCursorSentAtRef = useRef(0);
  const drawingRef = useRef(false);
  const drawingSessionRef = useRef(null);
  const remoteDrawingStrokesRef = useRef(new Map());
  const laserDrawingRef = useRef(null);
  const eraserRef = useRef(null);
  const eraserCursorRef = useRef(null);
  const draftRef = useRef([]);
  const vectorDraftRef = useRef(null);
  const chrome = useCanvasChrome();
  const [canvas, setCanvas] = useState(null);
  const [spatialRevision, setSpatialRevision] = useState(0);
  const [groups, setGroups] = useState([]);
  const [peerList, setPeerList] = useState([]);
  const [remoteEditors, setRemoteEditors] = useState({});
  const [remoteDrawingStrokes, setRemoteDrawingStrokes] = useState([]);
  const [laserStrokes, setLaserStrokes] = useState([]);
  const [dirtyItems, setDirtyItems] = useState(() => new Set());
  const [camera, setCamera] = useCanvasCamera(boardRef,sceneRef);
  const boardSize = CANVAS_SPACE;
  const [zoomSensitivity, setZoomSensitivity] = useState(() => {
    const stored = Number(localStorage.getItem(ZOOM_SENSITIVITY_KEY));
    return Number.isFinite(stored) && stored >= MIN_ZOOM_SENSITIVITY && stored <= MAX_ZOOM_SENSITIVITY ? stored : 1;
  });
  const [settings, setSettings] = useState(null);
  const [connection, setConnection] = useState('connecting');
  const [reconnectEpoch, setReconnectEpoch] = useState(0);
  const [error, setError] = useState('');
  const { eraserWidth, changeEraserWidth, eraserMode, changeEraserMode } = useEraserSize();
  const [activeTool, setActiveTool] = useState('select');
  const [sharePosition, setSharePosition] = useState(null);
  const { color, setColor, favoriteColors, saveFavoriteColor } = useCanvasPalette();
  const [connectorColor, setConnectorColor] = useState('#8b8f8c');
  const [connectorWidth, setConnectorWidth] = useState(1.5);
  const [connectorHeadSize, setConnectorHeadSize] = useState(14);
  const [connectorStartHead, setConnectorStartHead] = useState(DEFAULT_ARROW_START_HEAD);
  const [connectorEndHead, setConnectorEndHead] = useState(DEFAULT_ARROW_END_HEAD);
  const [shapeArrowHeadSize, setShapeArrowHeadSize] = useState(14);
  const [shapeArrowStartHead, setShapeArrowStartHead] = useState(DEFAULT_ARROW_START_HEAD);
  const [shapeArrowEndHead, setShapeArrowEndHead] = useState(DEFAULT_ARROW_END_HEAD);
  const [noteColor, setNoteColor] = useState(stickyNoteColors[0]);
  const [tableConfig, setTableConfig] = useState({ rows: 3, columns: 3, width: 42, height: 32 });
  const { penBrush, penOpacity, changePenBrush, changePenOpacity } = usePenStyle();
  const [strokeWidth, setStrokeWidth] = useState(() => {
    const stored = Number(localStorage.getItem(STROKE_WIDTH_KEY));
    return Number.isFinite(stored) && stored >= MIN_STROKE_WIDTH && stored <= MAX_STROKE_WIDTH ? stored : 4;
  });
  const [theme, setTheme] = useState(() => localStorage.getItem('agora_canvas_theme') || 'light');
  const [graphicsQuality, setGraphicsQuality] = useState(() => normalizeGraphicsQuality(localStorage.getItem(GRAPHICS_QUALITY_KEY)));
  const changeGraphicsQuality = value => {
    const next = normalizeGraphicsQuality(value);
    setGraphicsQuality(next);
    localStorage.setItem(GRAPHICS_QUALITY_KEY, next);
  };
  const [showGrid, setShowGrid] = useState(() => localStorage.getItem('agora_canvas_grid') !== 'false');
  const [showXAxis, setShowXAxis] = useState(() => localStorage.getItem('agora_canvas_x_axis') !== 'false');
  const [showYAxis, setShowYAxis] = useState(() => localStorage.getItem('agora_canvas_y_axis') !== 'false');
  const [shapeType, setShapeType] = useState('rectangle');
  const [shapeFillColor, setShapeFillColor] = useState('');
  const [shapeFillWasSet, setShapeFillWasSet] = useState(false);
  const changeShapeFillColor = value => { setShapeFillWasSet(true); setShapeFillColor(value); };
  const [shapeFillOpacity, setShapeFillOpacity] = useState(1);
  const [shapeSketchFillOpacity, setShapeSketchFillOpacity] = useState(.8);
  const [shapeVertexCount, setShapeVertexCount] = useState(6);
  const [shapeCornerStyle, setShapeCornerStyle] = useState('sharp');
  const updateNewShapeGeometry = (field, value) => {
    if (!validShapeAppearance(field, value)) return;
    if (field === 'vertexCount') setShapeVertexCount(value);
    if (field === 'cornerStyle') setShapeCornerStyle(value);
  };
  const changeShapeType = type => {
    setShapeType(type);
    if (isVolumeShape(type) && !shapeFillWasSet) setShapeFillColor('#b8a9e8');
    setShapeVertexCount(({ triangle: 3, pentagon: 5, hexagon: 6, star: 5 })[type] || 6);
  };
  const [shapeVisualStyle, setShapeVisualStyle] = useState('standard');
  const [shapeStrokeEnabled, setShapeStrokeEnabled] = useState(true);
  const [shapeBorderWidth, setShapeBorderWidth] = useState(2.5);
  const [connectorVisualStyle, setConnectorVisualStyle] = useState('standard');
  const [connectionStartId, setConnectionStartId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [selectionBox, setSelectionBox] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatHighlight, setChatHighlight] = useState(null);
  const [chatJumpNote, setChatJumpNote] = useState(null);
  const requestedChatMention = useRef(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [settingsPending, setSettingsPending] = useState(false);
  const [toast, setToast] = useState('');
  const { items, setItems, patchItems, moveItems, flushMoves, committedItemsRef, status: hostStatus, sessionRef: hostSessionRef, receiveServerItems, receiveServerEvent } = useServerCanvas({
    itemsRef, peerMeshRef, wsRef, rtcWsRef, collaborativeDocsRef, collaborativeBaseDocsRef, setToast, setDirtyItems, reconnectRequestRef,
  });
  saveBlueprintOutputRef.current = (id, records) => {
    const previous = itemsRef.current[id];
    if (!hostStatus.editable || previous?.runtimeRole !== 'output') return false;
    patchItems({ [id]: { ...previous, runtimeResults: records } });
    return true;
  };
  const hostReadyRef = useRef(false);
  hostReadyRef.current = hostStatus.editable;
  useEffect(() => {
    if (hostStatus.editable) return;
    setShowSettings(false); setShowParticipants(false); setShowCanvasCode(false);
    setEditingId(null); editingIdRef.current = null;
    dragRef.current = null; drawingRef.current = false;
  }, [hostStatus.editable]);
  const selectItems = useCallback((ids, primaryId) => {
    const normalized = [...new Set((ids || []).filter((id) => id != null).map(String))];
    setSelectedItemIds(normalized);
    setSelectedItemId(normalized.length ? String(primaryId ?? normalized[normalized.length - 1]) : null);
  }, []);
  groupsRef.current = groups;
  dirtyItemsRef.current = dirtyItems;
  useEffect(() => { if (activeTool !== 'link') setSharePosition(null); }, [activeTool]);

  const sendRaw = useCallback((payload) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    const request = payload?.type === 'ping' || payload?.type === 'pong' || payload?.request_id
      ? payload : { ...payload, request_id: createId() };
    socket.send(JSON.stringify(request)); return true;
  }, []);
  const comments = useCommentsAndMentions({ sendRaw, connection, user, canvasId });
  const chatEventsRef = useRef(null);
  chatEventsRef.current = comments;
  const rtcSendBudgetRef=useRef(new SocketSendBudget());
  const sendRtcRaw = useCallback((payload) => {
    const socket = rtcWsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    const request = payload?.request_id ? payload : { ...payload, request_id: createId() };
    return rtcSendBudgetRef.current.send(socket,request);
  }, []);
  const requestChatHistory = useCallback((toSequence, aroundSequence) => {
    if (chatHistoryRequestRef.current) return false;
    const requestId = createId();
    const payload = { type: 'chat_history', room_id: CHAT_ROOM_ID, request_id: requestId };
    if (aroundSequence) { payload.from_sequence = Math.max(1, aroundSequence - 10); payload.to_sequence = aroundSequence + 10; }
    else if (toSequence == null) payload.limit = CHAT_HISTORY_LIMIT;
    else payload.to_sequence = toSequence;
    chatHistoryRequestRef.current = requestId;
    if (!sendRaw(payload)) {
      chatHistoryRequestRef.current = null;
      return false;
    }
    setChatHistoryLoading(true);
    return true;
  }, [sendRaw]);
  const loadOlderMessages = useCallback(() => {
    const { hasMore, nextToSequence } = chatHistoryPageRef.current;
    if (hasMore && nextToSequence != null) requestChatHistory(nextToSequence);
  }, [requestChatHistory]);
  useEffect(() => {
    if (!chatJumpNote || chatHistoryLoading || messages.some(entry => entry.id === chatJumpNote.id) || requestedChatMention.current === chatJumpNote.key) return;
    if (requestChatHistory(null, chatJumpNote.sequence)) requestedChatMention.current = chatJumpNote.key;
  }, [chatJumpNote, chatHistoryLoading, messages, requestChatHistory]);
  const markItemDirty = useCallback((id) => {
    const key = String(id);
    itemEditRevisionRef.current.set(key, (itemEditRevisionRef.current.get(key) || 0) + 1);
    dirtyItemsRef.current = new Set(dirtyItemsRef.current).add(key);
    setDirtyItems((current) => new Set(current).add(key));
  }, []);
  stageOfflineGeometryRef.current = null;
  const spatialDirtyIds=useRef(null);
  const refreshSpatialIndex = useCallback(event=>{
    const ids=Array.isArray(event)?event:event?.changedItemIds;
    if(Array.isArray(ids) && spatialDirtyIds.current!==null)for(const id of ids)spatialDirtyIds.current.add(String(id));
    else if(!Array.isArray(ids))spatialDirtyIds.current=null;
    setSpatialRevision(revision=>revision+1);
  }, []);
  useEffect(() => {
    window.addEventListener(CONNECTOR_METRICS_EVENT, refreshSpatialIndex);
    return () => window.removeEventListener(CONNECTOR_METRICS_EVENT, refreshSpatialIndex);
  }, [refreshSpatialIndex]);
  const getCollaborativeDoc = useCallback((id, item) => {
    const key = String(id);
    let doc = collaborativeDocsRef.current.get(key);
    if (doc) return doc;
    try {
      const baseDoc = item?.automerge_snapshot
        ? Automerge.load(decodeBase64(item.automerge_snapshot), { actor: createActorId() })
        : Automerge.from({ content: collaborativeContent(item || { kind: 'text' }) });
      collaborativeBaseDocsRef.current.set(key, baseDoc);
      doc = baseDoc;
      for (const entry of item?.automerge_changes || []) {
        const encoded = typeof entry === 'string' ? entry : entry?.change;
        if (encoded) doc = Automerge.loadIncremental(doc, decodeBase64(encoded));
      }
    } catch {
      doc = Automerge.from({ content: collaborativeContent(item || { kind: 'text' }) });
      collaborativeBaseDocsRef.current.set(key, doc);
    }
    collaborativeDocsRef.current.set(key, doc);
    return doc;
  }, []);
  const getCollaborativeBaseDoc = useCallback((id, item) => {
    const key = String(id);
    let baseDoc = collaborativeBaseDocsRef.current.get(key);
    if (!baseDoc) {
      getCollaborativeDoc(key, item);
      baseDoc = collaborativeBaseDocsRef.current.get(key);
    }
    return baseDoc;
  }, [getCollaborativeDoc]);
  const updateCollaborativeText = useCallback((id, value) => {
    const item = itemsRef.current[id];
    if (!isCollaborativeItem(item)) return;
    const previousDoc = getCollaborativeDoc(id, item);
    let nextDoc;
    try {
      const change = textSpliceBetween(previousDoc.content, value);
      nextDoc = Automerge.change(previousDoc, (draft) => {
        if (change.deleteCount || change.insertText) {
          Automerge.splice(draft, ['content'], change.index, change.deleteCount, change.insertText);
        }
      });
    } catch {
      return;
    }
    if (nextDoc.content === previousDoc.content) return;
    collaborativeDocsRef.current.set(String(id), nextDoc);
    const field = collaborativeField(item);
    const encodedChange = Automerge.getLastLocalChange(nextDoc);
    const change = encodedChange ? encodeBase64(encodedChange) : null;
    const nextItem = { ...item, [field]: nextDoc.content };
    patchItems({[id]:nextItem});
    if (change) {
      const version = nextPeerSyncVersion(syncClockRef, syncActorRef);
      itemSyncVersionsRef.current.set(String(id), version);
      peerMeshRef.current?.sendData({ type: 'doc_change', item_id: String(id), field, change, version }, (peer) => canPeerAccessItem(item, peer));
    }
    markItemDirty(id);
  }, [getCollaborativeDoc, markItemDirty, patchItems]);
  const updateTextColor = useCallback((id, start, end, color) => {
    const key = String(id), item = itemsRef.current[key];
    if (item?.kind !== 'text' || !hostSessionRef.current.editable) return false;
    const previous = getCollaborativeDoc(key, item);
    let next;
    try { next = applyTextColor(previous, start, end, color); } catch { return false; }
    if (next === previous) return false;
    collaborativeDocsRef.current.set(key, next);
    patchItems({ [key]: { ...item } });
    markItemDirty(key);
    return true;
  }, [getCollaborativeDoc, markItemDirty, patchItems]);
  const replaceTextColors = useCallback((id, ranges) => {
    const key = String(id), item = itemsRef.current[key];
    if (item?.kind !== 'text' || !hostSessionRef.current.editable) return false;
    const previous = getCollaborativeDoc(key, item);
    if (JSON.stringify(colorRangesFromDoc(previous)) === JSON.stringify(ranges)) return true;
    let next;
    try {
      next = Automerge.change(previous, draft => {
        if (draft.content.length) Automerge.unmark(draft, ['content'], { start: 0, end: draft.content.length, expand: 'none' }, TEXT_COLOR_MARK);
        for (const range of ranges) Automerge.mark(draft, ['content'], { start: range.start, end: range.end, expand: 'none' }, TEXT_COLOR_MARK, range.color);
      });
    } catch { return false; }
    collaborativeDocsRef.current.set(key, next);
    patchItems({ [key]: { ...item } }); markItemDirty(key);
    return true;
  }, [getCollaborativeDoc, markItemDirty, patchItems]);
  const updateCollaborativeMetadata = useCallback((id, field, value) => {
    const key = String(id);
    const item = itemsRef.current[key];
    const nextValue = field === 'groupId' ? String(value || '') : String(value ?? '');
    const validField = field === 'fontSize' ? item?.kind === 'text' && isObjectFontSize(value) : field === 'groupId'
      ? isCollaborativeItem(item) && nextValue.length <= 128
      : field === 'color'
      ? (item?.kind === 'note' && /^#[0-9a-f]{6}$/i.test(nextValue)) || (item?.kind === 'text' && (nextValue === '' || /^#[0-9a-f]{6}$/i.test(nextValue)))
      : field === 'renderMode' ? isTextContent(item) && isContentMode(nextValue)
      : isTextContent(item) && (field === 'filename' ? nextValue.length <= 80 : field === 'language' && isCodeLanguage(nextValue));
    if (!isCollaborativeItem(item) || !validField) return;
    const nextItem = { ...item, [field]: field === 'fontSize' ? Number(nextValue) : field === 'groupId' ? nextValue || null : nextValue };
    itemsRef.current = { ...itemsRef.current, [key]: nextItem };
    setItems((current) => ({ ...current, [key]: nextItem }));
    if (['fontSize', 'renderMode', 'filename', 'language'].includes(field)) refreshSpatialIndex();
    markItemDirty(key);
    const version = nextPeerSyncVersion(syncClockRef, syncActorRef);
    itemSyncVersionsRef.current.set(key, version);
    peerMeshRef.current?.sendData({ type: 'item_metadata', item_id: key, field, value: nextValue, version }, (peer) => canPeerAccessItem(nextItem, peer));
    if (item.kind === 'note' && field === 'groupId') saveCollaborativeItemRef.current?.(key, { silent: true });
  }, [markItemDirty, refreshSpatialIndex]);
  const broadcastEditorPresence = useCallback((id, editing) => {
    const key = String(id);
    const item = itemsRef.current[key];
    if (!isCollaborativeItem(item)) return;
    peerMeshRef.current?.sendData({ type: 'editor_presence', item_id: key, editing: Boolean(editing) }, (peer) => canPeerAccessItem(item, peer));
  }, []);
  const broadcastPeerItemState = useCallback((change) => {
    const mesh = peerMeshRef.current;
    if (!mesh || !change?.syncVersion) return;
    if (change.syncAction === 'delete') {
      const permission = change.previous?.permission ?? change.permission;
      const accessItem = { permission };
      const queued = mesh.sendData({
        type: 'item_sync_state', action: 'delete', item_id: change.id,
        permission, version: change.syncVersion,
      }, (peer) => canPeerAccessItem(accessItem, peer));
      if (!queued && !serverReconnectRequestedRef.current) setToast('브로커 동기화 대기열이 가득 차 일부 변경을 전달하지 못했습니다. 재접속하면 다시 동기화됩니다.');
      return;
    }
    const item = change.item;
    if (!item || !isCanvasSyncItem(item) || isCollaborativeItem(item)) return;
    let queued = mesh.sendData({
      type: 'item_sync_state', action: 'upsert', item_id: change.id,
      item, version: change.syncVersion,
    }, (peer) => canPeerAccessItem(item, peer));
    if (change.previous) {
      const previous = change.previous;
      queued = mesh.sendData({
        type: 'item_sync_state', action: 'delete', item_id: change.id,
        permission: previous.permission, version: change.syncVersion,
      }, (peer) => canPeerAccessItem(previous, peer) && !canPeerAccessItem(item, peer)) && queued;
    }
    if (!queued && !serverReconnectRequestedRef.current) setToast('브로커 동기화 대기열이 가득 차 일부 변경을 전달하지 못했습니다. 재접속하면 다시 동기화됩니다.');
  }, []);
  // Mutations are captured by setItems as proposals. No follower can write to
  // the persistence socket, and drafts are never rendered as committed objects.
  const sendItemChange = useCallback(() => hostSessionRef.current.editable, []);
  const sendStrokeFrameChanges = useCallback(frame => {
    if (!hostSessionRef.current.editable) return false;
    const changes={},removed=[];
    for(const {id,payload} of frame)if(payload.type==='item_delete')removed.push(id);else if(payload.type==='item_update')changes[id]=payload.item;
    patchItems(changes,removed);
    return true;
  }, [patchItems]);
  const updateTableItem = useCallback((id, update) => {
    const key = String(id);
    const previous = itemsRef.current[key];
    if (!['table', 'chart'].includes(previous?.kind)) return false;
    const nextItem = typeof update === 'function' ? update(previous) : { ...previous, ...update };
    if (!nextItem || nextItem === previous) return false;
    itemsRef.current = { ...itemsRef.current, [key]: nextItem };
    setItems((current) => ({ ...current, [key]: nextItem }));
    if (previous.x !== nextItem.x || previous.y !== nextItem.y || previous.width !== nextItem.width || previous.height !== nextItem.height) refreshSpatialIndex();
    if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = { ...itemsRef.current, [key]: previous };
      setItems((current) => ({ ...current, [key]: previous }));
      refreshSpatialIndex();
      setToast(previous.kind === 'chart' ? '연결이 복구되면 그래프를 다시 편집해주세요.' : '연결이 복구되면 테이블을 다시 편집해주세요.');
      return false;
    }
    return true;
  }, [refreshSpatialIndex, sendItemChange]);
  const updateFormulaItem = useCallback((id, formula) => {
    const key = String(id);
    const previous = itemsRef.current[key];
    if (previous?.kind !== 'math' || previous.formula === formula) return false;
    const nextItem = { ...previous, formula };
    itemsRef.current = { ...itemsRef.current, [key]: nextItem };
    setItems((current) => ({ ...current, [key]: nextItem }));
    if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = { ...itemsRef.current, [key]: previous };
      setItems((current) => ({ ...current, [key]: previous }));
      setToast('연결이 복구되면 수식을 다시 편집해주세요.');
      return false;
    }
    return true;
  }, [sendItemChange]);
  const updateObjectSize = (id, field, value) => {
    const key = String(id);
    const previous = itemsRef.current[key];
    if (!previous || !hostSessionRef.current.editable) return;
    const patch = field === 'fontSize' ? (hasIndependentContentSize(previous) && isObjectFontSize(value) ? { fontSize: value } : null) : numericObjectPatch(previous, field, value);
    if (!patch) return;
    const nextItem = { ...previous, ...patch };
    itemsRef.current = { ...itemsRef.current, [key]: nextItem };
    setItems(current => ({ ...current, [key]: nextItem }));
    refreshSpatialIndex();
    sendPeerItemGeometry(key, nextItem);
    if (isCollaborativeItem(nextItem)) markItemDirty(key);
    else if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = { ...itemsRef.current, [key]: previous };
      setItems(current => ({ ...current, [key]: previous }));
      sendPeerItemGeometry(key, previous);
      refreshSpatialIndex();
    }
  };
  const updateObjectDimensions = (id, field, value) => updateObjectSize(id, field, value);
  const updateObjectFontSize = (id, value) => updateObjectSize(id, 'fontSize', value);
  const updateItemShadow = (ids, field, value) => {
    if (!hostSessionRef.current.editable) return;
    const allowed = { shadowBlur: [0, 24], shadowOpacity: [0, 1], shadowOffsetX: [-24, 24], shadowOffsetY: [-24, 24] };
    if (field !== 'shadowEnabled' && (!allowed[field] || !Number.isFinite(value))) return;
    const nextValue = field === 'shadowEnabled' ? Boolean(value) : Math.max(allowed[field][0], Math.min(allowed[field][1], value));
    const changes = {};
    for (const id of Array.isArray(ids) ? ids : [ids]) {
      const key = String(id), previous = itemsRef.current[key];
      if (previous) changes[key] = { ...previous, [field]: nextValue };
    }
    itemsRef.current = { ...itemsRef.current, ...changes };
    setItems(current => ({ ...current, ...changes }));
  };
  const updateImageFrame = (id, enabled) => {
    const key = String(id), previous = itemsRef.current[key];
    if (previous?.kind !== 'image' || typeof enabled !== 'boolean' || !hostSessionRef.current.editable) return;
    const next = { ...previous, imageFrameEnabled: enabled };
    itemsRef.current = { ...itemsRef.current, [key]: next };
    setItems(current => ({ ...current, [key]: next }));
    refreshSpatialIndex();
  };
  const updateItemDepth = (id, value) => {
    const key = String(id), previous = itemsRef.current[key];
    const depth = Number(value);
    if (!previous || !Number.isSafeInteger(depth) || !hostSessionRef.current.editable) return;
    const next = { ...previous, depth };
    itemsRef.current = { ...itemsRef.current, [key]: next };
    setItems(current => ({ ...current, [key]: next }));
    refreshSpatialIndex();
  };
  const updateItemRotation = (id, value) => {
    const key = String(id);
    const previous = itemsRef.current[key];
    if (!previous) return;
    const rotation = Math.max(-180, Math.min(180, Number(value) || 0));
    if ((Number(previous.rotation) || 0) === rotation) return;
    const nextItem = { ...previous, rotation, ...(previous.kind === 'connector' && !(Number(previous.bend) > 0) ? connectorBendPatch(previous, 0.18) : {}) };
    itemsRef.current = { ...itemsRef.current, [key]: nextItem };
    setItems((current) => ({ ...current, [key]: nextItem }));
    refreshSpatialIndex();
    if (isCollaborativeItem(nextItem)) {
      const version = nextPeerSyncVersion(syncClockRef, syncActorRef);
      itemSyncVersionsRef.current.set(key, version);
      peerMeshRef.current?.sendData({ type: 'item_geometry', item_id: key, x: nextItem.x, y: nextItem.y, rotation, version }, (peer) => canPeerAccessItem(nextItem, peer));
      markItemDirty(key);
      if (nextItem.kind === 'note') saveCollaborativeItemRef.current?.(key, { silent: true });
    } else if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = { ...itemsRef.current, [key]: previous };
      setItems((current) => ({ ...current, [key]: previous }));
      refreshSpatialIndex();
      setToast('연결이 복구되면 회전을 다시 적용해주세요.');
    }
  };
  const updateUserGroup = (id, patch) => {
    const key = String(id), previous = itemsRef.current[key];
    if (previous?.kind !== 'user-group') return;
    const nextItem = { ...previous, ...patch };
    itemsRef.current = { ...itemsRef.current, [key]: nextItem };
    setItems(current => ({ ...current, [key]: nextItem }));
    refreshSpatialIndex();
    if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = { ...itemsRef.current, [key]: previous };
      setItems(current => ({ ...current, [key]: previous }));
      refreshSpatialIndex();
      setToast('연결이 복구되면 그룹을 다시 변경해주세요.');
    }
  };
  const updateShapeAppearance = (id, field, value) => {
    const key = String(id), previous = itemsRef.current[key];
    if (previous?.kind !== 'shape') return;
    if (!(field === 'visualStyle' && ['standard', 'sketch'].includes(value)
      || field === 'volumeStyle' && ['solid', 'wireframe'].includes(value)
      || field === 'strokeEnabled' && typeof value === 'boolean'
      || field === 'color' && /^#[0-9a-f]{6}$/i.test(value)
      || validShapeAppearance(field, value))) return;
    const nextItem = { ...previous, [field]: value };
    itemsRef.current = { ...itemsRef.current, [key]: nextItem };
    setItems(current => ({ ...current, [key]: nextItem }));
    refreshSpatialIndex();
    if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = { ...itemsRef.current, [key]: previous };
      setItems(current => ({ ...current, [key]: previous }));
      refreshSpatialIndex();
      setToast('연결이 복구되면 도형 스타일을 다시 변경해주세요.');
    }
  };
  const updateShapeFill = (id, value) => {
    const key = String(id);
    const previous = itemsRef.current[key];
    if (previous?.kind !== 'shape' || previous.shapeType === 'arrow' || (value !== '' && !/^#[0-9a-f]{6}$/i.test(value))) return;
    const nextItem = { ...previous, fill: value };
    itemsRef.current = { ...itemsRef.current, [key]: nextItem };
    setItems(current => ({ ...current, [key]: nextItem }));
    if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = { ...itemsRef.current, [key]: previous };
      setItems(current => ({ ...current, [key]: previous }));
      setToast('연결이 복구되면 내부 색상을 다시 변경해주세요.');
    }
  };
  const updateShapeArrowBend = (id, value, field = 'bend') => {
    const key = String(id);
    const previous = itemsRef.current[key];
    if (previous?.kind !== 'shape' || previous.shapeType !== 'arrow') return;
    const bend = Math.max(-1.5, Math.min(1.5, Number(value) || 0));
    const patch = field === 'bendPointCount' ? resizeShapeArrowControls(previous, previous.width * boardSize.width, previous.height * boardSize.height, value) : shapeArrowBendPatch(previous, bend);
    const nextItem = { ...previous, ...patch };
    itemsRef.current = { ...itemsRef.current, [key]: nextItem };
    setItems((current) => ({ ...current, [key]: nextItem }));
    refreshSpatialIndex();
    if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = { ...itemsRef.current, [key]: previous };
      setItems((current) => ({ ...current, [key]: previous }));
      refreshSpatialIndex();
      setToast('연결이 복구되면 화살표 곡률을 다시 변경해주세요.');
    }
  };
  const updateArrowHead = (id, field, value) => {
    const key = String(id);
    const previous = itemsRef.current[key];
    if (!['startHead', 'endHead', 'headSize'].includes(field)
      || !(previous?.kind === 'connector' || (previous?.kind === 'shape' && previous.shapeType === 'arrow'))) return;
    const head = field === 'headSize' ? Math.max(2, Math.min(128, Number(value))) : normalizeArrowHead(value, null);
    if (!head || previous[field] === head) return;
    const nextItem = { ...previous, [field]: head };
    itemsRef.current = { ...itemsRef.current, [key]: nextItem };
    setItems((current) => ({ ...current, [key]: nextItem }));
    refreshSpatialIndex();
    if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = { ...itemsRef.current, [key]: previous };
      setItems((current) => ({ ...current, [key]: previous }));
      refreshSpatialIndex();
      setToast('연결이 복구되면 화살표 머리 모양을 다시 변경해주세요.');
    }
  };
  const updateNewConnectorHead = (field, value) => {
    if (field === 'headSize') setConnectorHeadSize(value);
    else if (field === 'startHead') setConnectorStartHead(value);
    else setConnectorEndHead(value);
  };
  const updateNewShapeArrowHead = (field, value) => {
    if (field === 'headSize') setShapeArrowHeadSize(value);
    else if (field === 'startHead') setShapeArrowStartHead(value);
    else setShapeArrowEndHead(value);
  };
  const updateConnectorAppearance = (id, field, value) => {
    const key = String(id);
    const previous = itemsRef.current[key];
    if (previous?.kind !== 'connector' || !['color', 'strokeWidth', 'bend', 'label', 'labelMode', 'bendPointCount', 'visualStyle', 'fromPort', 'toPort'].includes(field)) return;
    const portField = field === 'fromPort' || field === 'toPort';
    if (portField && value !== '' && !logicPorts(itemsRef.current[previous[field === 'fromPort' ? 'from' : 'to']]?.shapeType).some(port => port.id === value && port.direction === (field === 'fromPort' ? 'output' : 'input'))) return;
    if (field === 'visualStyle' && !['standard', 'sketch'].includes(value)) return;
    if (field === 'labelMode' && !['plain', 'markdown', 'latex'].includes(value)) return;
    if (field === 'label' && (typeof value !== 'string' || value.length > 2000)) return;
    const nextValue = portField || field === 'visualStyle' ? value : field === 'bendPointCount' ? Math.max(1, Math.min(MAX_BEND_POINTS, Math.trunc(Number(value) || 1))) : ['label', 'labelMode'].includes(field) ? String(value) : field === 'bend' ? Math.max(0, Math.min(1.5, Number(value) || 0)) : field === 'strokeWidth'
      ? Math.max(0.8, Math.min(4, Number(value) || 1.5))
      : /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : previous.color || '#8b8f8c';
    if (previous[field] === nextValue && !(field === 'bend' && previous.bendPoints?.length)) return;
    const patch = field === 'bendPointCount' ? resizeConnectorControls(previous, connectorGeometry(previous, itemsRef.current, boardSize.width, boardSize.height), nextValue) : field === 'bend' ? connectorBendPatch(previous, nextValue) : { [field]: nextValue };
    const nextItem = { ...previous, ...patch };
    if (portField && value === '') delete nextItem[field];
    itemsRef.current = { ...itemsRef.current, [key]: nextItem };
    setItems((current) => ({ ...current, [key]: nextItem }));
    refreshSpatialIndex();
    if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = { ...itemsRef.current, [key]: previous };
      setItems((current) => ({ ...current, [key]: previous }));
      refreshSpatialIndex();
      setToast('연결이 복구되면 화살표 모양을 다시 변경해주세요.');
    }
  };
  const addItem = useCallback((id, item) => {
    if (!canvasSnapshotLoadedRef.current) return false;
    if (item?.kind === 'connector' && !connectorGeometry(item, itemsRef.current, boardSize.width, boardSize.height)) { setToast('객체가 겹쳐 연결을 만들 수 없습니다. 객체를 옮긴 뒤 다시 연결해주세요.'); return false; }
    const sharedItem = makeCollaborativeItem(item);
    if (isCollaborativeItem(sharedItem)) {
      const baseDoc = Automerge.load(decodeBase64(sharedItem.automerge_snapshot), { actor: createActorId() });
      const version = nextPeerSyncVersion(syncClockRef, syncActorRef);
      itemSyncVersionsRef.current.set(String(id), version);
      deletedItemSyncVersionsRef.current.delete(String(id));
      itemsRef.current = { ...itemsRef.current, [id]: sharedItem };
      collaborativeDocsRef.current.set(String(id), baseDoc);
      collaborativeBaseDocsRef.current.set(String(id), baseDoc);
      newCollaborativeItemsRef.current.add(String(id));
      setItems((current) => ({ ...current, [id]: sharedItem }));
      selectItems([id], id);
      refreshSpatialIndex();
      markItemDirty(id);
      peerMeshRef.current?.sendData({ type: 'item_create', item_id: String(id), item: sharedItem, version }, (peer) => canPeerAccessItem(sharedItem, peer));
      if (sharedItem.kind === 'note') saveCollaborativeItemRef.current?.(id, { silent: true });
      return true;
    }
    if (!sendItemChange({ type: 'item_update', item_id: id, item: sharedItem }, null)) return false;
    itemsRef.current = { ...itemsRef.current, [id]: sharedItem };
    setItems((current) => ({ ...current, [id]: sharedItem }));
    refreshSpatialIndex();
    return true;
  }, [boardSize, markItemDirty, refreshSpatialIndex, selectItems, sendItemChange]);
  const deleteItem = useCallback((id) => {
    const previous = itemsRef.current[id];
    if (!Object.hasOwn(itemsRef.current, String(id))) return true;
    const key = String(id);
    if (!sendItemChange({ type: 'item_delete', item_id: id }, previous)) return false;
    const next = { ...itemsRef.current };
    for (const [connectorId, connector] of Object.entries(next)) {
      if (connector?.kind !== 'connector' || (String(connector.from) !== key && String(connector.to) !== key)) continue;
      if (sendItemChange({ type: 'item_delete', item_id: connectorId }, connector)) delete next[connectorId];
    }
    delete next[id];
    itemsRef.current = next;
    collaborativeDocsRef.current.delete(key);
    collaborativeBaseDocsRef.current.delete(key);
    newCollaborativeItemsRef.current.delete(key);
    itemEditRevisionRef.current.delete(key);
    setDirtyItems((current) => { const nextDirty = new Set(current); nextDirty.delete(key); return nextDirty; });
    setItems(next);
    refreshSpatialIndex();
    return true;
  }, [refreshSpatialIndex, sendItemChange]);
  const saveCollaborativeItem = useCallback((id, { silent = false } = {}) => {
    if (!hostSessionRef.current.editable || !isCollaborativeItem(itemsRef.current[String(id)])) return false;
    if (!silent) setToast('변경 사항을 서버에 자동 저장합니다.');
    return true;
  }, []);
  saveCollaborativeItemRef.current = saveCollaborativeItem;
  const { receivePeerData: receiveLegacyPeerData, receiveLaser } = useCanvasPeerEvents({
    collaborativeBaseDocsRef,
    collaborativeDocsRef,
    deletedItemSyncVersionsRef,
    getCollaborativeDoc,
    groupsRef,
    itemEditRevisionRef,
    itemSyncVersionsRef,
    itemsRef,
    markItemDirty,
    newCollaborativeItemsRef,
    pendingPeerItemEventsRef,
    pendingPeerItemEventsSizeRef,
    refreshSpatialIndex,
    remoteDrawingStrokesRef,
    setDirtyItems,
    setItems,
    setLaserStrokes,
    setRemoteDrawingStrokes,
    setRemoteEditors,
    setToast,
    syncClockRef,
  });
  const receivePeerData = useCallback((peer, data, channelName) => {
    if (data?.type === 'editor_presence') receiveLegacyPeerData(peer, data, channelName);
  }, [receiveLegacyPeerData]);
  const permission = groups.includes('default') ? 'default' : groups[0] || 'admin-group';

  useEffect(() => {
    if (!laserStrokes.length) return undefined;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setLaserStrokes((current) => {
        let changed = false;
        const next = current.flatMap((stroke) => {
          if (stroke.endedAt) {
            if (now - stroke.endedAt < LASER_FADE_MS + 120) return [stroke];
            changed = true;
            return [];
          }
          if ((stroke.active && laserDrawingRef.current?.key === stroke.id) || now - stroke.updatedAt < 6000) return [stroke];
          changed = true;
          return [{ ...stroke, active: false, endedAt: now }];
        });
        return changed ? next : current;
      });
    }, 160);
    return () => window.clearInterval(timer);
  }, [laserStrokes.length]);

  useCanvasConnection({
    identity: {
      canvasId,
      navigate,
      permission,
      reconnectEpoch,
      token,
      user
    },
    refs: {
      autoReconnectRef,
      canvasSnapshotLoadedRef,
      chatHistoryPageRef,
      chatHistoryRequestRef,
      chatEventsRef,
      collaborativeBaseDocsRef,
      collaborativeDocsRef,
      deletedItemSyncVersionsRef,
      dirtyItemsRef,
      draftRef,
      dragRef,
      drawingSessionRef,
      editingIdRef,
      groupsRef,
      itemEditRevisionRef,
      itemSyncVersionsRef,
      itemsRef,
      newCollaborativeItemsRef,
      peerMeshRef,
      hostSessionRef,
      pendingItemChangesRef,
      pendingPeerItemEventsRef,
      pendingPeerItemEventsSizeRef,
      reconnectAttemptsRef,
      reconnectRequestRef,
      rejectedEventPongsRef,
      remoteCursorUpdaterRef,
      remoteDrawingStrokesRef,
      rtcWsRef,
      serverReconnectRequestedRef,
      stageOfflineGeometryRef,
      syncActorRef,
      syncClockRef,
      syncedPeersRef,
      strokeSaveFlushRef,
      wsRef
    },
    setters: {
      setCanvas,
      setChatHistoryLoading,
      setConnection,
      setDirtyItems,
      setError,
      setGroups,
      setHasOlderMessages,
      setItems: receiveServerItems,
      setLaserStrokes,
      setMessages,
      setPeerList,
      setReconnectEpoch,
      setRemoteDrawingStrokes,
      setRemoteEditors,
      setSettings,
      setSettingsPending,
      setToast
    },
    actions: {
      acknowledgeServerChange,
      broadcastEditorPresence,
      broadcastPeerItemState,
      getCollaborativeDoc,
      getPendingServerChanges,
      markItemDirty,
      receiveLaser,
      receivePeerData,
      receiveServerEvent,
      refreshSpatialIndex,
      rejectServerChange,
      replacePersistedItems,
      requestChatHistory,
      sendItemChange,
      sendStrokeFrameChanges,
      sendRaw,
      sendRtcRaw
    },
  });

  const editorsByItem = useMemo(() => {
    const grouped = new Map();
    for (const editor of Object.values(remoteEditors)) {
      const id = String(editor.itemId);
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(editor);
    }
    return grouped;
  }, [remoteEditors]);
  const drawableItemCount = itemCount(items);

  const viewportSize = useCanvasViewport({ boardRef, setCamera, refreshKey: error });
  const spatialIndexRef = useRef(null);
  const spatialIndex = useMemo(() => {
    if (!spatialIndexRef.current) spatialIndexRef.current = new CanvasSpatialBTree();
    const dirty=spatialDirtyIds.current;
    spatialDirtyIds.current=new Set();
    return spatialIndexRef.current.update(items,boardSize,spatialRevision,spatialIndexRef.current.revision!==spatialRevision && dirty!==null?[...dirty]:null);
  }, [items, spatialRevision, boardSize]);
  const {
    visibleBounds,
    minimap,
    minimapItemColors,
    minimapPosition,
    minimapWidgetRef,
    startMinimapWidgetMove,
    moveMinimapWidget,
    stopMinimapWidgetMove,
    startMinimapPan,
    moveMinimapPan,
    stopMinimapPan,
  } = useCanvasMinimap({ collapsed:chrome.collapsed.minimap, boardRef, boardSize, viewportSize, camera, setCamera, items, spatialIndex, spatialRevision, cancelCameraMotion: () => cancelCameraMotionRef.current() });
  const activePeerIds = useMemo(() => peerList.filter((peer) => peer.connected).map((peer) => peer.peer_id).sort().join('\n'), [peerList]);
  const axisOriginX = boardSize.width * camera.scale / 2 + camera.x;
  const axisOriginY = boardSize.height * camera.scale / 2 + camera.y;
  const coordinatePlaneStyle = {
    '--axis-origin-x': `${axisOriginX}px`,
    '--axis-origin-y': `${axisOriginY}px`,
    '--axis-x-arrow-opacity': axisOriginX <= viewportSize.width ? 1 : 0,
    '--axis-y-arrow-opacity': axisOriginY >= 0 ? 1 : 0,
  };
  const sceneWindow = renderWindow(visibleBounds, boardSize, camera.scale);
  const sceneQueryRef=useRef(null);
  if(!sceneQueryRef.current)sceneQueryRef.current=new StableSpatialQuery();
  const visibleEntries = useMemo(() => {
    let entries=sceneQueryRef.current.query(spatialIndex,sceneWindow.bounds);
    // Keep an open editor mounted even when its measured bounds leave the viewport.
    for (const retainedId of [dragRef.current?.id, editingId].filter(Boolean)) {
      if (!items[retainedId]) continue;
      const item = items[retainedId];
      if(entries.some(entry=>entry.id===retainedId))continue;
      entries=[...entries,{
        id: retainedId,
        item,
        bounds: objectBounds(item, items, boardSize.width, boardSize.height),
      }];
    }
    return entries;
  }, [boardSize.height, boardSize.width, editingId, items, spatialIndex, spatialRevision, sceneWindow.key]);
  const usesOverview=useMemo(()=>visibleEntries.some(({item})=>!['shape','stroke','connector'].includes(item.kind) && !isRasterText(item)),[visibleEntries,items[selectedItemId]?.renderMode]);
  const representationScale=usesOverview?overviewScale(camera.scale):1;
  const selectedObjectIdsKey=selectedItemIds.filter(id=>Boolean(items[id])).join('|');
  const selectedObjectIds=useMemo(()=>selectedItemIds.filter(id=>Boolean(items[id])),[selectedObjectIdsKey]);
  const selectedObjectIdSet = useMemo(() => new Set(selectedObjectIds), [selectedObjectIds]);
  const domSelection = useMemo(() => selectedObjectIdSet.size<=64 ? selectedObjectIdSet : new Set(),[selectedObjectIdSet]);
  const sceneModelRef=useRef(null);if(!sceneModelRef.current)sceneModelRef.current=new SceneViewModel();
  const sceneModel=sceneModelRef.current.update(visibleEntries,items,boardSize,representationScale,new Set([...domSelection,editingId,connectionStartId].filter(Boolean)),selectedObjectIdSet,spatialIndex.stats.boundsCalculated,spatialIndex);
  const depthLayers=sceneModel.depthLayers,vectorHitOrder=sceneModel.hitOrder;
  const hasSingleSelection = selectedObjectIds.length === 1;
  const primarySelectedItemId = selectedObjectIdSet.has(String(selectedItemId)) ? String(selectedItemId) : selectedObjectIds[selectedObjectIds.length - 1] || null;
  const selectedTable = hasSingleSelection && items[primarySelectedItemId]?.kind === 'table' ? items[primarySelectedItemId] : null;
  const selectedItem = hasSingleSelection ? items[primarySelectedItemId] : null;
  const selectedConnector = selectedItem?.kind === 'connector' ? selectedItem : null;
  const selectedArrow = selectedItem?.kind === 'shape' && selectedItem.shapeType === 'arrow' ? selectedItem : null;
  const connectorToEdit = activeTool === 'connect' ? null : selectedConnector;
  const selectedGroupIds = useMemo(() => new Set(selectedObjectIds.map((id) => items[id]?.groupId).filter(Boolean)),[selectedObjectIds,items]);
  const selectionIsSingleGroup = selectedObjectIds.length > 0 && selectedGroupIds.size === 1
    && selectedObjectIds.every((id) => items[id]?.groupId === [...selectedGroupIds][0]);
  const changeSelectionGroup = (shouldGroup) => {
    const ids = selectedObjectIds.filter((id) => itemsRef.current[id] && !['stroke', 'connector'].includes(itemsRef.current[id].kind));
    if (shouldGroup && ids.length < 2) { setToast('그룹화할 오브젝트를 두 개 이상 선택해주세요.'); return; }
    const groupId = shouldGroup ? createId() : null;
    const nextItems = { ...itemsRef.current };
    for (const id of ids) {
      const previous = nextItems[id];
      const nextItem = { ...previous };
      if (groupId) nextItem.groupId = groupId;
      else delete nextItem.groupId;
      if (isCollaborativeItem(nextItem)) {
        nextItems[id] = nextItem;
        markItemDirty(id);
        const version = nextPeerSyncVersion(syncClockRef, syncActorRef);
        itemSyncVersionsRef.current.set(String(id), version);
        peerMeshRef.current?.sendData({ type: 'item_metadata', item_id: id, field: 'groupId', value: groupId || '', version }, (peer) => canPeerAccessItem(nextItem, peer));
      } else if (sendItemChange({ type: 'item_update', item_id: id, item: nextItem }, previous)) {
        nextItems[id] = nextItem;
      }
    }
    itemsRef.current = nextItems;
    setItems(nextItems);
    ids.filter(id => nextItems[id]?.kind === 'note').forEach(id => saveCollaborativeItemRef.current?.(id, { silent: true }));
    if (shouldGroup) selectItems(ids, ids[ids.length - 1]);
    setToast(shouldGroup ? ui("{v0}개 오브젝트를 그룹화했습니다.", {
  v0: ids.length
}) : '그룹을 해제했습니다.');
  };
  useGroupShortcuts({ editing: !hostStatus.editable || editingId != null, onGroup: changeSelectionGroup });
  const startEditing = (id) => {
    const key = String(id);
    const previous = editingIdRef.current;
    if (previous && previous !== key) broadcastEditorPresence(previous, false);
    editingIdRef.current = key;
    broadcastEditorPresence(key, true);
    selectItems([key], key);
    setEditingId(key);
  };
  const stopEditing = (id) => {
    const key = String(id);
    if (editingIdRef.current === key) {
      editingIdRef.current = null;
      broadcastEditorPresence(key, false);
    }
    setEditingId((current) => String(current) === key ? null : current);
  };
  const finishEditing = useCallback((id = editingId) => {
    if (id == null) return;
    const key = String(id);
    const editor = [...(sceneRef.current?.querySelectorAll('[data-item-id]') || [])]
      .find((element) => element.dataset.itemId === key);
    const formulaInput = editor?.querySelector('.math-formula-input');
    if (formulaInput) updateFormulaItem(key, formulaInput.value);
    const focusedElement = document.activeElement;
    if (editor?.contains(focusedElement) && typeof focusedElement.blur === 'function') focusedElement.blur();
    if (editingIdRef.current === key) {
      editingIdRef.current = null;
      broadcastEditorPresence(key, false);
    }
    setEditingId((current) => String(current) === key ? null : current);
  }, [broadcastEditorPresence, editingId, updateFormulaItem]);
  const focusCanvasObject = (id) => {
    const target = itemsRef.current[String(id)];
    const board = boardRef.current?.getBoundingClientRect();
    if (!target || !board) return;
    const bounds = objectBounds(target, itemsRef.current, boardSize.width, boardSize.height);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    finishEditing(editingId);
    setActiveTool('select');
    selectItems([String(id)], String(id));
    cancelCameraMotionRef.current();
    setCamera((current) => ({
      ...current,
      x: board.width / 2 - centerX * boardSize.width * current.scale,
      y: board.height / 2 - centerY * boardSize.height * current.scale,
    }));
  };
  const focusConnectorTarget = (connectorId, connector) => {
    if (activeTool === 'select') focusCanvasObject(connector.to);
  };
  const sendSettings = (field, value, participant) => {
    if (!settings || settingsPending) return;
    const payload = { type: 'canvas_settings_update', request_id: createId(), expected_revision: settings.settings_revision ?? 0, field };
    if (participant) Object.assign(payload, participant); else payload.value = value;
    if (sendRaw(payload)) setSettingsPending(true);
  };
  const { pointerPosition, startPan, cancelPanInertia, centeredItemPosition, hideCursor, sendCursorPosition, startZoomHold, stopZoomHold, cancelZoomHold, clickZoom, startDrawing, moveDrawing, stopDrawing } = useCanvasStageInteractions({
    boardRef, camera, setCamera, activeTool, eraserRef, eraserCursorRef, itemsRef, boardSize, eraserWidth, eraserMode,
    addItem, setToast, setItems, patchItems, refreshSpatialIndex, spatialIndexRef,
    sendStrokeFrameChanges, pendingItemChangesRef, strokeSaveFlushRef,
    lastCursorSentAtRef, peerMeshRef, panRef, zoomHoldRef, zoomPointerPressRef, zoomSensitivity,
    stageWheelHandlerRef, laserDrawingRef, setLaserStrokes, selectionRef, selectedItemIds,
    setSelectionBox, selectItems, canvasSnapshotLoadedRef: hostReadyRef, finishEditing, setConnectionStartId,
    spacePressedRef, user, tableConfig, permission, setSharePosition, shapeType, shapeArrowStartHead, shapeArrowHeadSize,
    shapeArrowEndHead, shapeFillColor, shapeFillOpacity, shapeSketchFillOpacity, shapeVertexCount, shapeCornerStyle, shapeVisualStyle, shapeStrokeEnabled, shapeBorderWidth, color, noteColor, setActiveTool, startEditing, strokeWidth, penBrush, penOpacity,
    drawingRef, drawingSessionRef, draftRef, vectorDraftRef,
  });
  cancelCameraMotionRef.current = cancelPanInertia;
  const placeSharedLink = (shared) => {
    if (!sharePosition) return;
    const isVideo = shared.mediaType === 'youtube' || shared.mediaType === 'video';
    const width = isVideo ? 0.36 : 0.3;
    const height = isVideo ? 0.36 : 0.15;
    const media = { ...shared };
    delete media.defaultTitle;
    const id = createId();
    const item = {
      kind: 'link',
      ...media,
      x: sharePosition.x - width / 2,
      y: sharePosition.y - height / 2,
      width,
      height,
      permission,
    };
    if (!addItem(id, item)) {
      setToast('실시간 서버에 연결된 뒤 동영상이나 링크를 공유할 수 있어요.');
      return;
    }
    setSharePosition(null);
    setActiveTool('select');
  };
  const uploadPdf = usePdfUpload({ canvasId, token, permission, addItem, centeredItemPosition, createId, setActiveTool, selectItems, setToast });
  const uploadImage = async (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setToast('이미지 파일만 올릴 수 있어요.'); return; }
    if (file.size > 2 * 1024 * 1024) { setToast('이미지는 2MB 이하로 올려주세요.'); return; }
    try {
      const src = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      const id = createId();
      const position = centeredItemPosition(0.3, 0.2);
      if (!addItem(id, { kind: 'image', src, filename: file.name, ...position, width: 0.3, permission })) { setToast('실시간 서버에 연결된 뒤 이미지를 공유할 수 있어요.'); return; }
      setActiveTool('select');
    } catch { setToast('이미지를 읽지 못했습니다.'); }
  };
  const submitMessage = (event) => {
    event?.preventDefault(); const text = message.trim();
    if (new TextEncoder().encode(text).length > 4096) { setToast('메시지는 UTF-8 기준 4096바이트 이하여야 합니다.'); return; }
    if (!text || !sendRaw({ type: 'chat', room_id: CHAT_ROOM_ID, text, request_id: createId() })) return;
    setMessage('');
  };
  const {
    startObjectDrag,
    startObjectResize,
    startArrowBend,
    startObjectRotation,
    moveObject,
    stopObjectDrag,
    startGroupRotation,
  } = useCanvasObjectInteractions({
    moveItems, flushMoves,
    activeTool,
    spatialIndexRef,
    addItem,
    boardSize,
    boardRef,
    clearPeerItemGeometryBroadcast,
    connectionStartId,
    connectorColor,
    connectorVisualStyle,
    connectorEndHead,
    connectorStartHead, connectorHeadSize,
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
  });
  const changeTheme = (nextTheme) => { localStorage.setItem('agora_canvas_theme', nextTheme); setTheme(nextTheme); };
  const toggleGrid = () => { const next = !showGrid; localStorage.setItem('agora_canvas_grid', String(next)); setShowGrid(next); };
  const toggleXAxis = () => { const next = !showXAxis; localStorage.setItem('agora_canvas_x_axis', String(next)); setShowXAxis(next); };
  const toggleYAxis = () => { const next = !showYAxis; localStorage.setItem('agora_canvas_y_axis', String(next)); setShowYAxis(next); };
  const changeZoomSensitivity = (event) => {
    const next = Number(event.target.value);
    setZoomSensitivity(next);
    localStorage.setItem(ZOOM_SENSITIVITY_KEY, String(next));
  };
  const changeStrokeWidth = (event) => {
    const next = Number(event.target.value);
    setStrokeWidth(next);
    localStorage.setItem(STROKE_WIDTH_KEY, String(next));
  };
  const changeTableCount = (field, event) => {
    if (event.target.value === '') return;
    const limit = field === 'rows' ? MAX_TABLE_ROWS : MAX_TABLE_COLUMNS;
    const nextCount = normalizeTableCount(event.target.value, limit);
    if (activeTool === 'table') {
      setTableConfig((current) => ({ ...current, [field]: nextCount }));
      return;
    }
    if (!selectedTable) return;
    updateTableItem(primarySelectedItemId, (current) => resizeTableData(
      current,
      field === 'rows' ? nextCount : current.rows?.length || 1,
      field === 'columns' ? nextCount : current.columns?.length || 1,
    ));
  };
  const changeTableSize = (field, event) => {
    if (event.target.value === '') return;
    const nextSize = Math.max(10, Math.min(100, Number(event.target.value) || 10));
    if (activeTool === 'table') {
      setTableConfig((current) => ({ ...current, [field]: nextSize }));
      return;
    }
    if (selectedTable) updateTableItem(primarySelectedItemId, { [field]: nextSize / 100 });
  };
  useCanvasKeyboardNudge({ activeTool, editingId, selectedIds: selectedObjectIds, itemsRef, sessionRef: hostSessionRef, dragRef, moveItems, flushMoves });
  useEffect(() => {
    const isEditableTarget = (target) => target instanceof HTMLElement
      && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    const onDeleteKeyDown = (event) => {
      if (!hostSessionRef.current.editable) return;
      if (event.target.closest?.('.canvas-as-code-overlay, .canvas-management-dialog')) return;
      if (event.repeat) return;
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('.canvas-code-editor, .code-shared-input, .code-filename-input, .code-language-select')) return;
      if (editingId != null || isEditableTarget(target) || !selectedObjectIds.length) return;
      event.preventDefault();
      const remainingIds = [];
      for (const id of selectedObjectIds) {
        if (!deleteItem(id)) remainingIds.push(id);
      }
      selectItems(remainingIds.filter((id) => itemsRef.current[id]));
      setConnectionStartId(null);
      if (remainingIds.length) setToast('일부 오브젝트를 삭제하지 못했습니다. 연결 상태와 삭제 권한을 확인해주세요.');
    };
    const onKeyDown = (event) => {
      if (!hostSessionRef.current.editable) return;
      if (event.target.closest?.('.canvas-as-code-overlay, .canvas-management-dialog')) return;
      if (event.key === 'Escape') {
        if (event.repeat) return;
        if (selectionRef.current) {
          selectionRef.current = null;
          setSelectionBox(null);
          return;
        }
        if (editingId != null) {
          event.preventDefault();
          event.stopPropagation();
          finishEditing(editingId);
          return;
        }
        if (selectedObjectIds.length || connectionStartId != null) {
          event.preventDefault();
          selectItems([]);
          setConnectionStartId(null);
          return;
        }
      }
      if (event.code === 'Space' && !isEditableTarget(event.target)) {
        spacePressedRef.current = true;
        event.preventDefault();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        const targetIds = selectedObjectIds.length > 1 ? selectedObjectIds : [editingId || primarySelectedItemId].filter(Boolean);
        const unsavedIds = targetIds.filter((id) => isCollaborativeItem(itemsRef.current[id]) && dirtyItemsRef.current.has(String(id)));
        if (unsavedIds.length) {
          event.preventDefault();
          unsavedIds.forEach((id) => saveCollaborativeItem(id));
        }
      }
    };
    const onKeyUp = (event) => { if (event.code === 'Space') spacePressedRef.current = false; };
    document.addEventListener('keydown', onDeleteKeyDown, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { document.removeEventListener('keydown', onDeleteKeyDown, true); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [connectionStartId, deleteItem, editingId, finishEditing, saveCollaborativeItem, selectItems, selectedObjectIdsKey, selectedItemId]);
  useEffect(() => {
    if (editingId == null) return undefined;
    const onDocumentPointerDown = (event) => {
      const editor = [...(sceneRef.current?.querySelectorAll('[data-item-id]') || [])]
        .find((element) => element.dataset.itemId === String(editingId));
      // Code editing has one owner for outside clicks: CanvasCodeEditor's boundary.
      if (isTextContent(itemsRef.current[String(editingId)])) return;
      if (isInternalEditorPointer(editor, event)) return;
      finishEditing(editingId);
    };
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown, true);
  }, [editingId, finishEditing]);
  const updateContentSetting = useContentSettings({ itemsRef, setItems, updateCollaborativeMetadata, sendItemChange, refreshSpatialIndex });
  const canvasCodeApi = useCanvasAsCode({ canvasId, itemsRef, committedItemsRef, canvasSnapshotLoadedRef: hostReadyRef, permission, addItem, deleteItem, updateCollaborativeText, replaceTextColors, saveCollaborativeItem, sendItemChange, setItems, markItemDirty, refreshSpatialIndex, selectItems, peerMeshRef, syncClockRef, syncActorRef, itemSyncVersionsRef, getCollaborativeDoc });
  const selectCanvasTool = (tool) => {
    if (tool === 'hand') finishEditing();
    if (tool === 'connect') setConnectionStartId(null);
    setActiveTool(tool);
  };
  const clipboardBlocked = !hostStatus.editable || editingId != null || showSettings || showParticipants || showCanvasCode || sharePosition != null;
  const objectClipboard = useObjectClipboard({ canvasId, boardRef, itemsRef, selectedIds: selectedObjectIds,
    permission, pointerPosition, canvasSnapshotLoadedRef: hostReadyRef, addItem, deleteItem, saveCollaborativeItem,
    isInteracting: () => Boolean(dragRef.current || panRef.current || drawingRef.current),
    selectItems, setActiveTool, setConnectionStartId, setToast, blocked: clipboardBlocked });
  const panelLayout = usePanelLayout();
  const canvasParticipants = useParticipantProfiles(settings?.participants, token, user);
  const { backgroundColor, setBackgroundColor, backgroundStyle } = useCanvasBackground(canvasId);
  const onlineParticipants = useMemo(() => onlineCanvasParticipants(user, peerList, canvasParticipants, connection === 'connected'), [user, peerList, canvasParticipants, connection]);
  const mentionParticipants = useMemo(() => uniqueCanvasParticipants([...canvasParticipants, ...onlineParticipants]), [canvasParticipants, onlineParticipants]);
  const jumpToMention = note => {
    if (note.objectId) { focusCanvasObject(note.objectId); comments.open(note.objectId, note.id, note.sequence, note); }
    else {
      const chat = panelLayout.handle('chat');
      if (chat.collapsed) chat.onToggle();
      setChatHighlight(note.id);
      requestedChatMention.current = null;
      setChatJumpNote(note);
    }
  };
  const objectActionsRef = useRef(null);
  objectActionsRef.current = {
    onStartEditing:startEditing, onTextChange:updateCollaborativeText, onTextColorChange:updateTextColor,
    onMetadataChange:(id,field,value)=>['renderMode','filename','language'].includes(field)
      ? updateContentSetting(id,field,value) : updateCollaborativeMetadata(id,field,value),
    onFormulaChange:updateFormulaItem, onTableChange:updateTableItem, onStopEditing:stopEditing,
    onSave:saveCollaborativeItem, onPointerDown:startObjectDrag, onResizeStart:startObjectResize,
    onArrowBendStart:startArrowBend, onPointerMove:moveObject, onPointerUp:stopObjectDrag,
    onCopy:value=>navigator.clipboard?.writeText(value), onConnectorDoubleClick:focusConnectorTarget,
  };
  // One set of stable dispatchers serves every object and always calls this
  // render's actions, including the latest camera and collaboration state.
  const objectActions = useMemo(()=>Object.fromEntries(Object.keys(objectActionsRef.current)
    .map(key=>[key,(...args)=>objectActionsRef.current[key](...args)])),[]);


  return <div className="canvas-app-page" data-theme={theme} data-info-collapsed={chrome.collapsed.info}>
    <div style={{ display: 'contents' }} inert={!hostStatus.editable && !error ? '' : undefined}>
    <header className={`canvas-topbar${chrome.collapsed.info?' is-collapsed':''}`}>
      {chrome.collapsed.info && <span className="canvas-chrome-label">{ui("캔버스 정보")}</span>}
      <div id="canvas-info-content" className="canvas-info-content" hidden={chrome.collapsed.info}>
      <div className="canvas-title-group"><div className="canvas-title-copy"><h1 title={canvas?.canvas_name}>{canvas?.canvas_name || ui('캔버스 {id}',{id:canvasId})}</h1></div></div>
      <div className="canvas-header-right"><div className="canvas-top-right"><LanguageSwitcher /><span className={`connection-pill ${connection}`} role="status" aria-live="polite" title={connection === 'connecting' ? ui("다시 연결하는 중입니다. 캔버스 편집은 계속할 수 있고 변경 사항은 연결 후 저장됩니다.") : connection === 'connected' ? ui("서버에 연결되어 변경 사항을 동기화하고 있습니다.") : ui("서버 연결이 해제되었습니다.")}><i />{connection === 'connected' ? ui("연결됨") : connection === 'connecting' ? ui("연결 중") : ui("연결 해제")}</span><CanvasPresenceStack participants={onlineParticipants} token={token} onManage={() => { setShowSettings(false); setShowParticipants(true); }} /><button className="button button-outline canvas-settings-button" onClick={() => { setShowParticipants(false); setShowSettings(true); }}><Icon name="settings" size={17} /><span>{ui("설정")}</span></button></div></div>
      </div>{chrome.collapsed.info && <div className="canvas-folded-language"><LanguageSwitcher /></div>}<ChromeToggle label={ui("캔버스 정보")} collapsed={chrome.collapsed.info} onToggle={()=>chrome.toggle('info')} controls="canvas-info-content" />
    </header>
    {error ? <div className="canvas-error-state"><div className="error-art"><Icon name="grid" size={30} /></div><span className="section-kicker">CANVAS CONNECTION</span><h1>{ui("캔버스를 열 수 없어요.")}</h1><p>{error}</p><div><button className="button button-dark" onClick={() => window.location.reload()}>{ui("다시 연결하기")}</button><Link className="button button-outline" to="/search">{ui("캔버스 목록")}</Link></div></div> : <div className="canvas-workspace resizable-workspace" ref={panelLayout.ref} style={panelLayout.style}>
      <ResizablePanel {...panelLayout.handle('tools')}><CanvasToolPanel activeTool={activeTool} onSelectTool={selectCanvasTool} color={color} onColorChange={setColor} onUploadPdf={uploadPdf} onUploadImage={uploadImage} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} /></ResizablePanel>
      <CanvasQuickDock activeTool={activeTool} onSelectTool={selectCanvasTool} onUploadImage={uploadImage}
        toolsExpanded={!panelLayout.handle('tools').collapsed} onToggleTools={panelLayout.handle('tools').onToggle} />
      <main className="board-region"><div className="board-topline"><div className="board-toolbar-actions"><button className="board-toggle" disabled={!canvasSnapshotLoadedRef.current} onClick={() => { finishEditing(editingId); setShowCanvasCode(true); }}><Icon name="code" size={15} />{ui("캔버스 코드")}</button><button className="zoom-button" aria-label={ui("확대")} title={ui("클릭: 한 단계 확대 · 길게 누르기: 계속 확대")} onPointerDown={(event) => startZoomHold(event, 1 + 0.3 * zoomSensitivity)} onPointerUp={stopZoomHold} onPointerCancel={cancelZoomHold} onLostPointerCapture={stopZoomHold} onClick={() => clickZoom(1 + 0.3 * zoomSensitivity)}>+</button><span className="zoom-value">{formatCanvasZoom(camera.scale)}</span><button className="zoom-button" aria-label={ui("축소")} title={ui("클릭: 한 단계 축소 · 길게 누르기: 계속 축소")} onPointerDown={(event) => startZoomHold(event, 1 / (1 + 0.3 * zoomSensitivity))} onPointerUp={stopZoomHold} onPointerCancel={cancelZoomHold} onLostPointerCapture={stopZoomHold} onClick={() => clickZoom(1 / (1 + 0.3 * zoomSensitivity))}>−</button><button className="zoom-button zoom-reset" onClick={() => { cancelPanInertia(); setCamera(fitCanvasCamera(viewportSize)); }}>{ui("맞춤")}</button><button className={`board-toggle${showGrid ? ' active' : ''}`} onClick={toggleGrid} aria-pressed={showGrid}><Icon name="grid" size={15} />{"" + ui("격자") + " "}{showGrid ? ui("켜짐") : ui("꺼짐")}</button></div></div>
        <div className={`canvas-stage ${activeTool === 'select' ? 'select-mode' : ''}${!['select', 'connect', 'hand'].includes(activeTool) ? ' creation-mode' : ''}${activeTool === 'pen' ? ' drawing-mode' : ''}${activeTool === 'laser' ? ' laser-mode' : ''}${activeTool === 'hand' ? ' hand-mode' : ''}${activeTool === 'eraser' ? ' eraser-active' : ''}${showGrid ? '' : ' no-grid'}`} style={{ ...canvasGridStyle(camera), ...backgroundStyle }} ref={boardRef} tabIndex={-1} {...stagePointerHandlers({ activeTool, dragRef, panRef, spacePressedRef, startPan, cancelCameraMotion: cancelPanInertia, startDrawing, moveDrawing, stopDrawing, moveObject, stopObjectDrag, hideCursor, sendCursorPosition, pickVector: (event,doubleClick = false,capture = false) => {
            if (!['select', 'connect'].includes(activeTool) || event.button !== 0 || event.target.closest?.('.canvas-minimap, .stage-label, button, input, textarea')) return false;
            const target=event.target.closest?.('.canvas-object');
            if(capture !== Boolean(target))return false;
            const hit = hitTestVector(spatialIndex, pointerPosition(event), boardSize, camera.scale, vectorHitOrder, representationScale);
            if (!hit) return false;
            if(target){
              const targetId=target.dataset.itemId,below=items[targetId];
              if(hit.id===targetId || !below || itemDepth(hit.item)<itemDepth(below))return false;
              if(itemDepth(hit.item)===itemDepth(below) && (!['shape','stroke','connector','text'].includes(below.kind) || (vectorHitOrder.get(hit.id)||0)<=(vectorHitOrder.get(targetId)||0)))return false;
            }
            if(doubleClick) handleObjectDoubleClick(event,{id:hit.id,item:hit.item,activeTool,editing:editingId===hit.id,...objectActions});
            else objectActions.onPointerDown(event, hit.id, hit.item);
            return true;
          } })}>
          <InteractiveAtmosphere variant="canvas" />
          <div className="stage-label"><span>FRELOG / {String(canvasId).padStart(2, '0')}</span><b>{canvas?.canvas_name || ui("공유 캔버스")}</b></div>
          <div className="canvas-grid-surface" aria-hidden="true" />
          <div className="coordinate-plane" style={coordinatePlaneStyle} aria-hidden="true">{(showXAxis || showYAxis) && <CanvasAxisTicks boardRef={boardRef} camera={camera} showXAxis={showXAxis} showYAxis={showYAxis} />}{showXAxis && <span className="coordinate-x" />}{showYAxis && <span className="coordinate-y" />}{(showXAxis || showYAxis) && <i className="coordinate-origin">0</i>}</div>
          <div className="canvas-scene" ref={sceneRef} style={{ width: viewportSize.width, height: viewportSize.height, right: 'auto', bottom: 'auto' }}>
            {depthLayers.map((layer, index) => <div className="canvas-depth-layer" key={layer.depth} data-depth={layer.depth} style={{ position: 'absolute', inset: 0, zIndex: index + 1, pointerEvents: 'none' }}>
              <VectorLayer token={token} graphicsQuality={graphicsQuality} style={{ width: viewportSize.width, height: viewportSize.height, right: 'auto', bottom: 'auto' }} worldSize={boardSize} items={layer.vectors} referenceItems={items} routingRevision={spatialIndex.stats.boundsCalculated} inkItems={layer.inkItems} previewStrokes={layer.depth === 0 ? remoteDrawingStrokes : undefined} camera={camera} onReady={layer.depth === 0 ? (setDraft) => { vectorDraftRef.current = setDraft; } : undefined} />
            <div className="canvas-world-layer" style={{position:'absolute',width:boardSize.width,height:boardSize.height,transformOrigin:'top left',transform:`translate3d(${camera.x}px,${camera.y}px,0) scale(${camera.scale})`}}><CanvasLayerObjects objects={layer.domObjects} domSelection={domSelection} editingId={editingId} connectionStartId={connectionStartId} world={boardSize} scale={representationScale} token={token} runtimeStore={runtimeStore} selected={selectedObjectIdSet} singleSelection={hasSingleSelection} activeTool={activeTool} dirtyItems={dirtyItems} editorsByItem={editorsByItem} actions={objectActions} /></div>
            </div>)}
            <div className="canvas-world-layer" style={{ position: 'absolute', width:boardSize.width,height:boardSize.height,transformOrigin:'top left',transform:`translate3d(${camera.x}px,${camera.y}px,0) scale(${camera.scale})`, zIndex: depthLayers.length + 1, pointerEvents: 'none' }}>
            {selectedItem && selectedItem.kind !== 'connector' && activeTool === 'select' && !editingId && <RotationHandles sceneRef={sceneRef} id={String(primarySelectedItemId)} item={selectedItem} viewSize={boardSize} onPointerDown={startObjectRotation} onPointerMove={moveObject} onPointerUp={stopObjectDrag} />}
            {selectionIsSingleGroup && selectedObjectIds.length > 1 && activeTool === 'select' && !editingId && <GroupRotationHandles sceneRef={sceneRef} ids={selectedObjectIds} items={items} viewSize={boardSize} onPointerDown={startGroupRotation} onPointerMove={moveObject} onPointerUp={stopObjectDrag} />}
            <RemoteCursorLayer updaterRef={remoteCursorUpdaterRef} activePeerIds={activePeerIds} visibleBounds={visibleBounds} />
            </div>
          </div>
          <LaserLayer strokes={laserStrokes} width={viewportSize.width} height={viewportSize.height} worldSize={boardSize} camera={camera} />
          {selectionBox && <div className="canvas-selection-marquee" style={{ left: selectionBox.left, top: selectionBox.top, width: selectionBox.width, height: selectionBox.height }} aria-hidden="true" />}
          <div className={`canvas-minimap${chrome.collapsed.minimap?' is-collapsed':''}`} ref={minimapWidgetRef} style={minimapPosition ? { left: `${minimapPosition.left}px`, top: `${minimapPosition.top}px`, right: 'auto', bottom: 'auto' } : undefined} role="group" aria-label={ui("캔버스 미니맵")}>
            <div className="canvas-minimap-heading" onPointerDown={startMinimapWidgetMove} onPointerMove={moveMinimapWidget} onPointerUp={stopMinimapWidgetMove} onPointerCancel={stopMinimapWidgetMove} onLostPointerCapture={stopMinimapWidgetMove}><strong>{ui("미니맵")}</strong><ChromeToggle label={ui("미니맵")} collapsed={chrome.collapsed.minimap} onToggle={()=>chrome.toggle('minimap')} controls="canvas-minimap-content" /></div>
            <div id="canvas-minimap-content" className="canvas-minimap-map" hidden={chrome.collapsed.minimap} title={ui("클릭해 해당 위치로 이동 · 안쪽을 드래그해도 캔버스는 움직이지 않습니다")} onPointerDown={startMinimapPan} onPointerMove={moveMinimapPan} onPointerUp={stopMinimapPan} onPointerCancel={stopMinimapPan} onLostPointerCapture={stopMinimapPan}>
              {!chrome.collapsed.minimap && <CanvasMinimapObjects minimap={minimap} colors={minimapItemColors} selected={selectedObjectIdSet} />}
              <svg className="canvas-minimap-svg" viewBox={`${minimap.bounds.minX} ${minimap.bounds.minY} ${minimap.bounds.width} ${minimap.bounds.height}`} preserveAspectRatio="none" aria-label={ui("현재 화면을 중심으로 한 주변 객체")}>
                {showYAxis && <line className="canvas-minimap-axis" x1={boardSize.width / 2} y1={minimap.bounds.minY} x2={boardSize.width / 2} y2={minimap.bounds.maxY} />}
                {showXAxis && <line className="canvas-minimap-axis" x1={minimap.bounds.minX} y1={boardSize.height / 2} x2={minimap.bounds.maxX} y2={boardSize.height / 2} />}
                <rect className="canvas-minimap-viewport" x={minimap.viewport.minX} y={minimap.viewport.minY} width={minimap.viewport.maxX - minimap.viewport.minX} height={minimap.viewport.maxY - minimap.viewport.minY} rx="2" />
              </svg>
            </div>
          </div>
          {activeTool === 'eraser' && <div className="eraser-cursor" ref={eraserCursorRef} style={{ width: `${eraserWidth}px`, height: `${eraserWidth}px` }} aria-hidden="true" />}
          {sharePosition && <ShareComposer onCancel={() => { setSharePosition(null); setActiveTool('select'); }} onSubmit={placeSharedLink} />}
          {activeTool === 'laser' && <div className="draw-cursor-label laser-cursor-label"><Icon name="laser" size={13} />{" " + ui("가리키는 중 · 1.6초 후 사라짐") + ""}</div>}{activeTool === 'pen' && <div className="draw-cursor-label"><Icon name="pen" size={13} />{" " + ui("그리는 중") + ""}</div>}{activeTool === 'eraser' && <div className="draw-cursor-label"><Icon name="eraser" size={13} />{" " + ui("드로잉을 드래그해 지우기") + ""}</div>}{activeTool === 'connect' && <div className="draw-cursor-label"><Icon name="connect" size={13} /> {connectionStartId ? ui("도착 오브젝트 선택") : ui("시작 오브젝트 선택")}</div>}{activeTool === 'link' && !sharePosition && <div className="draw-cursor-label"><Icon name="link" size={13} />{" " + ui("공유 자료를 놓을 위치 선택") + ""}</div>}
        </div>
      </main>
<ResizablePanel {...panelLayout.handle('inspector')}><CanvasInspectorPanel graphicsQuality={graphicsQuality} changeGraphicsQuality={changeGraphicsQuality} spatialIndex={spatialIndex} updateContentSetting={updateContentSetting} updateChartItem={updateTableItem} onNavigateObject={focusCanvasObject} onOpenComments={id => { finishEditing(editingId); comments.open(id); }} {...{
        activeTool,
        canvasId,
        canvasParticipants,
        backgroundColor,
        setBackgroundColor,
        changeSelectionGroup,
        changeStrokeWidth,
        eraserWidth,
        changeEraserWidth,
        eraserMode,
        changeEraserMode,
        changeTableCount,
        changeTableSize,
        changeTheme,
        changeZoomSensitivity,
        color,
        connection,
        connectorColor,
        connectorEndHead,
        connectorStartHead, connectorHeadSize,
        connectorToEdit,
        connectorWidth,
        items,
        noteColor,
        primarySelectedItemId,
        selectItems,
        selectedArrow,
        selectedConnector,
        selectedItem,
        objectClipboard, clipboardBlocked,
        deleteItem,
        user, token, updateUserGroup,
        selectedObjectIds,
        selectedTable,
        selectionIsSingleGroup,
        setColor,
        favoriteColors,
        saveFavoriteColor,
        setConnectorColor,
        setConnectorWidth,
        setNoteColor,
        setShapeType: changeShapeType,
        setShowSettings,
        settings,
        shapeArrowEndHead,
        shapeArrowStartHead, shapeArrowHeadSize,
        shapeType,
        shapeFillColor,
        shapeFillOpacity, setShapeFillOpacity, shapeSketchFillOpacity, setShapeSketchFillOpacity, shapeVertexCount, shapeCornerStyle, updateNewShapeGeometry,
        shapeVisualStyle, setShapeVisualStyle, shapeStrokeEnabled, setShapeStrokeEnabled, shapeBorderWidth, setShapeBorderWidth, updateShapeAppearance,
        connectorVisualStyle, setConnectorVisualStyle,
        setShapeFillColor: changeShapeFillColor,
        updateShapeFill,
        showGrid, showXAxis, showYAxis, toggleXAxis, toggleYAxis,
        strokeWidth,
        penBrush, penOpacity, changePenBrush, changePenOpacity,
        tableConfig,
        theme,
        toggleGrid,
        updateArrowHead,
        updateConnectorAppearance,
        updateItemRotation, updateItemDepth, updateItemShadow, updateImageFrame,
        updateObjectDimensions,
        updateObjectFontSize,
        updateNewConnectorHead,
        updateNewShapeArrowHead,
        updateShapeArrowBend,
        zoomSensitivity
      }} /></ResizablePanel>
<ResizablePanel {...panelLayout.handle('chat')}><CanvasChatPanel {...{ chatHistoryLoading, connection, hasOlderMessages, loadOlderMessages, message, messages, setMessage, submitMessage }} participants={mentionParticipants} highlight={chatHighlight} onHighlightVisible={() => { if (chatJumpNote) { comments.dismiss(chatJumpNote); setChatJumpNote(null); } }} /></ResizablePanel>
    </div>}
    {toast && <div className="toast-message" role="status"><Icon name="check" size={16} />{ui(toast)}</div>}
    {comments.activeId && <ObjectCommentsPanel comments={comments} participants={mentionParticipants} connection={connection} />}
    <MentionNotifications notifications={comments.notifications} onJump={jumpToMention} onDismiss={comments.dismiss} />
    {showCanvasCode && <CanvasAsCodeDialog api={canvasCodeApi} canvasId={canvasId} onClose={() => setShowCanvasCode(false)} />}
    {showSettings && <SettingsDialog backgroundColor={backgroundColor} setBackgroundColor={setBackgroundColor} favoriteColors={favoriteColors} saveFavoriteColor={saveFavoriteColor} theme={theme} canvasId={canvasId} image={canvas?.image} token={token} onImageSaved={(image) => setCanvas(current => ({ ...current, image }))} settings={settings} pending={settingsPending} onClose={() => setShowSettings(false)} onUpdate={sendSettings} />}
    {showParticipants && <CanvasParticipantsDialog participants={canvasParticipants} token={token} settings={settings} pending={settingsPending} onClose={() => setShowParticipants(false)} onAddParticipant={(nickname, tag) => sendSettings('participant_add', null, { nickname, tag_number: tag })} onRemoveParticipant={(person) => sendSettings('participant_remove', null, { nickname: person.nickname, tag_number: person.tag_number })} />}
    </div>
    {!error && !hostStatus.editable && <CanvasLoadingStatus overlay message={hostStatus.message} />}
  </div>;
}

export default function CanvasPage() {


  const { canvasId } = useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    automergeReady.then(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  if (!ready) return <div className="canvas-app-page"><CanvasLoadingStatus /></div>;
  return <CanvasWorkspace key={canvasId} />;
}
