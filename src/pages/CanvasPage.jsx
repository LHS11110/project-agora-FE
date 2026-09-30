import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Automerge from '@automerge/automerge/slim';
import automergeWasmUrl from '@automerge/automerge/automerge.wasm?url';
import { Link, useNavigate, useParams } from '../routing.jsx';
import Icon from '../components/Icon.jsx';
import AuthenticatedImage from '../components/AuthenticatedImage.jsx';
import ShareComposer from '../components/ShareComposer.jsx';
import VectorLayer from '../components/VectorLayer.jsx';
import LaserLayer from '../components/LaserLayer.jsx';
import RotationHandles from '../components/CanvasRotationHandles.jsx';
import CanvasSpatialBTree, { objectBounds } from '../components/CanvasSpatialBTree.js';
import CanvasObject from '../canvas/CanvasObject.jsx';
import RemoteCursorLayer from '../components/canvas/RemoteCursorLayer.jsx';
import SettingsDialog from '../components/canvas/CanvasSettingsDialog.jsx';
import CanvasInspectorPanel from '../components/canvas/CanvasInspectorPanel.jsx';
import CanvasChatPanel from '../components/canvas/CanvasChatPanel.jsx';
import { CHAT_HISTORY_LIMIT, CHAT_ROOM_ID } from '../canvas/canvasChat.js';
import { createId } from '../canvas/canvasIds.js';
import { uniqueCanvasParticipants } from '../canvas/canvasParticipants.js';
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
import { ERASER_RADIUS, LASER_FADE_MS, MAX_STROKE_WIDTH, MIN_STROKE_WIDTH, stickyNoteColors, inkColors, MIN_ZOOM_SENSITIVITY, MAX_ZOOM_SENSITIVITY } from '../canvas/canvasConstants.js';
import { textSpliceBetween } from '../canvas/collaborativeText.js';
import { isCanvasSyncItem, useCanvasPeerGeometry } from '../canvas/useCanvasPeerGeometry.js';
import { useCanvasNoteAutoSave } from '../canvas/useCanvasNoteAutoSave.js';
import { useCanvasStageInteractions } from '../canvas/useCanvasStageInteractions.js';
import { useCanvasPeerEvents } from '../canvas/useCanvasPeerEvents.js';
import { useCanvasObjectInteractions } from '../canvas/useCanvasObjectInteractions.js';
import { useCanvasConnection } from '../canvas/useCanvasConnection.js';
import { useCanvasMinimap } from '../canvas/useCanvasMinimap.js';
import { useCanvasServerChangeQueue } from '../canvas/useCanvasServerChangeQueue.js';
import { connectorGeometry } from '../components/connectorGeometry.js';
import { DEFAULT_ARROW_END_HEAD, DEFAULT_ARROW_START_HEAD, normalizeArrowHead } from '../components/arrowheadGeometry.js';
import { DEFAULT_SHAPE_ARROW_BEND, shapeArrowGeometry } from '../components/shapeArrowGeometry.js';
import { normalizeTableCount, resizeTableData, MAX_TABLE_COLUMNS, MAX_TABLE_ROWS } from '../components/tableModel.js';
import { useAuth } from '../state/AuthContext.jsx';

const ZOOM_SENSITIVITY_KEY = 'agora_canvas_zoom_sensitivity';
const STROKE_WIDTH_KEY = 'agora_canvas_stroke_width';
const automergeReady = Automerge.initializeWasm(automergeWasmUrl);

function CanvasWorkspace() {
  const { canvasId } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const boardRef = useRef(null);
  const sceneRef = useRef(null);
  const selectionRef = useRef(null);
  const stageWheelHandlerRef = useRef(null);
  const wsRef = useRef(null);
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
  const [canvas, setCanvas] = useState(null);
  const [items, setItems] = useState({});
  const [spatialRevision, setSpatialRevision] = useState(0);
  const [groups, setGroups] = useState([]);
  const [peerList, setPeerList] = useState([]);
  const [remoteEditors, setRemoteEditors] = useState({});
  const [remoteDrawingStrokes, setRemoteDrawingStrokes] = useState([]);
  const [laserStrokes, setLaserStrokes] = useState([]);
  const [dirtyItems, setDirtyItems] = useState(() => new Set());
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [boardSize, setBoardSize] = useState({ width: 1, height: 1 });
  const [zoomSensitivity, setZoomSensitivity] = useState(() => {
    const stored = Number(localStorage.getItem(ZOOM_SENSITIVITY_KEY));
    return Number.isFinite(stored) && stored >= MIN_ZOOM_SENSITIVITY && stored <= MAX_ZOOM_SENSITIVITY ? stored : 1;
  });
  const [settings, setSettings] = useState(null);
  const [connection, setConnection] = useState('connecting');
  const [reconnectEpoch, setReconnectEpoch] = useState(0);
  const [error, setError] = useState('');
  const [activeTool, setActiveTool] = useState('select');
  const [sharePosition, setSharePosition] = useState(null);
  const [color, setColor] = useState(inkColors[0]);
  const [connectorColor, setConnectorColor] = useState('#8b8f8c');
  const [connectorWidth, setConnectorWidth] = useState(1.5);
  const [connectorStartHead, setConnectorStartHead] = useState(DEFAULT_ARROW_START_HEAD);
  const [connectorEndHead, setConnectorEndHead] = useState(DEFAULT_ARROW_END_HEAD);
  const [shapeArrowStartHead, setShapeArrowStartHead] = useState(DEFAULT_ARROW_START_HEAD);
  const [shapeArrowEndHead, setShapeArrowEndHead] = useState(DEFAULT_ARROW_END_HEAD);
  const [noteColor, setNoteColor] = useState(stickyNoteColors[0]);
  const [tableConfig, setTableConfig] = useState({ rows: 3, columns: 3, width: 42, height: 32 });
  const [strokeWidth, setStrokeWidth] = useState(() => {
    const stored = Number(localStorage.getItem(STROKE_WIDTH_KEY));
    return Number.isFinite(stored) && stored >= MIN_STROKE_WIDTH && stored <= MAX_STROKE_WIDTH ? stored : 4;
  });
  const [theme, setTheme] = useState(() => localStorage.getItem('agora_canvas_theme') || 'light');
  const [showGrid, setShowGrid] = useState(() => localStorage.getItem('agora_canvas_grid') !== 'false');
  const [shapeType, setShapeType] = useState('rectangle');
  const [connectionStartId, setConnectionStartId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [selectionBox, setSelectionBox] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPending, setSettingsPending] = useState(false);
  const [toast, setToast] = useState('');
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
  const sendRtcRaw = useCallback((payload) => {
    const socket = rtcWsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    const request = payload?.request_id ? payload : { ...payload, request_id: createId() };
    socket.send(JSON.stringify(request)); return true;
  }, []);
  const requestChatHistory = useCallback((toSequence) => {
    if (chatHistoryRequestRef.current) return false;
    const requestId = createId();
    const payload = { type: 'chat_history', room_id: CHAT_ROOM_ID, request_id: requestId };
    if (toSequence == null) payload.limit = CHAT_HISTORY_LIMIT;
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
  const markItemDirty = useCallback((id) => {
    const key = String(id);
    itemEditRevisionRef.current.set(key, (itemEditRevisionRef.current.get(key) || 0) + 1);
    dirtyItemsRef.current = new Set(dirtyItemsRef.current).add(key);
    setDirtyItems((current) => new Set(current).add(key));
  }, []);
  stageOfflineGeometryRef.current = (rawId, item) => {
    if (!serverReconnectRequestedRef.current || !item) return;
    const id = String(rawId);
    if (isCollaborativeItem(item)) {
      if (!dirtyItemsRef.current.has(id)) markItemDirty(id);
      return;
    }
    if (!isCanvasSyncItem(item)) return;
    const payload = { type: 'item_update', item_id: id, item };
    enqueueServerChange({
      id,
      payload,
      previous: itemsRef.current[id],
      item,
      type: 'item_update',
      wasNewCollaborative: false,
      syncAction: 'upsert',
      syncVersion: itemSyncVersionsRef.current.get(id) || null,
    });
  };
  const refreshSpatialIndex = useCallback(() => setSpatialRevision((revision) => revision + 1), []);
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
    itemsRef.current = { ...itemsRef.current, [id]: nextItem };
    setItems((current) => ({ ...current, [id]: nextItem }));
    if (change) {
      const version = nextPeerSyncVersion(syncClockRef, syncActorRef);
      itemSyncVersionsRef.current.set(String(id), version);
      peerMeshRef.current?.sendData({ type: 'doc_change', item_id: String(id), field, change, version }, (peer) => canPeerAccessItem(item, peer));
    }
    markItemDirty(id);
  }, [getCollaborativeDoc, markItemDirty]);
  const updateCollaborativeMetadata = useCallback((id, field, value) => {
    const key = String(id);
    const item = itemsRef.current[key];
    const nextValue = field === 'groupId' ? String(value || '') : String(value ?? '');
    const validField = field === 'groupId'
      ? isCollaborativeItem(item) && nextValue.length <= 128
      : field === 'color'
      ? item?.kind === 'note' && /^#[0-9a-f]{6}$/i.test(nextValue)
      : item?.kind === 'code' && ['filename', 'language'].includes(field);
    if (!isCollaborativeItem(item) || !validField) return;
    const nextItem = { ...item, [field]: field === 'groupId' ? nextValue || null : nextValue };
    itemsRef.current = { ...itemsRef.current, [key]: nextItem };
    setItems((current) => ({ ...current, [key]: nextItem }));
    markItemDirty(key);
    const version = nextPeerSyncVersion(syncClockRef, syncActorRef);
    itemSyncVersionsRef.current.set(key, version);
    peerMeshRef.current?.sendData({ type: 'item_metadata', item_id: key, field, value: nextValue, version }, (peer) => canPeerAccessItem(nextItem, peer));
    if (item.kind === 'note' && field === 'groupId') saveCollaborativeItemRef.current?.(key, { silent: true });
  }, [markItemDirty]);
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
      if (!queued && !serverReconnectRequestedRef.current) setToast('WebRTC 동기화 대기열이 가득 차 일부 변경을 전달하지 못했습니다. 재접속하면 다시 동기화됩니다.');
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
    if (!queued && !serverReconnectRequestedRef.current) setToast('WebRTC 동기화 대기열이 가득 차 일부 변경을 전달하지 못했습니다. 재접속하면 다시 동기화됩니다.');
  }, []);
  const sendItemChange = useCallback((payload, previous) => {
    const requestPayload = payload?.request_id ? payload : { ...payload, request_id: createId() };
    const socket = wsRef.current;
    const id = String(requestPayload.item_id);
    const syncItem = requestPayload.type === 'item_update' && isCanvasSyncItem(requestPayload.item) && !isCollaborativeItem(requestPayload.item)
      ? requestPayload.item : null;
    const syncDeleteItem = requestPayload.type === 'item_delete' && isCanvasSyncItem(previous) ? previous : null;
    const syncVersion = syncItem || syncDeleteItem ? nextPeerSyncVersion(syncClockRef, syncActorRef) : null;
    const previousSyncVersion = itemSyncVersionsRef.current.get(id) || null;
    const previousTombstone = deletedItemSyncVersionsRef.current.get(id) || null;
    if (syncVersion) {
      itemSyncVersionsRef.current.set(id, syncVersion);
      if (syncDeleteItem) deletedItemSyncVersionsRef.current.set(id, { version: syncVersion, permission: syncDeleteItem.permission });
      else deletedItemSyncVersionsRef.current.delete(id);
    }
    const entry = enqueueServerChange({
      id,
      payload: requestPayload,
      previous,
      item: syncItem,
      type: requestPayload.type,
      wasNewCollaborative: newCollaborativeItemsRef.current.has(id),
      syncAction: syncDeleteItem ? 'delete' : syncItem ? 'upsert' : null,
      syncVersion,
      previousSyncVersion,
      previousTombstone,
    });
    if (entry.syncAction) broadcastPeerItemState(entry);
    if (entry.canceled) return true;
    if (serverReconnectRequestedRef.current || !socket || socket.readyState !== WebSocket.OPEN) {
      if (!autoReconnectRef.current) reconnectRequestRef.current?.();
      return true;
    }

    pendingItemChangesRef.current.push(entry);
    try {
      socket.send(JSON.stringify(requestPayload));
      markServerChangeSent(entry);
      socket.send(JSON.stringify({ type: 'ping' }));
    } catch {
      const pendingIndex = pendingItemChangesRef.current.lastIndexOf(entry);
      if (pendingIndex >= 0) pendingItemChangesRef.current.splice(pendingIndex, 1);
      if (!autoReconnectRef.current) reconnectRequestRef.current?.();
    }
    return true;
  }, [broadcastPeerItemState, enqueueServerChange, markServerChangeSent]);
  const updateTableItem = useCallback((id, update) => {
    const key = String(id);
    const previous = itemsRef.current[key];
    if (previous?.kind !== 'table') return false;
    const nextItem = typeof update === 'function' ? update(previous) : { ...previous, ...update };
    if (!nextItem || nextItem === previous) return false;
    itemsRef.current = { ...itemsRef.current, [key]: nextItem };
    setItems((current) => ({ ...current, [key]: nextItem }));
    if (previous.x !== nextItem.x || previous.y !== nextItem.y || previous.width !== nextItem.width || previous.height !== nextItem.height) refreshSpatialIndex();
    if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = { ...itemsRef.current, [key]: previous };
      setItems((current) => ({ ...current, [key]: previous }));
      refreshSpatialIndex();
      setToast('연결이 복구되면 테이블을 다시 편집해주세요.');
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
  const updateItemRotation = (id, value) => {
    const key = String(id);
    const previous = itemsRef.current[key];
    if (!previous) return;
    const rotation = Math.max(-180, Math.min(180, Number(value) || 0));
    if ((Number(previous.rotation) || 0) === rotation) return;
    const nextItem = { ...previous, rotation };
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
  const updateShapeArrowBend = (id, value) => {
    const key = String(id);
    const previous = itemsRef.current[key];
    if (previous?.kind !== 'shape' || previous.shapeType !== 'arrow') return;
    const bend = Math.max(-1.5, Math.min(1.5, Number(value) || 0));
    if ((Number(previous.bend) || DEFAULT_SHAPE_ARROW_BEND) === bend) return;
    const nextItem = { ...previous, bend };
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
    if (!['startHead', 'endHead'].includes(field)
      || !(previous?.kind === 'connector' || (previous?.kind === 'shape' && previous.shapeType === 'arrow'))) return;
    const head = normalizeArrowHead(value, null);
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
    if (field === 'startHead') setConnectorStartHead(value);
    else setConnectorEndHead(value);
  };
  const updateNewShapeArrowHead = (field, value) => {
    if (field === 'startHead') setShapeArrowStartHead(value);
    else setShapeArrowEndHead(value);
  };
  const updateConnectorAppearance = (id, field, value) => {
    const key = String(id);
    const previous = itemsRef.current[key];
    if (previous?.kind !== 'connector') return;
    const nextValue = field === 'strokeWidth'
      ? Math.max(0.8, Math.min(4, Number(value) || 1.5))
      : /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : previous.color || '#8b8f8c';
    if (previous[field] === nextValue) return;
    const nextItem = { ...previous, [field]: nextValue };
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
  }, [markItemDirty, refreshSpatialIndex, selectItems, sendItemChange]);
  const deleteItem = useCallback((id) => {
    const previous = itemsRef.current[id];
    const key = String(id);
    if (!sendItemChange({ type: 'item_delete', item_id: id }, previous)) return false;
    const next = { ...itemsRef.current };
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
    const key = String(id);
    const item = itemsRef.current[key];
    if (!isCollaborativeItem(item)) return false;
    const doc = getCollaborativeDoc(key, item);
    const baseDoc = getCollaborativeBaseDoc(key, item);
    const field = collaborativeField(item);
    const changes = Automerge.getChanges(baseDoc, doc).map((change) => ({ field, change: encodeBase64(change) }));
    const savedItem = {
      ...item,
      [field]: doc.content,
      automerge_snapshot: encodeBase64(Automerge.save(baseDoc)),
      automerge_changes: changes,
    };
    const revision = itemEditRevisionRef.current.get(key) || 0;
    if (!sendItemChange({ type: 'item_save', item_id: key, item: savedItem }, item)) {
      if (!silent) setToast(item.kind === 'note' ? '서버 연결이 복구되면 포스트잇을 다시 저장해주세요.' : '서버 연결이 복구되면 Ctrl + S로 다시 저장해주세요.');
      return false;
    }
    itemsRef.current = { ...itemsRef.current, [key]: savedItem };
    setItems((current) => ({ ...current, [key]: savedItem }));
    if ((itemEditRevisionRef.current.get(key) || 0) === revision
      && !serverReconnectRequestedRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      setDirtyItems((current) => { const next = new Set(current); next.delete(key); return next; });
    }
    if (!silent) {
      setToast('저장 요청을 처리했습니다.');
      window.setTimeout(() => setToast(''), 2400);
    }
    return true;
  }, [getCollaborativeBaseDoc, getCollaborativeDoc, sendItemChange]);
  saveCollaborativeItemRef.current = saveCollaborativeItem;
  useCanvasNoteAutoSave({ canSave: canvasSnapshotLoadedRef.current && connection !== 'disconnected', dirtyItems, itemsRef, itemEditRevisionRef, saveCollaborativeItem });
  const { receivePeerData, receiveLaser } = useCanvasPeerEvents({
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
      collaborativeBaseDocsRef,
      collaborativeDocsRef,
      deletedItemSyncVersionsRef,
      dirtyItemsRef,
      draftRef,
      dragRef,
      drawingSessionRef,
      editingIdRef,
      groupsRef,
      itemSyncVersionsRef,
      itemsRef,
      newCollaborativeItemsRef,
      peerMeshRef,
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
      setItems,
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
      refreshSpatialIndex,
      rejectServerChange,
      replacePersistedItems,
      requestChatHistory,
      sendItemChange,
      sendRaw,
      sendRtcRaw
    },
  });

  const spatialIndex = useMemo(() => new CanvasSpatialBTree(items, boardSize), [spatialRevision, boardSize]);
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
  } = useCanvasMinimap({ boardRef, boardSize, camera, setCamera, items });
  const activePeerIds = useMemo(() => peerList.filter((peer) => peer.connected).map((peer) => peer.peer_id).sort().join('\n'), [peerList]);
  const axisOriginX = boardSize.width * camera.scale / 2 + camera.x;
  const axisOriginY = boardSize.height * camera.scale / 2 + camera.y;
  const coordinatePlaneStyle = {
    '--axis-origin-x': `${axisOriginX}px`,
    '--axis-origin-y': `${axisOriginY}px`,
    '--axis-x-arrow-opacity': axisOriginX <= boardSize.width ? 1 : 0,
    '--axis-y-arrow-opacity': axisOriginY >= 0 ? 1 : 0,
  };
  const visibleEntries = useMemo(() => {
    const entries = new Map(spatialIndex.query(visibleBounds)
      .map((entry) => [entry.id, { ...entry, item: items[entry.id] || entry.item }]));
    const draggingId = dragRef.current?.id;
    if (draggingId && items[draggingId]) {
      const item = items[draggingId];
      entries.set(draggingId, {
        id: draggingId,
        item,
        bounds: objectBounds(item, items, boardSize.width, boardSize.height),
      });
    }
    return [...entries.values()];
  }, [boardSize.height, boardSize.width, items, spatialIndex, visibleBounds]);
  const visibleItemKey = visibleEntries.map((entry) => entry.id).join('\u0000');
  const visibleItemIds = useMemo(() => new Set(visibleEntries.map((entry) => entry.id)), [visibleItemKey]);
  const visibleVectorItems = useMemo(() => Object.fromEntries(visibleEntries
    .filter(({ item }) => ['stroke', 'shape', 'connector'].includes(item?.kind))
    .map(({ id, item }) => [id, item])), [visibleEntries]);
  const sortedItems = useMemo(() => visibleEntries
    .filter(({ item }) => ['image', 'link', 'code', 'note', 'table', 'shape', 'text', 'math', 'stroke', 'connector'].includes(item?.kind))
    .sort((a, b) => a.bounds.minY - b.bounds.minY)
    .map(({ id, item, bounds }) => [id, item, bounds, item.kind === 'connector' ? connectorGeometry(item, items, boardSize.width, boardSize.height) : null]), [boardSize.height, boardSize.width, items, visibleEntries]);
  const selectedObjectIds = selectedItemIds.filter((id) => Boolean(items[id]));
  const selectedObjectIdsKey = selectedObjectIds.join('|');
  const selectedObjectIdSet = new Set(selectedObjectIds);
  const hasSingleSelection = selectedObjectIds.length === 1;
  const primarySelectedItemId = selectedObjectIdSet.has(String(selectedItemId)) ? String(selectedItemId) : selectedObjectIds[selectedObjectIds.length - 1] || null;
  const selectedTable = hasSingleSelection && items[primarySelectedItemId]?.kind === 'table' ? items[primarySelectedItemId] : null;
  const selectedItem = hasSingleSelection ? items[primarySelectedItemId] : null;
  const selectedConnector = selectedItem?.kind === 'connector' ? selectedItem : null;
  const selectedArrow = selectedItem?.kind === 'shape' && selectedItem.shapeType === 'arrow' ? selectedItem : null;
  const connectorToEdit = activeTool === 'connect' ? null : selectedConnector;
  const permission = groups.includes('default') ? 'default' : groups[0] || 'admin-group';
  const selectedGroupIds = new Set(selectedObjectIds.map((id) => items[id]?.groupId).filter(Boolean));
  const selectionIsSingleGroup = selectedObjectIds.length > 0 && selectedGroupIds.size === 1
    && selectedObjectIds.every((id) => items[id]?.groupId === [...selectedGroupIds][0]);
  const changeSelectionGroup = (shouldGroup) => {
    const ids = selectedObjectIds.filter((id) => itemsRef.current[id] && !['stroke', 'connector'].includes(itemsRef.current[id].kind));
    if (shouldGroup && ids.length < 2) return;
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
        if (nextItem.kind === 'note') saveCollaborativeItemRef.current?.(id, { silent: true });
      } else if (sendItemChange({ type: 'item_update', item_id: id, item: nextItem }, previous)) {
        nextItems[id] = nextItem;
      }
    }
    itemsRef.current = nextItems;
    setItems(nextItems);
    if (shouldGroup) selectItems(ids, ids[ids.length - 1]);
    setToast(shouldGroup ? `${ids.length}개 오브젝트를 그룹화했습니다.` : '그룹을 해제했습니다.');
  };
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
    const focusedElement = document.activeElement;
    if (editor?.contains(focusedElement) && typeof focusedElement.blur === 'function') focusedElement.blur();
    if (editingIdRef.current === key) {
      editingIdRef.current = null;
      broadcastEditorPresence(key, false);
    }
    setEditingId((current) => String(current) === key ? null : current);
  }, [broadcastEditorPresence, editingId]);
  const focusConnectorTarget = (connector, connectorId) => {
    if (activeTool !== 'select') return;
    const target = itemsRef.current[String(connector.to)];
    const board = boardRef.current?.getBoundingClientRect();
    if (!target || !board) return;
    const bounds = objectBounds(target, itemsRef.current, board.width, board.height);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    selectItems([connectorId ?? connector.to], connectorId ?? connector.to);
    setCamera((current) => ({
      ...current,
      x: board.width / 2 - centerX * board.width * current.scale,
      y: board.height / 2 - centerY * board.height * current.scale,
    }));
  };
  const sendSettings = (field, value, participant) => {
    if (!settings || settingsPending) return;
    const payload = { type: 'canvas_settings_update', request_id: createId(), expected_revision: settings.settings_revision ?? 0, field };
    if (participant) Object.assign(payload, participant); else payload.value = value;
    if (sendRaw(payload)) setSettingsPending(true);
  };
  const { pointerPosition, startPan, centeredItemPosition, hideCursor, startZoomHold, stopZoomHold, cancelZoomHold, clickZoom, startDrawing, moveDrawing, stopDrawing } = useCanvasStageInteractions({
    boardRef, camera, setCamera, activeTool, eraserCursorRef, itemsRef, boardSize,
    addItem, deleteItem, setToast, sendItemChange, setItems, refreshSpatialIndex,
    lastCursorSentAtRef, peerMeshRef, panRef, zoomHoldRef, zoomPointerPressRef, zoomSensitivity,
    stageWheelHandlerRef, laserDrawingRef, setLaserStrokes, selectionRef, selectedItemIds,
    setSelectionBox, selectItems, canvasSnapshotLoadedRef, finishEditing, setConnectionStartId,
    spacePressedRef, tableConfig, permission, setSharePosition, shapeType, shapeArrowStartHead,
    shapeArrowEndHead, color, noteColor, setActiveTool, startEditing, strokeWidth,
    drawingRef, drawingSessionRef, draftRef, vectorDraftRef,
  });
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
    event.preventDefault(); const text = message.trim();
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
  } = useCanvasObjectInteractions({
    activeTool,
    addItem,
    boardRef,
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
  });
  const changeTheme = (nextTheme) => { localStorage.setItem('agora_canvas_theme', nextTheme); setTheme(nextTheme); };
  const toggleGrid = () => { const next = !showGrid; localStorage.setItem('agora_canvas_grid', String(next)); setShowGrid(next); };
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
  useEffect(() => {
    const host = boardRef.current;
    if (!host) return undefined;
    const updateSize = () => {
      const bounds = host.getBoundingClientRect();
      setBoardSize({ width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) });
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    updateSize();
    return () => observer.disconnect();
  }, [error]);
  useEffect(() => {
    const isEditableTarget = (target) => target instanceof HTMLElement
      && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    const onDeleteKeyDown = (event) => {
      if (event.repeat) return;
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('.code-shared-input, .code-filename-input, .code-language-select')) return;
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
      const target = event.target instanceof HTMLElement ? event.target : null;
      const clickedEditorField = target?.closest('textarea, input, select, [contenteditable="true"]');
      if (editor?.contains(target) && clickedEditorField) return;
      finishEditing(editingId);
    };
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown, true);
  }, [editingId, finishEditing]);
  const canvasParticipants = uniqueCanvasParticipants(settings?.participants);
  const otherParticipants = uniqueCanvasParticipants(settings?.participants, user);

  return <div className="canvas-app-page" data-theme={theme}>
    <header className="canvas-topbar">
      <div className="canvas-title-group"><Link to="/search" className="canvas-back" aria-label="캔버스 목록"><Icon name="back" size={19} /></Link><div className="canvas-cover-image"><AuthenticatedImage src={canvas?.image} token={token} alt="캔버스 대표 이미지" fallback={<div className="canvas-cover-art"><i /><i /><i /><span>AG</span></div>} loadingFallback={<div className="canvas-cover-art"><i /><i /><i /><span>AG</span></div>} /></div><div className="canvas-title-copy"><span>AGORA CANVAS · #{canvasId}</span><h1>{canvas?.canvas_name || `캔버스 ${canvasId}`}</h1></div></div>
      <div className="canvas-header-right"><div className="canvas-description-card"><span>캔버스 설명</span><p>{canvas?.description || '함께 아이디어를 모으고 실시간으로 만들어가는 공간입니다.'}</p></div><div className="canvas-top-right"><span className={`connection-pill ${connection}`} role="status" aria-live="polite" title={connection === 'connecting' ? '다시 연결하는 중입니다. 캔버스 편집은 계속할 수 있고 변경 사항은 연결 후 저장됩니다.' : connection === 'connected' ? '서버에 연결되어 변경 사항을 동기화하고 있습니다.' : '서버 연결이 해제되었습니다.'}><i />{connection === 'connected' ? '연결됨' : connection === 'connecting' ? '연결 중' : '연결 해제'}</span><div className="collaborator-avatars"><span>{(user?.nickname || 'A').slice(0, 1)}</span>{otherParticipants.slice(0, 2).map((person) => <span key={`${person.nickname}-${person.tag_number}`}>{person.nickname.slice(0, 1)}</span>)}</div><button className="button button-outline canvas-settings-button" onClick={() => setShowSettings(true)}><Icon name="settings" size={17} /><span>설정</span></button></div></div>
    </header>
    {error ? <div className="canvas-error-state"><div className="error-art"><Icon name="grid" size={30} /></div><span className="section-kicker">CANVAS CONNECTION</span><h1>캔버스를 열 수 없어요.</h1><p>{error}</p><div><button className="button button-dark" onClick={() => window.location.reload()}>다시 연결하기</button><Link className="button button-outline" to="/search">캔버스 목록</Link></div></div> : <div className="canvas-workspace">
      <aside className="canvas-tools" aria-label="캔버스 도구">
        <div className="tool-group"><button className={`tool-button${activeTool === 'select' ? ' active' : ''}`} title="선택 및 이동" aria-label="선택 및 이동" onClick={() => setActiveTool('select')}><Icon name="select" size={19} /></button><button className={`tool-button${activeTool === 'pen' ? ' active' : ''}`} title="드로잉" aria-label="드로잉" onClick={() => setActiveTool('pen')}><Icon name="pen" size={19} /></button><button className={`tool-button${activeTool === 'laser' ? ' active' : ''}`} title="레이저 포인터" aria-label="레이저 포인터" onClick={() => setActiveTool('laser')}><Icon name="laser" size={19} /></button><button className={`tool-button${activeTool === 'eraser' ? ' active' : ''}`} title="드로잉 지우개" aria-label="드로잉 지우개" onClick={() => setActiveTool('eraser')}><Icon name="eraser" size={19} /></button><button className={`tool-button${activeTool === 'connect' ? ' active' : ''}`} title="오브젝트 연결" aria-label="오브젝트 연결" onClick={() => { setConnectionStartId(null); setActiveTool('connect'); }}><Icon name="connect" size={19} /></button></div>
        <div className="tool-separator" /><div className="tool-group"><button className={`tool-button${activeTool === 'shape' ? ' active' : ''}`} title="도형" aria-label="도형" onClick={() => setActiveTool('shape')}><Icon name="shape" size={19} /></button><button className={`tool-button${activeTool === 'text' ? ' active' : ''}`} title="텍스트" aria-label="텍스트" onClick={() => setActiveTool('text')}><Icon name="text" size={19} /></button><button className={`tool-button${activeTool === 'note' ? ' active' : ''}`} title="포스트잇" aria-label="포스트잇" onClick={() => setActiveTool('note')}><Icon name="sticky" size={19} /></button><button className={`tool-button${activeTool === 'math' ? ' active' : ''}`} title="수식 작성" aria-label="수식 작성" onClick={() => setActiveTool('math')}><Icon name="math" size={19} /></button><button className={`tool-button${activeTool === 'table' ? ' active' : ''}`} title="테이블" aria-label="테이블" onClick={() => setActiveTool('table')}><Icon name="table" size={19} /></button></div>
        <div className="tool-separator" /><div className="tool-group"><label className="tool-button file-tool" title="사진 올리기" aria-label="사진 올리기"><Icon name="image" size={19} /><input type="file" accept="image/*" onChange={uploadImage} /></label><button className={`tool-button${activeTool === 'code' ? ' active' : ''}`} title="코드 블록" aria-label="코드 블록" onClick={() => setActiveTool('code')}><Icon name="code" size={19} /></button><button className={`tool-button${activeTool === 'link' ? ' active' : ''}`} title="동영상·링크 공유" aria-label="동영상·링크 공유" onClick={() => setActiveTool('link')}><Icon name="link" size={19} /></button></div>
        <div className="tool-separator" /><div className="color-picker" aria-label="펜 및 도형 색상">{inkColors.map((ink) => <button key={ink} style={{ '--ink': ink }} className={color === ink ? 'selected' : ''} onClick={() => setColor(ink)} aria-label={`색상 ${ink}`} />)}</div><div className="tool-bottom"><span className="tool-help">CANVAS</span><span>도구</span></div>
      </aside>
      <main className="board-region"><div className="board-topline"><span className="board-section-label"><i /> 2차 좌표 캔버스</span><div className="board-toolbar-actions"><span className="board-updated" title="텍스트·코드는 Ctrl+S 저장, 포스트잇은 변경 후 자동 저장"><Icon name="clock" size={14} /> P2P {peerList.filter((peer) => peer.connected).length}명 · 저장 Ctrl+S</span><button className="zoom-button" aria-label="확대" title="클릭: 한 단계 확대 · 길게 누르기: 계속 확대" onPointerDown={(event) => startZoomHold(event, 1 + 0.15 * zoomSensitivity)} onPointerUp={stopZoomHold} onPointerCancel={cancelZoomHold} onLostPointerCapture={stopZoomHold} onClick={() => clickZoom(1 + 0.15 * zoomSensitivity)}>+</button><span className="zoom-value">{Math.round(camera.scale * 100)}%</span><button className="zoom-button" aria-label="축소" title="클릭: 한 단계 축소 · 길게 누르기: 계속 축소" onPointerDown={(event) => startZoomHold(event, 1 / (1 + 0.15 * zoomSensitivity))} onPointerUp={stopZoomHold} onPointerCancel={cancelZoomHold} onLostPointerCapture={stopZoomHold} onClick={() => clickZoom(1 / (1 + 0.15 * zoomSensitivity))}>−</button><button className="zoom-button zoom-reset" onClick={() => setCamera({ x: 0, y: 0, scale: 1 })}>맞춤</button><button className={`board-toggle${showGrid ? ' active' : ''}`} onClick={toggleGrid} aria-pressed={showGrid}><Icon name="grid" size={15} />격자 {showGrid ? '켜짐' : '꺼짐'}</button></div></div>
        <div className={`canvas-stage ${activeTool === 'select' ? 'select-mode' : ''}${activeTool === 'pen' ? ' drawing-mode' : ''}${activeTool === 'laser' ? ' laser-mode' : ''}${activeTool === 'eraser' ? ' eraser-active' : ''}${showGrid ? '' : ' no-grid'}`} style={{ '--grid-size': `${20 * camera.scale}px`, '--grid-dot-radius': `${camera.scale}px`, '--grid-position-x': `${camera.x}px`, '--grid-position-y': `${camera.y}px` }} ref={boardRef} tabIndex={-1} onPointerDown={startDrawing} onPointerMove={moveDrawing} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} onPointerLeave={hideCursor}>
          <div className="stage-label"><span>AGORA / {String(canvasId).padStart(2, '0')}</span><b>{canvas?.canvas_name || '공유 캔버스'}</b></div>
          <div className="coordinate-plane" style={coordinatePlaneStyle} aria-hidden="true"><span className="coordinate-x" /><span className="coordinate-y" /><i className="coordinate-origin">0</i><b className="coordinate-x-label">X</b><b className="coordinate-y-label">Y</b></div>
          <VectorLayer items={visibleVectorItems} referenceItems={items} previewStrokes={remoteDrawingStrokes} camera={camera} onReady={(setDraft) => { vectorDraftRef.current = setDraft; }} />
          <div className="canvas-scene" ref={sceneRef} style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})` }}>
            {sortedItems.map(([id, item, bounds, connectorCurve]) => <CanvasObject key={id} id={id} item={item} bounds={bounds} connectorCurve={connectorCurve} viewSize={boardSize} token={token} selected={selectedObjectIdSet.has(String(id))} allowSingleSelectionControls={hasSingleSelection} activeTool={activeTool} connectionStartId={connectionStartId} editing={editingId === id} dirty={dirtyItems.has(String(id))} remoteEditors={Object.values(remoteEditors).filter((editor) => editor.itemId === String(id))} onStartEditing={startEditing} onTextChange={updateCollaborativeText} onMetadataChange={updateCollaborativeMetadata} onFormulaChange={updateFormulaItem} onTableChange={updateTableItem} onStopEditing={stopEditing} onSave={saveCollaborativeItem} onPointerDown={startObjectDrag} onResizeStart={startObjectResize} onArrowBendStart={startArrowBend} onPointerMove={moveObject} onPointerUp={stopObjectDrag} onCopy={(value) => navigator.clipboard?.writeText(value)} onConnectorDoubleClick={focusConnectorTarget} />)}
            {selectedItem && selectedItem.kind !== 'connector' && activeTool === 'select' && !editingId && <RotationHandles sceneRef={sceneRef} id={String(primarySelectedItemId)} item={selectedItem} viewSize={boardSize} onPointerDown={startObjectRotation} onPointerMove={moveObject} onPointerUp={stopObjectDrag} />}
            <RemoteCursorLayer updaterRef={remoteCursorUpdaterRef} activePeerIds={activePeerIds} visibleBounds={visibleBounds} />
          </div>
          <LaserLayer strokes={laserStrokes} width={boardSize.width} height={boardSize.height} camera={camera} />
          {selectionBox && <div className="canvas-selection-marquee" style={{ left: selectionBox.left, top: selectionBox.top, width: selectionBox.width, height: selectionBox.height }} aria-hidden="true" />}
          <div className="canvas-minimap" ref={minimapWidgetRef} style={minimapPosition ? { left: `${minimapPosition.left}px`, top: `${minimapPosition.top}px`, right: 'auto', bottom: 'auto' } : undefined} role="group" aria-label="캔버스 미니맵">
            <div className="canvas-minimap-heading" onPointerDown={startMinimapWidgetMove} onPointerMove={moveMinimapWidget} onPointerUp={stopMinimapWidgetMove} onPointerCancel={stopMinimapWidgetMove} onLostPointerCapture={stopMinimapWidgetMove}><strong>미니맵</strong><span>잡고 이동</span></div>
            <div className="canvas-minimap-map" title="클릭해 해당 위치로 이동 · 안쪽을 드래그해도 캔버스는 움직이지 않습니다" onPointerDown={startMinimapPan} onPointerMove={moveMinimapPan} onPointerUp={stopMinimapPan} onPointerCancel={stopMinimapPan} onLostPointerCapture={stopMinimapPan}>
              <svg className="canvas-minimap-svg" viewBox={`${minimap.bounds.minX} ${minimap.bounds.minY} ${minimap.bounds.width} ${minimap.bounds.height}`} preserveAspectRatio="none" aria-label="전체 오브젝트와 현재 화면 위치">
                <line className="canvas-minimap-axis" x1={boardSize.width / 2} y1={minimap.bounds.minY} x2={boardSize.width / 2} y2={minimap.bounds.maxY} />
                <line className="canvas-minimap-axis" x1={minimap.bounds.minX} y1={boardSize.height / 2} x2={minimap.bounds.maxX} y2={boardSize.height / 2} />
                {minimap.items.map(({ id, item, bounds }) => {
                  const itemWidth = Math.max(bounds.maxX - bounds.minX, minimap.bounds.width * 0.008);
                  const itemHeight = Math.max(bounds.maxY - bounds.minY, minimap.bounds.height * 0.008);
                  return <rect key={id} className={`canvas-minimap-item${selectedObjectIdSet.has(String(id)) ? ' selected' : ''}`} x={(bounds.minX + bounds.maxX - itemWidth) / 2} y={(bounds.minY + bounds.maxY - itemHeight) / 2} width={itemWidth} height={itemHeight} rx={Math.min(itemWidth, itemHeight) * 0.22} style={{ fill: item.color || minimapItemColors[item.kind] }} />;
                })}
                <rect className="canvas-minimap-viewport" x={minimap.viewport.minX} y={minimap.viewport.minY} width={minimap.viewport.maxX - minimap.viewport.minX} height={minimap.viewport.maxY - minimap.viewport.minY} rx="2" />
              </svg>
            </div>
          </div>
          {activeTool === 'eraser' && <div className="eraser-cursor" ref={eraserCursorRef} style={{ width: `${ERASER_RADIUS * 2}px`, height: `${ERASER_RADIUS * 2}px` }} aria-hidden="true" />}
          {sharePosition && <ShareComposer onCancel={() => { setSharePosition(null); setActiveTool('select'); }} onSubmit={placeSharedLink} />}
          {activeTool === 'laser' && <div className="draw-cursor-label laser-cursor-label"><Icon name="laser" size={13} /> 가리키는 중 · 1.6초 후 사라짐</div>}{activeTool === 'pen' && <div className="draw-cursor-label"><Icon name="pen" size={13} /> 그리는 중</div>}{activeTool === 'eraser' && <div className="draw-cursor-label"><Icon name="eraser" size={13} /> 드로잉을 드래그해 지우기</div>}{activeTool === 'connect' && <div className="draw-cursor-label"><Icon name="connect" size={13} /> {connectionStartId ? '도착 오브젝트 선택' : '시작 오브젝트 선택'}</div>}{activeTool === 'link' && !sharePosition && <div className="draw-cursor-label"><Icon name="link" size={13} /> 공유 자료를 놓을 위치 선택</div>}
        </div><div className="board-footer"><span>무한 좌표 평면 · X/Y축</span><span className="board-footer-center">빈 공간 드래그 선택 · 객체 드래그 또는 십자 버튼으로 이동 · Space+드래그 화면 이동</span><span>{visibleItemIds.size}/{Object.keys(items).length}개 표시</span></div>
      </main>
<CanvasInspectorPanel {...{
        activeTool,
        canvasId,
        canvasParticipants,
        changeSelectionGroup,
        changeStrokeWidth,
        changeTableCount,
        changeTableSize,
        changeTheme,
        changeZoomSensitivity,
        color,
        connection,
        connectorColor,
        connectorEndHead,
        connectorStartHead,
        connectorToEdit,
        connectorWidth,
        items,
        noteColor,
        primarySelectedItemId,
        selectItems,
        selectedArrow,
        selectedConnector,
        selectedItem,
        selectedObjectIds,
        selectedTable,
        selectionIsSingleGroup,
        setColor,
        setConnectorColor,
        setConnectorWidth,
        setNoteColor,
        setShapeType,
        setShowSettings,
        settings,
        shapeArrowEndHead,
        shapeArrowStartHead,
        shapeType,
        showGrid,
        strokeWidth,
        tableConfig,
        theme,
        toggleGrid,
        updateArrowHead,
        updateConnectorAppearance,
        updateItemRotation,
        updateNewConnectorHead,
        updateNewShapeArrowHead,
        updateShapeArrowBend,
        zoomSensitivity
      }} />
<CanvasChatPanel {...{ chatHistoryLoading, connection, hasOlderMessages, loadOlderMessages, message, messages, setMessage, submitMessage }} />
    </div>}
    {toast && <div className="toast-message" role="status"><Icon name="check" size={16} />{toast}</div>}
    {showSettings && <SettingsDialog settings={settings} pending={settingsPending} onClose={() => setShowSettings(false)} onUpdate={sendSettings} onAddParticipant={(nickname, tag) => sendSettings('participant_add', null, { nickname, tag_number: tag })} onRemoveParticipant={(person) => sendSettings('participant_remove', null, { nickname: person.nickname, tag_number: person.tag_number })} />}
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
  if (!ready) return <div className="canvas-app-page canvas-loading-state"><span className="loader" /> 공동 편집 엔진을 불러오는 중이에요.</div>;
  return <CanvasWorkspace key={canvasId} />;
}
