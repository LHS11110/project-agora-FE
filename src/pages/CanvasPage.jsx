import {LiveContentContext,createLiveContentRegistry} from '../canvas/content/LiveContentContext.js';
import ItemSubset from '../canvas/ItemSubset.js';
import useCanvasWatch from '../canvas/useCanvasWatch.js';
import CanvasWatchOverlay from '../components/canvas/CanvasWatchOverlay.jsx';
import { createWebAssetStore } from '../canvas/content/webAssetStore.js';
import { WebAssetsContext } from '../canvas/content/WebAssetsContext.js';
import { isChessShape } from '../canvas/chessShapes.js';
import usePersonalAnchors from '../canvas/usePersonalAnchors.js';
import ScreenShareViewer from '../canvas/voice/ScreenShareViewer.jsx';
import { newFrame, validFrame, validFrameField, createFrameStore, animationGroups, isColorDark } from '../canvas/portfolio/frameModel.js';
import { groupMember } from '../canvas/userGroups/userGroupModel.js';
import { AnimationContext, createAnimationStore } from '../canvas/portfolio/animationStore.js';
import { PORTFOLIO_ID, newPortfolio, defaultAnimation, hasAnimation, validAnimation } from '../canvas/portfolio/portfolioModel.js';
import PortfolioViewer from '../canvas/portfolio/PortfolioViewer.jsx';
import { PresentationContext } from '../canvas/portfolio/presentationContext.js';
import { useMediaUpload } from '../canvas/media/useMediaUpload.js';
import { canvasImageFile, mediaFileType } from '../canvas/media/mediaModel.js';
import { ProjectContext, createProjectStore } from '../canvas/projects/projectStore.js';
import { validProject, validateProjectLinks, newIssue, removeProject } from '../canvas/projects/projectModel.js';
import { useCanvasPasswordPrompt } from '../canvas/useCanvasPasswordPrompt.js';
import CanvasPasswordDialog from '../components/canvas/CanvasPasswordDialog.jsx';
import { useCanvasVoiceCall } from '../canvas/voice/CanvasVoicePanel.jsx';
import { objectContentCacheStats } from '../canvas/objectContentCache.js';
import '../canvas/graphics-quality.css';
import { runtimeStateTtl } from '../canvas/runtime/useObjectRuntimeState.js';
import { notebookCellItem, notebookCellObjectId, NOTEBOOK_LIMIT, validNotebookCells } from '../canvas/notebook/notebookData.js';
import { api } from '../api/client.js';
import { fetchNotebookFile, uploadNotebookFile } from '../canvas/notebook/notebookFile.js';
import { canvasPasswordGrantKey, readCanvasPasswordGrant } from '../canvas/canvasAccess.js';
import { activeGridInterval, BASE_GRID_INTERVAL, gridInterval, snapNewItem } from '../canvas/gridPlacement.js';
import { creationGroupPermission, deriveUserCapabilitiesFromSettings, normalizeObjectGroups } from '../canvas/permissions/creationGroups.js';
import { canUseItem, canUseCanvas, WRITE_DENIED, EXECUTE_DENIED } from '../canvas/permissions/access.js';
import { isObjectLocked, OBJECT_LOCK_MESSAGE } from '../canvas/locks/objectLock.js';
import { planBatchDeletion } from '../canvas/deleteObjects.js';
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
import { supportsAnyCorners, supportsObjectCorners, validObjectCornerStyle } from '../canvas/objectCorners.js';
import { validShapeAppearance } from '../canvas/shapeAppearance.js';
import { isVolumeShape } from '../canvas/volumeGeometry.js';
import { numericObjectPatch } from '../canvas/objectNumericGeometry.js';
import SceneViewModel from '../canvas/SceneViewModel.js';
import { itemCount, changeItems } from '../canvas/itemSnapshots.js';
import { overviewScale } from '../canvas/sceneRepresentation.js';
import { useCanvasCamera } from '../canvas/useCanvasCamera.js';
import { isRasterContent as isRasterText } from '../canvas/plainTextRaster.js';
import { buildDepthLayers, itemDepth } from '../canvas/itemDepth.js';
import { hitTestFrameBorder, hitTestVector, needsVectorDom } from '../canvas/vectorHitTest.js';
import { buildDepthRenderGroups } from '../canvas/depthRenderGroups.js';
import { renderWindow, containsViewport } from '../canvas/renderWindow.js';
import { handleObjectDoubleClick } from '../canvas/objectDoubleClick.js';
import StableSpatialQuery from '../canvas/StableSpatialQuery.js';
import { useSheetUpload } from '../canvas/sheets/useSheetUpload.js';
import { useCanvasFileUploads } from '../canvas/useCanvasFileUploads.js';
import { usePdfUpload } from '../canvas/pdf/usePdfUpload.js';
import { useCanvasBackground } from '../canvas/background/useCanvasBackground.js';
import { useParticipantProfiles } from '../canvas/useParticipantProfiles.js';
import ResizablePanel from '../canvas/panels/ResizablePanel.jsx';
import { usePanelLayout } from '../canvas/panels/usePanelLayout.js';
import { openTerminalSocket } from '../canvas/runtime/terminalApi.js';
import { useObjectClipboard } from '../canvas/clipboard/useObjectClipboard.js';
import { MAX_BEND_POINTS, connectorBendPatch, resizeConnectorControls } from '../canvas/connectors/controlPoints.js';
import { isContentMode, isTextContent } from '../canvas/content/contentPresentation.js';
import { applyTextColor, colorRangesFromDoc, TEXT_COLOR_MARK } from '../canvas/content/textColors.js';
import { isCodeLanguage } from '../canvas/codeLanguages.js';
import { useContentSettings } from '../canvas/content/useContentSettings.js';
import { CONNECTOR_METRICS_EVENT } from '../canvas/connectors/objectMetrics.js';
import CanvasVersionDialog from '../canvas/github/CanvasVersionDialog.jsx';
import CanvasAsCodeDialog from '../canvas/asCode/CanvasAsCodeDialog.jsx';
import { createBlueprintStore } from '../canvas/runtime/blueprintStore.js';
import { createMultiAgentStore } from '../canvas/agents/multiAgentStore.js';
import MultiAgentActivity from '../canvas/agents/MultiAgentActivity.jsx';
import { buildMultiAgentTemplate, isAgentCanvasObject, isAgentOrchestratorItem } from '../canvas/agents/agentCanvasModel.js';
import { purgeAgentKeys } from '../components/agentCredentials.js';
import { requireAgentConsent, reviewAgentPrompt } from '../components/agentConsent.js';
import Timer, {initialTimer} from '../canvas/CanvasTimer.jsx';
import CanvasAgentLauncher from '../components/CanvasAgentLauncher.jsx';
import CanvasAgentPanel from '../components/CanvasAgentPanel.jsx';
import RuntimeSettingsDialog from '../canvas/runtime/RuntimeSettingsDialog.jsx';
import { executeCanvasCode, rejectRuntimeSocketRequests, settleRuntimeSocketResponse } from '../canvas/runtime/executeCanvasCode.js';
import useCodeExecutionShortcut from '../canvas/runtime/useCodeExecutionShortcut.js';
import { useCommentsAndMentions } from '../canvas/comments/useCommentsAndMentions.js';
import ObjectCommentsPanel from '../canvas/comments/ObjectCommentsPanel.jsx';
import MentionNotifications from '../canvas/comments/MentionNotifications.jsx';
import { uniqueCanvasParticipants } from '../canvas/canvasParticipants.js';
import { useCanvasAsCode } from '../canvas/asCode/useCanvasAsCode.js';
import { isInternalEditorPointer } from '../canvas/editorInteraction.js';
import { usePenStyle } from '../canvas/usePenStyle.js';
import { isObjectFontSize, supportsObjectFontSize } from '../canvas/objectSize.js';
import { useEraserSize } from '../canvas/useEraserSize.js';
import { useCanvasPalette } from '../canvas/useCanvasPalette.js';
import { useCanvasTouchNavigation } from '../canvas/useCanvasTouchNavigation.js';
import { stagePointerHandlers } from '../canvas/stagePointerHandlers.js';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as Automerge from '@automerge/automerge/slim';
import automergeWasmUrl from '@automerge/automerge/automerge.wasm?url';
import { Link, useNavigate, useParams } from '../routing.jsx';
import Icon from '../components/Icon.jsx';
import InteractiveAtmosphere from '../components/frelog/InteractiveAtmosphere.jsx';
import { PreloadImageSelector } from '../canvas/viewportPreload.js';
import { prefetchAuthenticatedImages } from '../components/authenticatedImageCache.js';
import ShareComposer from '../components/ShareComposer.jsx';
const CanvasLayerObjects = lazy(() => import('../canvas/CanvasLayerObjects.jsx'));
import VectorLayer from '../canvas/DepthVectorLayer.jsx';
import { SocketSendBudget } from '../canvas/socketSendBudget.js';
import LaserLayer from '../components/LaserLayer.jsx';
import { LASER_COLOR } from '../canvas/canvasConstants.js';
import RotationHandles from '../components/CanvasRotationHandles.jsx';
import GroupRotationHandles from '../components/GroupRotationHandles.jsx';
import { useGroupShortcuts } from '../canvas/useGroupShortcuts.js';
import CanvasSpatialBTree, { objectBounds } from '../components/CanvasSpatialBTree.js';
import CanvasToolPanel from '../canvas/CanvasToolPanel.jsx';
import RemoteCursorLayer from '../components/canvas/RemoteCursorLayer.jsx';
import SettingsDialog from '../components/canvas/CanvasSettingsDialog.jsx';
import CanvasParticipantsDialog from '../components/canvas/CanvasParticipantsDialog.jsx';
const CanvasInspectorPanel = lazy(() => import('../components/canvas/CanvasInspectorPanel.jsx'));
import CanvasChatPanel from '../components/canvas/CanvasChatPanel.jsx';
import CanvasLoadingStatus from '../components/canvas/CanvasLoadingStatus.jsx';
import { CHAT_HISTORY_LIMIT } from '../canvas/canvasChat.js';
import {
  CATEGORY_LIMIT,
  CHANNEL_KIND,
  CHANNEL_LIMIT,
  DEFAULT_TEXT_CHANNEL,
  chatTarget,
  isCategoryItem,
  isChannelItem,
  listCategories,
  listChannels,
  moveChannelPatch,
  newCategory,
  newCategoryId,
  newChannel,
  newChannelId,
  nextChannelOrder,
  reorderCategoryPatch,
} from '../canvas/channels/channelModel.js';
import { validateChatMediaFile } from '../canvas/chat/chatMedia.js';
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
import { formatCanvasZoom, CANVAS_SPACE, fitCanvasCamera, MIN_CANVAS_SCALE, MAX_CANVAS_SCALE } from '../canvas/canvasSpace.js';
import { useCanvasViewport } from '../canvas/useCanvasViewport.js';
import { useCanvasServerChangeQueue } from '../canvas/useCanvasServerChangeQueue.js';
import { connectorGeometry } from '../components/connectorGeometry.js';
import FloatingContextToolbar from '../components/canvas/FloatingContextToolbar.jsx';
import ConnectorCreationPreview from '../components/canvas/ConnectorCreationPreview.jsx';
import { hasAdvancedStyle, isHideableObject, readObjectStyle, readObjectVisibility, writeObjectVisibilityPatch } from '../canvas/styling/objectStyleModel.js';
import { BlurBudgetContext } from '../canvas/styling/BlurBudgetContext.js';
import {
  VisibilityContext,
  ensureRevealAnimationConfig,
  isObjectInvisibleAtTime,
  nextRevealBoundaryDelay,
  shouldOmitFromScene,
  shouldUseVisibilityDom,
} from '../canvas/portfolio/animationReveal.js';
import { extractStyleBundle, applyStyleBundlePatch, saveCopiedStyle, loadCopiedStyle } from '../canvas/styling/styleClipboard.js';
import { computeAutoLayoutPatches } from '../canvas/styling/autoLayout.js';
import { DEFAULT_ARROW_END_HEAD, DEFAULT_ARROW_START_HEAD, normalizeArrowHead } from '../components/arrowheadGeometry.js';
import { DEFAULT_SHAPE_ARROW_BEND, shapeArrowGeometry, resizeShapeArrowControls, shapeArrowBendPatch } from '../components/shapeArrowGeometry.js';
import { normalizeTableCount, resizeTableData, MAX_TABLE_COLUMNS, MAX_TABLE_ROWS } from '../components/tableModel.js';
import { initialVideoFields } from '../canvas/media/mediaModel.js';
import { installSoundUnlock, playSoundCue } from '../canvas/audio/soundEffects.js';
import { useAuth } from '../state/AuthContext.jsx';

import '../canvas/canvas-studio.css';
import '../canvas/panels/tablet-layout.css';

const ZOOM_SENSITIVITY_KEY = 'agora_canvas_zoom_sensitivity';
const STROKE_WIDTH_KEY = 'agora_canvas_stroke_width';
const EMPTY_ID_SET = new Set();
const DEPARTED_ENTRY_MS = 2000, MAX_DEPARTED_ENTRIES = 96;
const VECTOR_KINDS = new Set(['shape', 'connector', 'stroke', 'text']);
const isDomRenderedKind = item => Boolean(item.runtimeRole) || !VECTOR_KINDS.has(item.kind);
const EMPTY_STYLE_OBJ = {};
const automergeReady = Automerge.initializeWasm(automergeWasmUrl);

function CanvasWorkspace() {
  useUiLocale();
  const [showCanvasCode, setShowCanvasCode] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const versionsOpened = useRef(false); if (showVersions) versionsOpened.current = true;
  const [canvasCodeSource, setCanvasCodeSource] = useState(null);
  const [showRuntimeSettings, setShowRuntimeSettings] = useState(false);
  const [showMonitoring, setShowMonitoring] = useState(false);
  const [showAgent, setShowAgent] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [multiAgentBusy, setMultiAgentBusy] = useState(false);
  const { canvasId } = useParams();
  const [personalTimer, setPersonalTimer] = useState(initialTimer);
  const liveContent=useMemo(()=>createLiveContentRegistry(),[canvasId]);
  const liveContentIds=useSyncExternalStore(liveContent.subscribe,liveContent.getSnapshot,liveContent.getSnapshot);
  const { token, user } = useAuth();
  const agentTokenRef = useRef(token);
  agentTokenRef.current = token;
  const agentUserRef = useRef(null);
  agentUserRef.current = user?.user_id ?? null;
  const [portfolioViewing, setPortfolioViewing] = useState(false), [portfolioIndex, setPortfolioIndex] = useState(0), [portfolioSettings, setPortfolioSettings] = useState(false), [portfolioLocked, setPortfolioLocked] = useState(false);
  const frameStore = useMemo(() => createFrameStore(), []), framePages = useSyncExternalStore(frameStore.subscribe, frameStore.getSnapshot, frameStore.getSnapshot);
  const currentFrameRef = useRef(null), presentationPendingRef = useRef(null), presentationBusy = useRef(0), seenCursor = useRef(''), [presentationSending, setPresentationSending] = useState(false);
  const portfolioCamera = useRef(null), autoPortfolioOpened = useRef(false), portfolioViewingRef = useRef(false); portfolioViewingRef.current = portfolioViewing;
  const [watchState, setWatchState] = useState({ users: [], self_id: null, watching_id: null }); const watchingRef = useRef(false); watchingRef.current = Boolean(watchState.watching_id);
  const [capabilities, setCapabilities] = useState(null);
  const projectStore = useMemo(() => createProjectStore(), []);
  useEffect(() => { projectStore.refresh(); }, [capabilities, projectStore]);
  const accessRef = useRef(null); accessRef.current = capabilities;
  const canWriteItem = useCallback(item => !watchingRef.current && !portfolioViewingRef.current && canUseItem(item, accessRef.current, 'write'), []);
  const canExecuteItem = useCallback(item => !watchingRef.current && canUseItem(item, accessRef.current, 'execute'), []);
  const canWriteCanvas = !watchState.watching_id && !portfolioViewing && canUseCanvas(capabilities, 'write');
  const runtimeSocketRequestsRef = useRef(new Map());
  const runtimeRequestRef = useRef(null);
  runtimeRequestRef.current = (request, onOutput) => {
    if (watchingRef.current || !canUseCanvas(accessRef.current, 'execute') || (request.action === 'reset' && !canUseCanvas(accessRef.current, 'write'))) return Promise.reject(new Error(EXECUTE_DENIED));
    return executeCanvasCode({ ...request, canvasId, token, user, sendRaw, pendingRequests: runtimeSocketRequestsRef.current }, onOutput);
  };
  const saveBlueprintValueRef=useRef(()=>false);
  const saveBlueprintOutputRef = useRef(() => false);
  const saveRuntimeStateRef = useRef(() => false);
  const saveAgentItemRef = useRef(() => false);
  const saveAgentTextOutputRef = useRef(() => false);
  const getAgentAnchorRef = useRef(() => ({ x: 0, y: 0 }));
  const runtimeStore = useMemo(() => createBlueprintStore({
    getItems: () => itemsRef.current,
    execute: ({ onOutput, ...request }) => runtimeRequestRef.current(request, onOutput), saveOutput: (id, records) => saveBlueprintOutputRef.current(id, records), saveState: (id, state) => saveRuntimeStateRef.current(id, state),saveValue:(id,patch)=>saveBlueprintValueRef.current(id,patch)
  }), []);
  useEffect(purgeAgentKeys, []);
  const multiAgentStore = useMemo(() => createMultiAgentStore({
    getItems: () => itemsRef.current,
    hasAgentAccess: () => agentUserRef.current != null && canUseCanvas(accessRef.current, 'read'),
    executeAgent: async ({ operation, ...agent }, onOutput, signal) => {
      if (!multiAgentStore.hasAgentAccess()) {
        throw Object.assign(new Error(ui('캔버스에 연결해야 AI 에이전트를 사용할 수 있습니다.')), { code: 'AGENT_SCOPE_DENIED' });
      }
      const consentVersion = await requireAgentConsent(agentTokenRef.current, operation);
      if (operation === 'run') {
        const approved = await reviewAgentPrompt(agent.message, signal);
        if (!approved || signal?.aborted) {
          throw Object.assign(new Error(ui('AI 요청 전송을 취소했습니다.')), { code: 'AGENT_ABORTED' });
        }
        if (!multiAgentStore.hasAgentAccess()) throw new Error('AGENT_SCOPE_DENIED');
      }
      return runtimeRequestRef.current({ action: 'agent', operation, agent: { ...agent, consent_version: consentVersion } }, onOutput);
    },
    getAnchor: id => getAgentAnchorRef.current(id),
    saveOutput: (id, records) => saveBlueprintOutputRef.current(id, records),
    saveValue: (id, patch) => saveBlueprintValueRef.current(id, patch),
    saveState: (id, state) => saveRuntimeStateRef.current(id, state),
    saveAgentItem: (id, patch) => saveAgentItemRef.current(id, patch),
    saveTextOutput: (id, text) => saveAgentTextOutputRef.current(id, text),
    onBusyChange: setMultiAgentBusy,
  }), []);
  useEffect(() => { runtimeStore.resume(); multiAgentStore.resume(); return () => { runtimeStore.dispose(); multiAgentStore.dispose(); }; }, [runtimeStore, multiAgentStore]);
  const navigate = useNavigate();
  const boardRef = useRef(null);
  const cancelCameraMotionRef = useRef(() => { });
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
  const notebookMigrationRef = useRef(new Set());
  const webAssetStore = useMemo(() => createWebAssetStore(), []);
  const animationStore = useMemo(() => createAnimationStore(() => itemsRef.current), []);
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
  const selectedIdsRef = useRef([]);
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
  const vectorDragUpdatersRef = useRef(new Set());
  const vectorDragCallbacksRef = useRef(new Map());
  const vectorDragRef = useRef((preview) => {
    for (const fn of vectorDragUpdatersRef.current) fn(preview);
  });
  const getVectorDragCallback = useCallback((depth) => {
    let cb = vectorDragCallbacksRef.current.get(depth);
    if (!cb) {
      let current = null;
      cb = (fn) => {
        if (current) vectorDragUpdatersRef.current.delete(current);
        current = typeof fn === 'function' ? fn : null;
        if (current) vectorDragUpdatersRef.current.add(current);
      };
      vectorDragCallbacksRef.current.set(depth, cb);
    }
    return cb;
  }, []);
  const chrome = useCanvasChrome();
  const [canvas, setCanvas] = useState(null);
  const [spatialRevision, setSpatialRevision] = useState(0);
  const [groups, setGroups] = useState([]);
  const [peerList, setPeerList] = useState([]);
  const [remoteEditors, setRemoteEditors] = useState({});
  const [remoteDrawingStrokes, setRemoteDrawingStrokes] = useState([]);
  const laserUpdaterRef = useRef(null);
  const setLaserStrokes = useCallback((update) => { laserUpdaterRef.current?.(update); }, []);
  const [dirtyItems, setDirtyItems] = useState(() => new Set());
  const [copiedStyle, setCopiedStyle] = useState(() => loadCopiedStyle());
  const [camera, applyCanvasCamera] = useCanvasCamera(boardRef, sceneRef);
  const setCamera = useCallback(update => { if (!watchingRef.current) applyCanvasCamera(update); }, [applyCanvasCamera]);
  const boardSize = CANVAS_SPACE;
  const [zoomSensitivity, setZoomSensitivity] = useState(() => {
    const stored = Number(localStorage.getItem(ZOOM_SENSITIVITY_KEY));
    return Number.isFinite(stored) && stored >= MIN_ZOOM_SENSITIVITY && stored <= MAX_ZOOM_SENSITIVITY ? stored : 1;
  });
  const [settings, setSettings] = useState(null);
  const [connection, setConnection] = useState('connecting');
  const agentEligible = user?.user_id != null && canUseCanvas(capabilities, 'read');
  const agentAccess = connection === 'connected' && agentEligible;
  const [reconnectEpoch, setReconnectEpoch] = useState(0);
  const [error, setError] = useState('');
  const { eraserWidth, changeEraserWidth, eraserMode, changeEraserMode } = useEraserSize();
  const [activeTool, setActiveTool] = useState('select');
  const [sharePosition, setSharePosition] = useState(null);
  const [userGroupTemplate, setUserGroupTemplate] = useState(null);
  const userGroupTemplateRef = useRef(null);
  userGroupTemplateRef.current = userGroupTemplate;
  const { color, setColor, favoriteColors, saveFavoriteColor } = useCanvasPalette();
  const [laserColor, setLaserColorState] = useState(() => { try { const v = localStorage.getItem('agora_laser_color'); return /^#[0-9a-f]{6}$/i.test(v || '') ? v : LASER_COLOR; } catch { return LASER_COLOR; } });
  const setLaserColor = useCallback((value) => { if (!/^#[0-9a-f]{6}$/i.test(value || '')) return; setLaserColorState(value); try { localStorage.setItem('agora_laser_color', value); } catch { /* storage disabled */ } }, []);
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
  const [showGrid, setShowGrid] = useState(() => localStorage.getItem('agora_canvas_grid') !== 'false');
  const [gridSpacing, setGridSpacing] = useState(() => ({ x: gridInterval(localStorage.getItem('agora_canvas_grid_spacing_x') ?? localStorage.getItem('agora_canvas_grid_spacing') ?? BASE_GRID_INTERVAL), y: gridInterval(localStorage.getItem('agora_canvas_grid_spacing_y') ?? localStorage.getItem('agora_canvas_grid_spacing') ?? BASE_GRID_INTERVAL) }));
  const [snapToGrid, setSnapToGrid] = useState(() => localStorage.getItem('agora_canvas_snap_grid') === 'true');
  const changeGridSpacing = (value, axis = 'x') => { const next = gridInterval(value); setGridSpacing(current => { const updated = { ...current, [axis]: next }; for (const key of ['x', 'y']) localStorage.setItem('agora_canvas_grid_spacing_' + key, String(updated[key])); localStorage.setItem('agora_canvas_grid_spacing', String(updated.x)); return updated; }); };
  const toggleSnapToGrid = () => setSnapToGrid(current => { localStorage.setItem('agora_canvas_snap_grid', String(!current)); return !current; });
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
    if (!shapeFillWasSet) { if (isChessShape(type)) setShapeFillColor('#fffdf7'); else if (isVolumeShape(type)) setShapeFillColor('#b8a9e8'); else setShapeFillColor(''); }
    setShapeVertexCount(({ triangle: 3, pentagon: 5, hexagon: 6, star: 5 })[type] || 6);
  };
  const [shapeVisualStyle, setShapeVisualStyle] = useState('standard');
  const [shapeStrokeEnabled, setShapeStrokeEnabled] = useState(true);
  const [shapeBorderWidth, setShapeBorderWidth] = useState(2.5);
  const [connectorVisualStyle, setConnectorVisualStyle] = useState('standard');
  const [connectionStartId, setConnectionStartId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [personalAnchors, setPersonalAnchors] = usePersonalAnchors(canvasId, user);
  const selectionBoxRef = useRef(null);
  const creationBoxRef = useRef(null);
  const setSelectionBox = useCallback((box) => {
    const node = selectionBoxRef.current;
    if (!node) return;
    if (!box) {
      if (node.style.display !== 'none') node.style.display = 'none';
      return;
    }
    if (node.style.display !== '') node.style.display = '';
    node.style.transform = `translate3d(${box.left}px,${box.top}px,0)`;
    node.style.width = `${box.width}px`;
    node.style.height = `${box.height}px`;
  }, []);
  const setCreationBox = useCallback((box) => {
    const node = creationBoxRef.current;
    if (!node) return;
    if (!box) {
      if (node.style.display !== 'none') node.style.display = 'none';
      return;
    }
    if (node.style.display !== '') node.style.display = '';
    node.style.transform = `translate3d(${box.left}px,${box.top}px,0)`;
    node.style.width = `${box.width}px`;
    node.style.height = `${box.height}px`;
    const labelNode = node.firstElementChild;
    if (labelNode && labelNode.textContent !== box.label) labelNode.textContent = box.label;
  }, []);
  const [editingId, setEditingId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatMessageTotal, setChatMessageTotal] = useState(0);
  const [chatHighlight, setChatHighlight] = useState(null);
  const [chatJumpNote, setChatJumpNote] = useState(null);
  const requestedChatMention = useRef(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [message, setMessage] = useState('');
  // Text channel shown in the chat list; other channels only collect unread counts.
  const [activeChatChannel, setActiveChatChannel] = useState(DEFAULT_TEXT_CHANNEL);
  const activeChatChannelRef = useRef(DEFAULT_TEXT_CHANNEL);
  const [chatUnread, setChatUnread] = useState({});
  const chatChannelRef = useRef(null);
  chatChannelRef.current = {
    activeId: activeChatChannelRef.current,
    isChannel: id => { const item = itemsRef.current[id]; return isChannelItem(item) && item.channelType === 'text'; },
    onUnread: id => setChatUnread(current => ({ ...current, [id]: (current[id] || 0) + 1 })),
  };
  const [showSettings, setShowSettings] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [settingsPending, setSettingsPending] = useState(false);
  const [previewHiddenObjects, setPreviewHiddenObjects] = useState(false);
  const [revealTick, setRevealTick] = useState(0);
  const settingsRequestsRef = useRef(new Map());
  const settingsQueueRef = useRef(Promise.resolve());
  const canvasSettingsRef = useRef(null); canvasSettingsRef.current = settings;
  useEffect(() => () => { for (const request of settingsRequestsRef.current.values()) { clearTimeout(request.timer); request.reject(new Error('캔버스 연결이 종료되었습니다.')); } settingsRequestsRef.current.clear(); }, []);
  const [toast, setToast] = useState('');
  const { beginUpload: trackUpload, uploads: fileUploads } = useCanvasFileUploads(canvasId);
  const beginUpload = name => {
    setToast('');
    return trackUpload(name);
  };
  const { beginObjectMove, previewObjectMove, finishObjectMove, undo, undoCount, items, setItems, patchItems, moveItems, flushMoves, committedItemsRef, status: hostStatus, sessionRef: hostSessionRef, receiveServerItems, receiveServerEvent } = useServerCanvas({
    accessRef, itemsRef, peerMeshRef, wsRef, rtcWsRef, collaborativeDocsRef, collaborativeBaseDocsRef, setToast, setDirtyItems, reconnectRequestRef, onItemsPublished: (draft, ids) => { webAssetStore.update(draft, ids); projectStore.update(draft, ids); frameStore.update(draft, ids); }, onCommittedItems: (committed, ids) => animationStore.update(committed, ids),
  });
  projectStore.actions = {
    admin: () => accessRef.current?.is_admin === true,
    canWrite: id => { const item = itemsRef.current[id]; return Boolean(hostSessionRef.current?.editable && item && !item.locked && canWriteItem(item)); },
    people: () => [...new Set([`${user?.nickname}#${user?.tag_number}`, ...(settings?.participants || []).map(p => `${p.nickname}#${p.tag_number}`)])],
    patch: (id, patch) => { const item = itemsRef.current[id]; if (!item || !projectStore.actions.canWrite(id)) return false; const next = { ...item, ...patch }; if (!validProject(next)) throw Error('작업의 입력값 또는 일정을 확인해주세요.'); validateProjectLinks({ ...itemsRef.current, [id]: next }, id); return patchItems({ [id]: next }); },
    batch: changes => { for (const [id, item] of Object.entries(changes)) { if (!projectStore.actions.canWrite(id) || !validProject(item)) throw Error('작업의 입력값 또는 권한을 확인해주세요.'); } const next = { ...itemsRef.current, ...changes }; for (const id of Object.keys(changes)) validateProjectLinks(next, id); return patchItems(changes); },
    remove: id => { const records = projectStore.getSnapshot().records; if (records[id]?.projectType === 'board' && !projectStore.actions.admin()) return false; const plan = removeProject(records, id); for (const key of [...plan.removed, ...Object.keys(plan.changes)]) if (!projectStore.actions.canWrite(key)) throw Error('연결된 작업의 쓰기 권한과 잠금 상태를 확인해주세요.'); const removed = new Set(plan.removed); for (const [key, item] of Object.entries(itemsRef.current)) if (item.kind === 'connector' && (removed.has(String(item.from)) || removed.has(String(item.to)))) { if (item.locked || !canWriteItem(item)) throw Error('연결된 작업의 쓰기 권한과 잠금 상태를 확인해주세요.'); plan.removed.push(key); } return patchItems(plan.changes, plan.removed); },
    create: (boardId, definition) => { const board = itemsRef.current[boardId]; if (!projectStore.actions.canWrite(boardId)) return false; const existing = Object.values(projectStore.getSnapshot().records).filter(i => i.projectBoard === boardId), count = existing.length, id = createId(); const item = { ...newIssue(boardId, (count + 1) * 1024), ...definition, kind: 'project', projectType: 'issue', projectBoard: boardId, projectRank: Math.max(0, ...existing.map(i => i.projectRank)) + 1024, permission: board.permission, x: board.x + board.width + .03 + (count % 3) * .3, y: board.y + Math.floor(count / 3) * .16, width: .28, height: .14 }; delete item.id; if (!validProject(item)) throw Error('작업의 입력값 또는 일정을 확인해주세요.'); validateProjectLinks({ ...itemsRef.current, [id]: item }, id); return patchItems({ [id]: item }); },
  };
  const presentationPages = framePages;
  const presentationPageById=useMemo(()=>new Map(framePages.map(page=>[page.frameId,page])),[framePages]);
  const presentationPage = presentationPages[portfolioIndex];
  useEffect(() => { if (portfolioViewing && !presentationPage) { setPortfolioViewing(false); setPortfolioSettings(false); if (portfolioCamera.current) setCamera(portfolioCamera.current); } }, [presentationPage, portfolioViewing]);
  const portfolioWritable = item => Boolean(hostSessionRef.current?.editable && item && !item.locked && canUseItem(item, accessRef.current, 'write'));
  useEffect(() => {
    const nextDelay = nextRevealBoundaryDelay(items, Date.now());
    if (nextDelay == null) return undefined;
    const timer = setTimeout(() => setRevealTick((tick) => tick + 1), nextDelay);
    return () => clearTimeout(timer);
  }, [items, revealTick]);
  const updateItemHidden = (ids, nextHidden, { deselectHidden = false } = {}) => {
    if (!hostSessionRef.current?.editable) return false;
    const targets = [...new Set(ids)].map((id) => String(id));
    if (targets.some((id) => itemsRef.current[id] && !canWriteItem(itemsRef.current[id]))) {
      setToast(WRITE_DENIED);
      return false;
    }
    if (targets.some((id) => isObjectLocked(itemsRef.current[id]))) {
      setToast(OBJECT_LOCK_MESSAGE);
      return false;
    }
    if (nextHidden && editingIdRef.current && targets.includes(String(editingIdRef.current))) {
      finishEditing(editingIdRef.current);
    }
    const changes = {};
    const hiddenAppliedIds = [];
    for (const id of targets) {
      const item = itemsRef.current[id];
      if (!isHideableObject(item)) continue;
      const visPatch = writeObjectVisibilityPatch(
        item,
        nextHidden ? { hidden: true } : { hidden: false, revealAfterAnimation: false },
      );
      if (!visPatch) continue;
      const stopPlayback = nextHidden && item.animationPlayback?.action === 'play'
        ? { animationPlayback: { runId: createId(), action: 'stop', startedAt: 0, config: item.animation || defaultAnimation() } }
        : {};
      changes[id] = { ...item, ...visPatch, ...stopPlayback };
      if (nextHidden) hiddenAppliedIds.push(id);
    }
    if (!Object.keys(changes).length) return false;
    const ok = patchItems(changes);
    if (ok && nextHidden && deselectHidden && hiddenAppliedIds.length) {
      const hiddenSet = new Set(hiddenAppliedIds);
      selectItems(selectedItemIds.filter((id) => !hiddenSet.has(String(id))));
    }
    return ok;
  };
  const setRevealAfterAnimation = (ids, enabled) => {
    if (!hostSessionRef.current?.editable) return false;
    const targets = [...new Set(ids)].map((id) => String(id));
    if (targets.some((id) => itemsRef.current[id] && !canWriteItem(itemsRef.current[id]))) {
      setToast(WRITE_DENIED);
      return false;
    }
    if (targets.some((id) => isObjectLocked(itemsRef.current[id]))) {
      setToast(OBJECT_LOCK_MESSAGE);
      return false;
    }
    const changes = {};
    for (const id of targets) {
      const item = itemsRef.current[id];
      if (!isHideableObject(item)) continue;
      const visPatch = writeObjectVisibilityPatch(
        item,
        enabled ? { hidden: true, revealAfterAnimation: true } : { revealAfterAnimation: false },
      );
      if (!visPatch) continue;
      if (enabled) {
        const animConfig = ensureRevealAnimationConfig(item);
        changes[id] = {
          ...item,
          ...visPatch,
          ...(!hasAnimation(item) ? { animation: animConfig } : {}),
          animationPlayback: { runId: createId(), action: 'stop', startedAt: 0, config: animConfig },
        };
      } else {
        changes[id] = { ...item, ...visPatch };
      }
    }
    return Object.keys(changes).length ? patchItems(changes) : false;
  };
  const revealObjectsAfterAnimation = (ids) => {
    if (!hostSessionRef.current?.editable) return false;
    const targets = [...new Set(ids)].map((id) => String(id));
    const runId = createId();
    const changes = {};
    for (const id of targets) {
      const item = itemsRef.current[id];
      if (!isHideableObject(item)) continue;
      if (!portfolioWritable(item)) {
        setToast(isObjectLocked(item) ? OBJECT_LOCK_MESSAGE : WRITE_DENIED);
        return false;
      }
      const animConfig = ensureRevealAnimationConfig(item);
      const visPatch = writeObjectVisibilityPatch(item, { hidden: true, revealAfterAnimation: true });
      changes[id] = {
        ...item,
        ...(visPatch || {}),
        ...(!hasAnimation(item) ? { animation: animConfig } : {}),
        animationPlayback: { runId, action: 'play', startedAt: 0, config: animConfig },
      };
    }
    return Object.keys(changes).length ? patchItems(changes) : false;
  };
  const runAnimations = (ids, action = 'play') => { const changes = {}, runId = createId(); for (const id of [...new Set(ids)]) { const item = itemsRef.current[id]; if (!item || ['portfolio', 'frame', 'channel'].includes(item.kind)) continue; if (!portfolioWritable(item)) throw Error('선택 객체의 쓰기 권한과 잠금 상태를 확인해주세요.'); const config = item.animation || defaultAnimation(); const vis = readObjectVisibility(item); if (action === 'play' && config.effect === 'none' && !vis.revealAfterAnimation) continue; const effectiveConfig = action === 'play' && config.effect === 'none' && vis.revealAfterAnimation ? ensureRevealAnimationConfig(item) : config; changes[id] = { ...item, ...(effectiveConfig !== config ? { animation: effectiveConfig } : {}), animationPlayback: { runId, action, startedAt: 0, config: effectiveConfig } }; } if (action === 'stop' && portfolioViewingRef.current && currentFrameRef.current && itemsRef.current[currentFrameRef.current]?.kind === 'frame') { const meta = itemsRef.current[PORTFOLIO_ID]; if (meta && portfolioWritable(meta)) changes[PORTFOLIO_ID] = { ...meta, portfolioCursor: { runId, previousRunId: meta.portfolioCursor?.runId || '', frameId: currentFrameRef.current, step: meta.portfolioCursor?.frameId === currentFrameRef.current ? meta.portfolioCursor.step : 0, startedAt: 0 } }; } if (!Object.keys(changes).length && action === 'play') throw Error('재생할 객체에 애니메이션 효과를 먼저 지정해주세요.'); return Object.keys(changes).length ? patchItems(changes) : false; };
  const frameMeta = () => itemsRef.current[PORTFOLIO_ID] || { ...newPortfolio(permission), title: ui('포트폴리오') };
  const showPortfolioPage = (index, publish = true) => {
    const page = frameStore.getSnapshot()[index], rect = boardRef.current?.getBoundingClientRect(); if (!page || !rect) return;
    const frame = page.frameId && itemsRef.current[page.frameId];
    const bounds = frame ? [{ minX: frame.x, minY: frame.y, maxX: frame.x + frame.width, maxY: frame.y + frame.height }] : page.objectIds.flatMap(id => { const item = itemsRef.current[id]; return item && item.kind !== 'portfolio' ? [objectBounds(item, itemsRef.current, boardSize.width, boardSize.height)] : []; });
    if (!bounds.length) { setToast(ui('이 장면에서 볼 수 있는 객체가 없습니다.')); return; }
    if (!portfolioViewingRef.current) portfolioCamera.current = { x: camera.x, y: camera.y, scale: camera.scale, detailScale: camera.detailScale };
    finishEditing(editingId); setActiveTool('select'); selectItems([]); setPortfolioViewing(true); setPortfolioIndex(index); currentFrameRef.current = page.frameId || page.id;
    const minX = Math.min(...bounds.map(b => b.minX)) * boardSize.width, minY = Math.min(...bounds.map(b => b.minY)) * boardSize.height, maxX = Math.max(...bounds.map(b => b.maxX)) * boardSize.width, maxY = Math.max(...bounds.map(b => b.maxY)) * boardSize.height;
    const scale = Math.min(100, Math.max(.0001, Math.min((rect.width - (frame ? 0 : 100)) / Math.max(1, maxX - minX), (rect.height - (frame ? 0 : 180)) / Math.max(1, maxY - minY))));
    setCamera(current => ({ ...current, scale, detailScale: scale, x: rect.width / 2 - (minX + maxX) / 2 * scale, y: (rect.height - (frame ? 0 : 90)) / 2 - (minY + maxY) / 2 * scale }));
    requestAnimationFrame(() => boardRef.current?.focus({ preventScroll: true }));
    if (publish && frame && portfolioWritable(frame) && (!itemsRef.current[PORTFOLIO_ID] || portfolioWritable(itemsRef.current[PORTFOLIO_ID]))) {
      const meta = frameMeta(), runId = createId(), changes = {};
      for (const id of Object.keys(itemsRef.current)) { const item = itemsRef.current[id]; if (item?.frameId && [seenCursor.current ? meta.portfolioCursor?.frameId : '', page.frameId].includes(item.frameId) && item.animationPlayback?.action === 'play' && portfolioWritable(item)) changes[id] = { ...item, animationPlayback: { runId: createId(), action: 'stop', startedAt: 0, config: item.animation || defaultAnimation() } }; }
      changes[PORTFOLIO_ID] = { ...meta, portfolioCursor: { runId, previousRunId: meta.portfolioCursor?.runId || '', frameId: page.frameId, step: 0, startedAt: 0 } }; patchItems(changes);
    } else if (publish) { seenCursor.current = itemsRef.current[PORTFOLIO_ID]?.portfolioCursor?.runId || ''; }
  };
  const advancePresentation = () => {
    try {
      if (presentationPendingRef.current || Date.now() < presentationBusy.current) return;
      const page = frameStore.getSnapshot().find(p => p.frameId === currentFrameRef.current) || presentationPages[portfolioIndex]; if (!page) return;
      if (!page.frameId) { if (portfolioIndex < presentationPages.length - 1) showPortfolioPage(portfolioIndex + 1); return; }
      if (!portfolioWritable(itemsRef.current[page.frameId])) return;
      const meta = frameMeta(); if (itemsRef.current[PORTFOLIO_ID] && !portfolioWritable(meta)) return;
      const cursor = meta.portfolioCursor, step = cursor?.frameId === page.frameId ? cursor.step : 0, groups = animationGroups(page, itemsRef.current);
      if (cursor?.startedAt === 0) return;
      if (step >= groups.length) { const next = frameStore.getSnapshot().findIndex(p => p.frameId === page.nextFrameId); if (next >= 0) showPortfolioPage(next); else setToast(ui('마지막 프레임입니다.')); return; }
      const runId = createId(), changes = {}; for (const id of groups[step].ids) { const item = itemsRef.current[id]; if (!portfolioWritable(item)) throw Error('선택 객체의 쓰기 권한과 잠금 상태를 확인해주세요.'); changes[id] = { ...item, animationPlayback: { runId, action: 'play', startedAt: 0, config: { ...item.animation, loop: false } } }; }
      changes[PORTFOLIO_ID] = { ...meta, portfolioCursor: { runId, previousRunId: cursor?.runId || '', frameId: page.frameId, step: step + 1, startedAt: 0 } };
      presentationPendingRef.current = runId; setPresentationSending(true); if (!patchItems(changes)) { presentationPendingRef.current = null; setPresentationSending(false); } setTimeout(() => { if (presentationPendingRef.current === runId) { presentationPendingRef.current = null; setPresentationSending(false); } }, 5000);
    } catch (error) { setToast(ui(error.message)); }
  };
  const cursor = committedItemsRef.current[PORTFOLIO_ID]?.portfolioCursor;
  useEffect(() => { if (!cursor?.startedAt) return; if (presentationPendingRef.current === cursor.runId) { presentationPendingRef.current = null; setPresentationSending(false); } if (!portfolioViewing || seenCursor.current === cursor.runId) return; const index = framePages.findIndex(page => page.frameId === cursor.frameId); if (index < 0) return; seenCursor.current = cursor.runId; showPortfolioPage(index, false); const groups = animationGroups(framePages[index], itemsRef.current), group = groups[cursor.step - 1]; presentationBusy.current = group && !group.ids.every(id => itemsRef.current[id]?.animationPlayback?.action === 'stop') ? cursor.startedAt + Math.max(...group.ids.map(id => { const a = itemsRef.current[id]?.animation; return (a?.duration || 0) + (a?.delay || 0); })) : 0; }, [cursor, portfolioViewing, framePages]);
  const portfolioActionsRef = useRef(null);
  portfolioActionsRef.current = {
    canManage: () => itemsRef.current[PORTFOLIO_ID] ? portfolioWritable(itemsRef.current[PORTFOLIO_ID]) : Boolean(hostSessionRef.current?.editable && canUseCanvas(accessRef.current, 'write')),
    createFrame: ids => { if (!hostSessionRef.current?.editable || portfolioViewingRef.current) return false; const selected = ids.filter(id => itemsRef.current[id] && !['frame', 'portfolio'].includes(itemsRef.current[id].kind)); if (!selected.length) return false; const bounds = selected.map(id => objectBounds(itemsRef.current[id], itemsRef.current, boardSize.width, boardSize.height)); const id = createId(), frame = { ...newFrame(), title: ui('새 프레임'), frameOrder: Math.min(1000000, Math.max(-1, ...frameStore.getSnapshot().map(p => p.frame.frameOrder)) + 1), depth: -1000, permission, ...(bounds.length ? { x: Math.min(...bounds.map(b => b.minX)) - .025, y: Math.min(...bounds.map(b => b.minY)) - .04, width: Math.max(.2, Math.max(...bounds.map(b => b.maxX)) - Math.min(...bounds.map(b => b.minX)) + .05), height: Math.max(.15, Math.max(...bounds.map(b => b.maxY)) - Math.min(...bounds.map(b => b.minY)) + .08) } : centeredItemPosition(.8, .72)) }; const changes = { [id]: frame }; if (!itemsRef.current[PORTFOLIO_ID]) changes[PORTFOLIO_ID] = frameMeta(); for (const key of selected) { if (!portfolioWritable(itemsRef.current[key])) return false; changes[key] = { ...itemsRef.current[key], frameId: id }; } return patchItems(changes); },
    patchFrame: (id, patch) => { const old = itemsRef.current[id]; if (!portfolioWritable(old)) return false; const next = { ...old, ...patch }; if (!validFrame(next)) throw Error('프레임 설정을 확인해주세요.'); return patchItems({ [id]: next }); },
    assign: (ids, frameId, priority) => { if (frameId && itemsRef.current[frameId]?.kind !== 'frame') return false; const changes = {}; for (const id of ids) { const item = itemsRef.current[id]; if (!portfolioWritable(item) || ['frame', 'portfolio'].includes(item.kind)) return false; const next = { ...item, ...(priority !== undefined ? { animationPriority: priority } : {}) }; if (priority !== undefined && !validFrameField('animationPriority', priority)) throw Error('프레임 또는 우선순위 설정을 확인해주세요.'); if (frameId !== undefined) { if (frameId) next.frameId = frameId; else delete next.frameId; } changes[id] = next; } return patchItems(changes); },
    linkPriority: (id, value) => { const item = itemsRef.current[id]; if (!portfolioWritable(item) || !validFrameField('frameLinkPriority', value)) return false; return patchItems({ [id]: { ...item, frameLinkPriority: value } }); },
    configure: (ids, config) => { if (!validAnimation(config)) throw Error('애니메이션 설정을 확인해주세요.'); const changes = {}; for (const id of ids) { const item = itemsRef.current[id]; if (!portfolioWritable(item)) return false; changes[id] = { ...item, animation: config, ...(config.effect === 'none' ? { animationPlayback: { runId: createId(), action: 'stop', startedAt: 0, config } } : {}) }; } return patchItems(changes); },
    copyLink: frameId => itemsRef.current[frameId]?.kind !== 'frame' ? setToast(ui('프레임 설정을 확인해주세요.')) : navigator.clipboard.writeText(`${window.location.origin}/canvases/${canvasId}?frame=${encodeURIComponent(frameId)}`).then(() => setToast(ui('프레임 발표 보기 링크를 복사했습니다.'))).catch(() => setToast(ui('링크를 복사하지 못했습니다.'))),
    play: ids => runAnimations(ids), stop: ids => runAnimations(ids, 'stop'), setRevealAfterAnimation, revealAfterAnimation: revealObjectsAfterAnimation, playPage: () => portfolioViewingRef.current && presentationPages[portfolioIndex]?.frameId ? advancePresentation() : runAnimations(presentationPages[portfolioIndex]?.objectIds || []), stopPage: () => runAnimations(presentationPages[portfolioIndex]?.objectIds || [], 'stop'), show: showPortfolioPage,
  };
  const portfolioActions = useMemo(() => Object.fromEntries(
    Object.keys(portfolioActionsRef.current).map((key) => [key, (...args) => portfolioActionsRef.current[key](...args)])
  ), []);
  useEffect(() => { if (!autoPortfolioOpened.current && presentationPages.length && hostStatus.ready && new URLSearchParams(window.location.search).get('frame')) { const frame = requestAnimationFrame(() => { if (boardRef.current) { autoPortfolioOpened.current = true; setPortfolioLocked(true); const linked = new URLSearchParams(window.location.search).get('frame'); const index = presentationPages.findIndex(p => p.frameId === linked); showPortfolioPage(Math.max(0, index), false); } }); return () => cancelAnimationFrame(frame); } }, [presentationPages, hostStatus.ready]);
  const exitPortfolio = () => { if (portfolioLocked) return; setPortfolioViewing(false); setPortfolioSettings(false); if (portfolioCamera.current) setCamera(portfolioCamera.current); if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); };
  saveBlueprintValueRef.current=(id,patch)=>{
    const previous=itemsRef.current[id];if(!hostStatus.editable||previous?.kind!=='value'||!canWriteItem(previous)||previous.locked)return false;
    return patchItems({[id]:{...previous,...patch}})!==false;
  };
  saveBlueprintOutputRef.current = (id, records) => {
    const previous = itemsRef.current[id];
    if (!hostStatus.editable || previous?.runtimeRole !== 'output') return false;
    patchItems({ [id]: { ...previous, runtimeResults: records } });
    return true;
  };
  saveAgentItemRef.current = (id, patch) => {
    const previous = itemsRef.current[String(id)];
    if (!hostStatus.editable || !previous || !isAgentCanvasObject(previous) || !canWriteItem(previous) || previous.locked) return false;
    return patchItems({ [String(id)]: { ...previous, ...patch } }) !== false;
  };
  const hostReadyRef = useRef(false);
  hostReadyRef.current = hostStatus.editable;
  useEffect(() => {
    if (hostStatus.editable) return;
    setShowSettings(false); setShowParticipants(false); setShowCanvasCode(false); setShowVersions(false);
    setEditingId(null); editingIdRef.current = null;
    dragRef.current = null; drawingRef.current = false;
  }, [hostStatus.editable]);
  const syncSelectionInspectorRef = useRef(null);
  const selectItems = useCallback((ids, primaryId) => {
    const normalized = [...new Set((ids || []).filter((id) => id != null).map(String))];
    selectedIdsRef.current = normalized;
    setSelectedItemIds(normalized);
    setSelectedItemId(normalized.length ? String(primaryId ?? normalized[normalized.length - 1]) : null);
    syncSelectionInspectorRef.current?.(normalized.length);
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
  useEffect(() => installSoundUnlock(), []);
  const comments = useCommentsAndMentions({ sendRaw, connection, user, canvasId, onMention: () => playSoundCue('mention') });
  const chatEventsRef = useRef(null);
  chatEventsRef.current = comments;
  const rtcSendBudgetRef = useRef(new SocketSendBudget());
  const sendRtcRaw = useCallback((payload) => {
    const socket = rtcWsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    const request = payload?.request_id ? payload : { ...payload, request_id: createId() };
    return rtcSendBudgetRef.current.send(socket, request);
  }, []);
  const passwordPrompt = useCanvasPasswordPrompt();
  const voice = useCanvasVoiceCall(canvasId, sendRtcRaw, user?.email || user?.user_id || `${user?.nickname}#${user?.tag_number}`);
  const [communicationTab, setCommunicationTab] = useState('chat');
  const requestChatHistory = useCallback((toSequence, aroundSequence) => {
    if (chatHistoryRequestRef.current) return false;
    const requestId = createId();
    const payload = { type: 'chat_history', ...chatTarget(activeChatChannelRef.current), request_id: requestId, limit: CHAT_HISTORY_LIMIT };
    if (aroundSequence) { payload.from_sequence = Math.max(1, aroundSequence - 10); payload.to_sequence = aroundSequence + 10; }
    else if (toSequence != null) payload.to_sequence = toSequence;
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
  const selectChatChannel = useCallback((channelId) => {
    if (channelId === activeChatChannelRef.current) return;
    activeChatChannelRef.current = channelId;
    chatChannelRef.current = { ...chatChannelRef.current, activeId: channelId };
    setActiveChatChannel(channelId);
    setChatUnread(current => { if (!current[channelId]) return current; const next = { ...current }; delete next[channelId]; return next; });
    setMessages([]); setChatMessageTotal(0); setHasOlderMessages(false); setChatHistoryLoading(false); setChatHighlight(null);
    chatHistoryRequestRef.current = null;
    chatHistoryPageRef.current = { hasMore: false, nextToSequence: null };
    requestChatHistory();
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
  const spatialDirtyIds = useRef(null);
  const refreshSpatialIndex = useCallback(event => {
    const ids = Array.isArray(event) ? event : event?.changedItemIds;
    if (Array.isArray(ids) && spatialDirtyIds.current !== null) for (const id of ids) spatialDirtyIds.current.add(String(id));
    else if (!Array.isArray(ids)) spatialDirtyIds.current = null;
    setSpatialRevision(revision => revision + 1);
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
    if (!isCollaborativeItem(item) || isObjectLocked(item) || !canWriteItem(item)) return;
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
    patchItems({ [id]: nextItem });
    if (change) {
      const version = nextPeerSyncVersion(syncClockRef, syncActorRef);
      itemSyncVersionsRef.current.set(String(id), version);
      peerMeshRef.current?.sendData({ type: 'doc_change', item_id: String(id), field, change, version }, (peer) => canPeerAccessItem(item, peer));
    }
    markItemDirty(id);
  }, [getCollaborativeDoc, markItemDirty, patchItems]);
  const updateTextColor = useCallback((id, start, end, color) => {
    const key = String(id), item = itemsRef.current[key];
    if (item?.kind !== 'text' || isObjectLocked(item) || !canWriteItem(item) || !hostSessionRef.current.editable) return false;
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
    if (item?.kind !== 'text' || isObjectLocked(item) || !canWriteItem(item) || !hostSessionRef.current.editable) return false;
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
    const validField = field === 'fontSize' ? supportsObjectFontSize(item) && isObjectFontSize(value) : field === 'groupId'
      ? isCollaborativeItem(item) && nextValue.length <= 128
      : field === 'color'
        ? (item?.kind === 'note' && /^#[0-9a-f]{6}$/i.test(nextValue)) || (item?.kind === 'text' && (nextValue === '' || /^#[0-9a-f]{6}$/i.test(nextValue)))
        : field === 'renderMode' ? isTextContent(item) && isContentMode(nextValue)
          : isTextContent(item) && (field === 'filename' ? nextValue.length <= 80 : field === 'language' && isCodeLanguage(nextValue));
    if (!isCollaborativeItem(item) || isObjectLocked(item) || !canWriteItem(item) || !validField) return;
    const nextItem = { ...item, [field]: field === 'fontSize' ? Number(nextValue) : field === 'groupId' ? nextValue || null : nextValue };
    itemsRef.current = changeItems(itemsRef.current, { [key]: nextItem });
    setItems((current) => changeItems(current, { [key]: nextItem }), [key]);
    if (['fontSize', 'renderMode', 'filename', 'language'].includes(field)) refreshSpatialIndex([key]);
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
  const sendItemChange = useCallback((_payload, previous) => hostSessionRef.current.editable && !isObjectLocked(previous) && (!previous || canWriteItem(previous)), []);
  const sendStrokeFrameChanges = useCallback(frame => {
    if (!hostSessionRef.current.editable) return false;
    const changes = {}, removed = [];
    for (const { id, payload } of frame) if (payload.type === 'item_delete') removed.push(id); else if (payload.type === 'item_update') changes[id] = payload.item;
    patchItems(changes, removed);
    return true;
  }, [patchItems]);
  const updateTableItem = useCallback((id, update) => {
    const key = String(id);
    const previous = itemsRef.current[key];
    const mediaOnly = (portfolioViewingRef.current && ['pdf', 'link'].includes(previous?.kind) && update && typeof update === 'object' && Object.keys(update).length > 0 && Object.keys(update).every(key => ['mediaState', 'mediaLoop', 'pdfPage'].includes(key)) || portfolioViewingRef.current && previous?.kind === 'value' && update && typeof update === 'object' && Object.keys(update).length > 0 && Object.keys(update).every(key => ['valueNumber', 'valueText'].includes(key))) && canUseItem(previous, accessRef.current, 'write');
    const agentEdgeUpdate = previous?.kind === 'connector' && update && typeof update === 'object' && Object.keys(update).length > 0 && Object.keys(update).every(field => ['format', 'label', 'labelMode'].includes(field));
    if (!(['table', 'chart', 'question', 'value', 'pdf', 'link'].includes(previous?.kind) || ['notebook', 'notebook-cell', 'timer'].includes(previous?.runtimeRole) || isAgentCanvasObject(previous) || agentEdgeUpdate) || !hostSessionRef.current.editable || isObjectLocked(previous) || (!canWriteItem(previous) && !mediaOnly)) return false;
    const nextItem = typeof update === 'function' ? update(previous) : { ...previous, ...update };
    if (!nextItem || nextItem === previous) return false;
    itemsRef.current = changeItems(itemsRef.current, { [key]: nextItem });
    setItems((current) => changeItems(current, { [key]: nextItem }), [key]);
    if (previous.x !== nextItem.x || previous.y !== nextItem.y || previous.width !== nextItem.width || previous.height !== nextItem.height) refreshSpatialIndex([key]);
    if (!mediaOnly && !sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = changeItems(itemsRef.current, { [key]: previous });
      setItems((current) => changeItems(current, { [key]: previous }), [key]);
      refreshSpatialIndex([key]);
      setToast(previous.kind === 'question' ? '연결이 복구되면 문제를 다시 편집해주세요.' : previous.kind === 'chart' ? '연결이 복구되면 그래프를 다시 편집해주세요.' : '연결이 복구되면 테이블을 다시 편집해주세요.');
      return false;
    }
    return true;
  }, [refreshSpatialIndex, sendItemChange]);
  saveRuntimeStateRef.current = (id, state) => {
    const previous = itemsRef.current[id]; if (!previous || !canExecuteItem(previous)) return false;
    const fields = ['running', 'building', 'status', 'phase', 'completed', 'failed', 'built', 'reset', 'runId', 'source', 'language', 'detail', 'error'];
    const shared = state ? Object.fromEntries(fields.filter(key => state[key] !== undefined).map(key => [key, state[key]])) : null;
    if (shared) shared.updatedAt = Date.now();
    const next = { ...previous, runtimeState: shared };
    if (!hostSessionRef.current.editable) return false;
    return patchItems({ [id]: next }, [], { history: false });
  };
  const updateFormulaItem = useCallback((id, formula) => {
    const key = String(id);
    const previous = itemsRef.current[key];
    if (previous?.kind !== 'math' || previous.formula === formula) return false;
    const nextItem = { ...previous, formula };
    itemsRef.current = changeItems(itemsRef.current, { [key]: nextItem });
    setItems((current) => changeItems(current, { [key]: nextItem }), [key]);
    if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = changeItems(itemsRef.current, { [key]: previous });
      setItems((current) => changeItems(current, { [key]: previous }), [key]);
      setToast('연결이 복구되면 수식을 다시 편집해주세요.');
      return false;
    }
    return true;
  }, [sendItemChange]);
  const updateObjectSize = (id, field, value) => {
    const key = String(id);
    const previous = itemsRef.current[key];
    if (!previous || !hostSessionRef.current.editable || isObjectLocked(previous) || !canWriteItem(previous)) return;
    const patch = field === 'fontSize' ? (supportsObjectFontSize(previous) && isObjectFontSize(value) ? { fontSize: value } : null) : numericObjectPatch(previous, field, value);
    if (!patch) return;
    const nextItem = { ...previous, ...patch };
    itemsRef.current = changeItems(itemsRef.current, { [key]: nextItem });
    setItems(current => changeItems(current, { [key]: nextItem }), [key]);
    refreshSpatialIndex([key]);
    sendPeerItemGeometry(key, nextItem);
    if (isCollaborativeItem(nextItem)) markItemDirty(key);
    else if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = changeItems(itemsRef.current, { [key]: previous });
      setItems(current => changeItems(current, { [key]: previous }), [key]);
      sendPeerItemGeometry(key, previous);
      refreshSpatialIndex([key]);
    }
  };
  const updateObjectDimensions = (id, field, value) => updateObjectSize(id, field, value);
  const updateObjectFontSize = (id, value) => updateObjectSize(id, 'fontSize', value);
  const patchEditableObjects = (ids, transform) => {
    if (!hostSessionRef.current.editable) return false;
    const changes = {};
    for (const id of Array.isArray(ids) ? ids : [ids]) {
      const key = String(id), previous = itemsRef.current[key];
      if (!previous || isObjectLocked(previous) || !canWriteItem(previous)) continue;
      const patch = transform(previous, key);
      if (patch) changes[key] = { ...previous, ...patch };
    }
    if (!Object.keys(changes).length) return false;
    const ok = patchItems(changes);
    if (ok) refreshSpatialIndex();
    return ok;
  };
  const updateItemShadow = (ids, field, value) => {
    const allowed = { shadowBlur: [0, 24], shadowOpacity: [0, 1], shadowOffsetX: [-24, 24], shadowOffsetY: [-24, 24] };
    if (field !== 'shadowEnabled' && (!allowed[field] || !Number.isFinite(value))) return;
    const nextValue = field === 'shadowEnabled' ? Boolean(value) : Math.max(allowed[field][0], Math.min(allowed[field][1], value));
    patchEditableObjects(ids, () => ({ [field]: nextValue }));
  };
  const updateImageFrame = (ids, enabled) => {
    if (typeof enabled !== 'boolean') return;
    patchEditableObjects(ids, previous => previous.kind === 'image' ? { imageFrameEnabled: enabled } : null);
  };
  const updateObjectCornerStyle = (ids, value) => {
    if (!validObjectCornerStyle(value)) return;
    patchEditableObjects(ids, previous => supportsAnyCorners(previous) ? { cornerStyle: value } : null);
  };
  const bringSelectionToFront = (ids) => {
    const maxDepth = Math.max(0, ...Object.values(itemsRef.current).map(itemDepth));
    patchEditableObjects(ids, () => ({ depth: maxDepth + 1 }));
  };
  const sendSelectionToBack = (ids) => {
    const minDepth = Math.min(0, ...Object.values(itemsRef.current).map(itemDepth));
    patchEditableObjects(ids, () => ({ depth: minDepth - 1 }));
  };
  const applyContainerAutoLayout = (parentId) => {
    const parent = itemsRef.current[String(parentId)];
    if (!parent) return false;
    const layoutPatches = computeAutoLayoutPatches(parentId, parent, itemsRef.current, boardSize);
    const targetIds = Object.keys(layoutPatches);
    if (!targetIds.length) {
      setToast(ui('컨테이너 내부에 배치할 하위 객체가 없습니다.'));
      return false;
    }
    const ok = patchEditableObjects(targetIds, (_prev, id) => layoutPatches[id] || null);
    if (ok) setToast(ui('오토 레이아웃을 적용했습니다.'));
    return ok;
  };
  const patchAllStyledItems = (transform) => patchEditableObjects(Object.keys(itemsRef.current), (prev, id) => transform(id, prev));
  useEffect(() => {
    if (editingId && (items[editingId]?.locked === true || !canWriteItem(items[editingId]))) stopEditing(editingId);
  }, [editingId, items[editingId]?.locked, capabilities]);
  const updateItemLocked = (ids, locked) => {
    if (!hostSessionRef.current.editable) return;
    if (ids.some(id => !canWriteItem(itemsRef.current[id]))) { setToast(WRITE_DENIED); return; }
    if (editingIdRef.current && ids.includes(editingIdRef.current)) finishEditing(editingIdRef.current);
    const changes = {};
    for (const id of ids) { const item = itemsRef.current[id]; if (item && isObjectLocked(item) !== locked) changes[id] = { ...item, locked }; }
    patchItems(changes);
  };
  const updateItemGroups = (ids, nextGroupsOrTransform) => {
    if (!hostSessionRef.current?.editable) return false;
    const targets = [...new Set((Array.isArray(ids) ? ids : [ids]).map(String))];
    if (targets.some(id => itemsRef.current[id] && (isObjectLocked(itemsRef.current[id]) || !canWriteItem(itemsRef.current[id])))) {
      setToast(WRITE_DENIED);
      return false;
    }
    const changes = {};
    for (const id of targets) {
      const item = itemsRef.current[id];
      if (!item) continue;
      const currentGroups = normalizeObjectGroups(item.permission);
      const rawNext = typeof nextGroupsOrTransform === 'function' ? nextGroupsOrTransform(currentGroups) : nextGroupsOrTransform;
      const normalized = normalizeObjectGroups(rawNext);
      if (!normalized.length) return false;
      if (normalized.length === currentGroups.length && normalized.every((g, i) => g === currentGroups[i])) continue;
      const updated = { ...item, permission: normalized };
      if (!canWriteItem(updated)) {
        setToast(WRITE_DENIED);
        return false;
      }
      changes[id] = updated;
      if (item.runtimeRole === 'notebook' && Array.isArray(item.notebookCellIds)) {
        for (const cellId of item.notebookCellIds) {
          const cell = itemsRef.current[cellId];
          if (cell?.runtimeRole === 'notebook-cell' && cell.notebookId === id) {
            changes[cellId] = { ...cell, permission: normalized };
          }
        }
      }
    }
    if (!Object.keys(changes).length) return false;
    return patchItems(changes);
  };
  const updateItemDepth = (ids, value) => {
    const depth = Number(value);
    if (!Number.isSafeInteger(depth)) return;
    patchEditableObjects(ids, () => ({ depth }));
  };
  const updateItemRotation = (ids, value) => {
    const rotation = Math.max(-180, Math.min(180, Number(value) || 0));
    for (const id of Array.isArray(ids) ? ids : [ids]) {
      const key = String(id);
      const previous = itemsRef.current[key];
      if (!previous || isObjectLocked(previous) || !canWriteItem(previous)) continue;
      if ((Number(previous.rotation) || 0) === rotation) continue;
      const nextItem = { ...previous, rotation, ...(previous.kind === 'connector' && !(Number(previous.bend) > 0) ? connectorBendPatch(previous, 0.18) : {}) };
      itemsRef.current = changeItems(itemsRef.current, { [key]: nextItem });
      setItems((current) => changeItems(current, { [key]: nextItem }), [key]);
      refreshSpatialIndex([key]);
      if (isCollaborativeItem(nextItem)) {
        const version = nextPeerSyncVersion(syncClockRef, syncActorRef);
        itemSyncVersionsRef.current.set(key, version);
        peerMeshRef.current?.sendData({ type: 'item_geometry', item_id: key, x: nextItem.x, y: nextItem.y, rotation, version }, (peer) => canPeerAccessItem(nextItem, peer));
        markItemDirty(key);
        if (nextItem.kind === 'note') saveCollaborativeItemRef.current?.(key, { silent: true });
      } else if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
        itemsRef.current = changeItems(itemsRef.current, { [key]: previous });
        setItems((current) => changeItems(current, { [key]: previous }), [key]);
        refreshSpatialIndex([key]);
        setToast('연결이 복구되면 회전을 다시 적용해주세요.');
      }
    }
  };
  const updateUserGroup = (id, patch) => {
    const key = String(id), previous = itemsRef.current[key];
    if (previous?.kind !== 'user-group') return;
    const nextItem = { ...previous, ...patch };
    itemsRef.current = changeItems(itemsRef.current, { [key]: nextItem });
    setItems(current => changeItems(current, { [key]: nextItem }), [key]);
    refreshSpatialIndex([key]);
    if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = changeItems(itemsRef.current, { [key]: previous });
      setItems(current => changeItems(current, { [key]: previous }), [key]);
      refreshSpatialIndex([key]);
      setToast('연결이 복구되면 그룹을 다시 변경해주세요.');
    }
  };
  const updateShapeAppearance = (ids, field, value) => {
    if (!(field === 'visualStyle' && ['standard', 'sketch'].includes(value)
      || field === 'volumeStyle' && ['solid', 'wireframe'].includes(value)
      || field === 'strokeEnabled' && typeof value === 'boolean'
      || field === 'color' && /^#[0-9a-f]{6}$/i.test(value)
      || validShapeAppearance(field, value))) return;
    patchEditableObjects(ids, previous => previous.kind === 'shape' ? { [field]: value } : null);
  };
  const updateShapeFill = (ids, value) => {
    if (value !== '' && !/^#[0-9a-f]{6}$/i.test(value)) return;
    patchEditableObjects(ids, previous => previous.kind === 'shape' && previous.shapeType !== 'arrow' ? { fill: value } : null);
  };
  const updateObjectColor = (ids, value) => {
    const nextColor = value === '' ? '' : String(value || '');
    if (nextColor !== '' && !/^#[0-9a-f]{6}$/i.test(nextColor)) return;
    for (const id of Array.isArray(ids) ? ids : [ids]) {
      const key = String(id), previous = itemsRef.current[key];
      if (!previous || isObjectLocked(previous) || !canWriteItem(previous)) continue;
      if (previous.kind === 'note' && nextColor) {
        updateCollaborativeMetadata(key, 'color', nextColor);
        if (editingIdRef.current !== key) saveCollaborativeItemRef.current?.(key, { silent: true });
      } else if (previous.kind === 'text' && isTextContent(previous)) {
        updateCollaborativeMetadata(key, 'color', nextColor);
        if (editingIdRef.current !== key) saveCollaborativeItemRef.current?.(key, { silent: true });
      }
    }
  };
  const updateShapeArrowBend = (id, value, field = 'bend') => {
    const key = String(id);
    const previous = itemsRef.current[key];
    if (previous?.kind !== 'shape' || previous.shapeType !== 'arrow') return;
    const bend = Math.max(-1.5, Math.min(1.5, Number(value) || 0));
    const patch = field === 'bendPointCount' ? resizeShapeArrowControls(previous, previous.width * boardSize.width, previous.height * boardSize.height, value) : shapeArrowBendPatch(previous, bend);
    const nextItem = { ...previous, ...patch };
    itemsRef.current = changeItems(itemsRef.current, { [key]: nextItem });
    setItems((current) => changeItems(current, { [key]: nextItem }), [key]);
    refreshSpatialIndex([key]);
    if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = changeItems(itemsRef.current, { [key]: previous });
      setItems((current) => changeItems(current, { [key]: previous }), [key]);
      refreshSpatialIndex([key]);
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
    itemsRef.current = changeItems(itemsRef.current, { [key]: nextItem });
    setItems((current) => changeItems(current, { [key]: nextItem }), [key]);
    refreshSpatialIndex([key]);
    if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = changeItems(itemsRef.current, { [key]: previous });
      setItems((current) => changeItems(current, { [key]: previous }), [key]);
      refreshSpatialIndex([key]);
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
    const patch = field === 'bendPointCount' ? resizeConnectorControls(previous, connectorGeometry(previous, itemsRef.current, boardSize.width, boardSize.height, spatialIndex), nextValue) : field === 'bend' ? connectorBendPatch(previous, nextValue) : { [field]: nextValue };
    const nextItem = { ...previous, ...patch };
    if (portField && value === '') delete nextItem[field];
    itemsRef.current = changeItems(itemsRef.current, { [key]: nextItem });
    setItems((current) => changeItems(current, { [key]: nextItem }), [key]);
    refreshSpatialIndex([key]);
    if (!sendItemChange({ type: 'item_update', item_id: key, item: nextItem }, previous)) {
      itemsRef.current = changeItems(itemsRef.current, { [key]: previous });
      setItems((current) => changeItems(current, { [key]: previous }), [key]);
      refreshSpatialIndex([key]);
      setToast('연결이 복구되면 화살표 모양을 다시 변경해주세요.');
    }
  };
  const addItem = useCallback((id, item) => {
    item = snapNewItem(item, activeGridInterval(snapToGrid, gridSpacing), boardSize);
    if (!canvasSnapshotLoadedRef.current) return false;
    if (!canWriteItem(item)) { setToast(WRITE_DENIED); return false; }
    if (item?.kind === 'connector' && !connectorGeometry(item, itemsRef.current, boardSize.width, boardSize.height, spatialIndex)) { setToast('객체가 겹쳐 연결을 만들 수 없습니다. 객체를 옮긴 뒤 다시 연결해주세요.'); return false; }
    const sharedItem = makeCollaborativeItem(item);
    const key = String(id);
    if (isCollaborativeItem(sharedItem)) {
      const baseDoc = Automerge.load(decodeBase64(sharedItem.automerge_snapshot), { actor: createActorId() });
      const version = nextPeerSyncVersion(syncClockRef, syncActorRef);
      itemSyncVersionsRef.current.set(key, version);
      deletedItemSyncVersionsRef.current.delete(key);
      itemsRef.current = changeItems(itemsRef.current, { [key]: sharedItem });
      collaborativeDocsRef.current.set(key, baseDoc);
      collaborativeBaseDocsRef.current.set(key, baseDoc);
      newCollaborativeItemsRef.current.add(key);
      setItems((current) => changeItems(current, { [key]: sharedItem }), [key]);
      selectItems([id], id);
      refreshSpatialIndex([key]);
      markItemDirty(id);
      peerMeshRef.current?.sendData({ type: 'item_create', item_id: key, item: sharedItem, version }, (peer) => canPeerAccessItem(sharedItem, peer));
      if (sharedItem.kind === 'note') saveCollaborativeItemRef.current?.(id, { silent: true });
      return true;
    }
    if (!sendItemChange({ type: 'item_update', item_id: id, item: sharedItem }, null)) return false;
    itemsRef.current = changeItems(itemsRef.current, { [key]: sharedItem });
    setItems((current) => changeItems(current, { [key]: sharedItem }), [key]);
    refreshSpatialIndex([key]);
    return true;
  }, [boardSize, markItemDirty, refreshSpatialIndex, selectItems, sendItemChange, snapToGrid, gridSpacing]);
  const addItems = useCallback(entries => {
    if (!canvasSnapshotLoadedRef.current || !hostSessionRef.current.editable) return false;
    const changes = {};
    const snapInterval = activeGridInterval(snapToGrid, gridSpacing);
    for (const { id, item } of entries) {
      if (Object.hasOwn(itemsRef.current, id) || !canWriteItem(item)) return false;
      changes[id] = makeCollaborativeItem(snapNewItem(item, snapInterval, boardSize));
    }
    // One structural snapshot, one spatial revision and one publish per batch.
    return patchItems(changes);
  }, [patchItems, snapToGrid, gridSpacing, boardSize]);
  const deleteItems = useCallback((ids, { silent = false } = {}) => {
    const uniqueTargets = [...new Set((ids || []).filter((id) => id != null).map(String))];
    if (!uniqueTargets.length) return { ok: true, removed: [], remaining: [], deniedMessage: '' };
    if (!canvasSnapshotLoadedRef.current || !hostSessionRef.current.editable) {
      return { ok: false, removed: [], remaining: uniqueTargets, deniedMessage: '' };
    }
    const plan = planBatchDeletion(itemsRef.current, uniqueTargets, {
      canWriteItem,
      isLocked: isObjectLocked,
      canAdmin: () => accessRef.current?.is_admin === true,
      portfolioId: PORTFOLIO_ID,
    });
    const changedKeys = Object.keys(plan.changes);
    if (plan.removed.length || changedKeys.length) {
      const ok = patchItems(plan.changes, plan.removed);
      if (!ok) return { ok: false, removed: [], remaining: uniqueTargets, deniedMessage: plan.deniedMessage };
      for (const key of plan.removed) {
        newCollaborativeItemsRef.current.delete(key);
        itemEditRevisionRef.current.delete(key);
      }
      const touched = [...new Set([...changedKeys, ...plan.removed])];
      refreshSpatialIndex(touched);
    }
    if (!silent && plan.deniedMessage) setToast(plan.deniedMessage);
    return { ok: true, removed: plan.removed, remaining: plan.remaining, deniedMessage: plan.deniedMessage };
  }, [canWriteItem, patchItems, refreshSpatialIndex]);

  const deleteItem = useCallback((id) => {
    if (id == null) return true;
    const result = deleteItems([id], { silent: false });
    return result.ok && result.remaining.length === 0;
  }, [deleteItems]);
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
  const permission = useMemo(() => creationGroupPermission(capabilities, groups, settings, user), [capabilities, groups, settings, user]);

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
      chatChannelRef,
      voiceCallRef: voice.ref,
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
      runtimeSocketRequestsRef,
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
      setGroups, setCapabilities,
      setHasOlderMessages,
      setItems: receiveServerItems,
      setLaserStrokes,
      setMessages,
      setChatMessageTotal,
      setPeerList,
      setReconnectEpoch,
      setRemoteDrawingStrokes,
      setRemoteEditors,
      setSettings,
      setSettingsPending,
      settingsRequestsRef,
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
      requestPassword: passwordPrompt.requestPassword,
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

  useEffect(()=>{liveContent.prune(new Set(liveContentIds.filter(id=>Boolean(items[id]))));},[items,liveContent,liveContentIds]);
  const viewportSize = useCanvasViewport({ boardRef, setCamera, refreshKey: error });
  useEffect(() => { if (portfolioViewing && presentationPage?.frameId) showPortfolioPage(portfolioIndex, false); }, [viewportSize.width, viewportSize.height, presentationPage?.frame]);
  const spatialIndexRef = useRef(null);
  const spatialIndex = useMemo(() => {
    if (!spatialIndexRef.current) spatialIndexRef.current = new CanvasSpatialBTree();
    const dirty = spatialDirtyIds.current;
    spatialDirtyIds.current = new Set();
    return spatialIndexRef.current.update(items, boardSize, spatialRevision, spatialIndexRef.current.revision !== spatialRevision && dirty !== null ? [...dirty] : null);
  }, [items, spatialRevision, boardSize]);
  const visibleBounds = useMemo(() => {
    const scale = camera.scale, worldWidth = Math.max(1, boardSize.width), worldHeight = Math.max(1, boardSize.height);
    return {
      minX: -camera.x / scale / worldWidth, minY: -camera.y / scale / worldHeight,
      maxX: (Math.max(1, viewportSize.width) - camera.x) / scale / worldWidth,
      maxY: (Math.max(1, viewportSize.height) - camera.y) / scale / worldHeight
    };
  }, [camera, boardSize, viewportSize]);
  const activePeerIds = useMemo(() => peerList.filter((peer) => peer.connected).map((peer) => peer.peer_id).sort().join('\n'), [peerList]);
  const axisOriginX = boardSize.width * camera.scale / 2 + camera.x;
  const axisOriginY = boardSize.height * camera.scale / 2 + camera.y;
  const coordinatePlaneStyle = EMPTY_STYLE_OBJ;
  const sceneWindow = renderWindow(visibleBounds, boardSize, camera.scale,viewportSize);
  const zoomingActive = Boolean(boardRef.current?.classList?.contains('camera-zooming'));
  const cameraMoving = Boolean(boardRef.current?.classList?.contains('camera-moving'));
  const sceneQueryRef = useRef(null);
  if (!sceneQueryRef.current) sceneQueryRef.current = new StableSpatialQuery();
  const zoomEntriesCacheRef = useRef(null);
  // Objects that leave the render window stay mounted briefly. A zoom that pauses
  // (for example at the zoom limit) used to unmount heavy DOM objects (tables, PDFs,
  // images) and rebuild them when zooming back out; see docs/benchmarks/canvas-frames-*.md.
  const departedEntriesRef = useRef(new Map());
  const [departedTick, setDepartedTick] = useState(0);
  const visibleEntries = useMemo(() => {
    const cached = zoomEntriesCacheRef.current;
    const b = sceneWindow.bounds;
    const covered = containsViewport(cached?.bounds, visibleBounds, boardSize, camera.scale,viewportSize);
    if (cameraMoving && covered && cached && cached.items === items && cached.spatialIndex === spatialIndex && cached.spatialRevision === spatialRevision && cached.editingId === editingId && cached.liveContentIds === liveContentIds && cached.width === boardSize.width && cached.height === boardSize.height && !dragRef.current?.id) {
      return cached.entries;
    }
    let entries = sceneQueryRef.current.query(spatialIndex, b);
    // Keep an open editor mounted even when its measured bounds leave the viewport.
    for (const retainedId of [dragRef.current?.id, editingId, ...liveContentIds].filter(Boolean)) {
      if (!items[retainedId]) continue;
      const item = items[retainedId];
      if (entries.some(entry => entry.id === retainedId)) continue;
      entries = [...entries, {
        id: retainedId,
        item,
        bounds: objectBounds(item, items, boardSize.width, boardSize.height),
      }];
    }
    const departed = departedEntriesRef.current, now = performance.now(), present = new Set(entries.map(entry => entry.id));
    for (const entry of cached?.entries || []) {
      // Only DOM-rendered objects are retained. Vector objects redraw from the GPU
      // raster cache, and retaining them would drop the spatial query's incremental
      // delta (a full scene rebuild per zoom step).
      const item = items[entry.id];
      if (!present.has(entry.id) && item && isDomRenderedKind(item) && !departed.has(entry.id)) departed.set(entry.id, now + DEPARTED_ENTRY_MS);
    }
    const kept = [];
    for (const [id, until] of departed) {
      if (present.has(id) || !items[id] || until <= now) { departed.delete(id); continue; }
      kept.push({ id, item: items[id], bounds: objectBounds(items[id], items, boardSize.width, boardSize.height) });
    }
    while (departed.size > MAX_DEPARTED_ENTRIES) departed.delete(departed.keys().next().value);
    if (kept.length) entries = [...entries, ...kept.slice(-MAX_DEPARTED_ENTRIES)];
    zoomEntriesCacheRef.current = { liveContentIds, items, spatialIndex, spatialRevision, editingId, width: boardSize.width, height: boardSize.height, bounds: b, entries };
    return entries;
  }, [boardSize.height, boardSize.width, editingId, items, spatialIndex, spatialRevision, sceneWindow.key, zoomingActive, cameraMoving, camera, liveContentIds, departedTick]);
  useEffect(() => {
    const departed = departedEntriesRef.current;
    if (!departed.size) return undefined;
    const next = Math.min(...departed.values());
    const timer = setTimeout(() => setDepartedTick(value => value + 1), Math.max(16, next - performance.now() + 16));
    return () => clearTimeout(timer);
  }, [visibleEntries]);
  useLayoutEffect(()=>{
    const stage=boardRef.current,cached=zoomEntriesCacheRef.current;
    if(stage&&cached)stage.__agoraPreparedScene={bounds:cached.bounds,world:boardSize};
  });
  useEffect(() => {
    if (cameraMoving) return undefined;
    const controller = new AbortController();
    const scheduleIdle = typeof window.requestIdleCallback === 'function'
      ? (fn) => window.requestIdleCallback(fn, { timeout: 180 })
      : (fn) => window.setTimeout(fn, 80);
    const cancelIdle = typeof window.cancelIdleCallback === 'function'
      ? (id) => window.cancelIdleCallback(id)
      : (id) => window.clearTimeout(id);
    let active = true;
    const selector=new PreloadImageSelector(visibleBounds);let cursor=0,handle;
    const prepare=()=>{
      if(!active)return;
      const start=performance.now();let visited=0;
      while(cursor<visibleEntries.length && (visited%64!==0||performance.now()-start<2)){selector.add(visibleEntries[cursor++]);visited++;}
      if(cursor<visibleEntries.length)handle=scheduleIdle(prepare);
      else prefetchAuthenticatedImages(selector.sources(),token,{signal:controller.signal});
    };
    handle=scheduleIdle(prepare);
    return () => { active = false; controller.abort(); cancelIdle(handle); };
  }, [visibleEntries, spatialRevision, token, cameraMoving]);
  const previewHiddenEffective = Boolean(previewHiddenObjects && !portfolioViewing && !watchState.watching_id);
  const revealNow = useMemo(() => Date.now(), [items, revealTick, previewHiddenEffective]);
  const visibilityContextValue = useMemo(() => ({ previewHidden: previewHiddenEffective }), [previewHiddenEffective]);
  const visibilitySubset = useRef(null), styleSubset = useRef(null);
  if (!visibilitySubset.current) visibilitySubset.current = new ItemSubset(item => readObjectVisibility(item).hidden);
  if (!styleSubset.current) styleSubset.current = new ItemSubset(item => item.kind !== 'stroke' && hasAdvancedStyle(item));
  const hiddenCandidates = visibilitySubset.current.update(items);
  const styledCandidates = styleSubset.current.update(items);
  const isAxisLabelCovered = useCallback((view, left, top, right, bottom) => {
    const width = boardSize.width * view.scale, height = boardSize.height * view.scale;
    return spatialIndex.query({
      minX: (left - view.x) / width, minY: (top - view.y) / height,
      maxX: (right - view.x) / width, maxY: (bottom - view.y) / height,
    }).some(({ item }) => (
      item && !['connector', 'stroke', 'frame'].includes(item.kind)
      && !shouldOmitFromScene(item, { previewHidden: previewHiddenEffective, now: revealNow })
    ));
  }, [boardSize, spatialIndex, items, spatialRevision, previewHiddenEffective, revealNow]);
  const stageEntries = useMemo(() => {
    if (!hiddenCandidates.length || previewHiddenEffective) return visibleEntries;
    let omitted = false;
    for (let i = 0; i < visibleEntries.length; i++) {
      const item = visibleEntries[i]?.item;
      if (!item || shouldOmitFromScene(item, { previewHidden: previewHiddenEffective, now: revealNow })) {
        omitted = true;
        break;
      }
    }
    return omitted
      ? visibleEntries.filter(({ item }) => item && !shouldOmitFromScene(item, { previewHidden: previewHiddenEffective, now: revealNow }))
      : visibleEntries;
  }, [visibleEntries, previewHiddenEffective, revealNow, hiddenCandidates]);
  const portfolioEntries = useMemo(() => { if (!portfolioViewing) return stageEntries; const ids = new Set(presentationPage?.objectIds || []); return stageEntries.filter(entry => ids.has(entry.id)); }, [stageEntries, portfolioViewing, presentationPage]);
  const pendingEntrance = useMemo(() => portfolioViewing ? new Set(animationGroups(presentationPage, items).slice(cursor?.frameId === presentationPage?.frameId ? cursor?.step || 0 : 0).flatMap(g => g.ids).filter(id => ['fade', 'slide-up', 'slide-left', 'zoom'].includes(items[id]?.animation?.effect))) : null, [portfolioViewing, presentationPage, cursor, items]);
  const usesOverview = useMemo(() => portfolioEntries.some(({ item }) => Boolean(item.runtimeRole) || !['shape', 'stroke', 'connector'].includes(item.kind)), [portfolioEntries, items[selectedItemId]?.renderMode]);
  const representationScale = usesOverview ? overviewScale(zoomingActive ? (camera.detailScale ?? camera.scale) : Math.min(camera.scale, camera.detailScale ?? camera.scale)) : 1;
  const selectedObjectIdsKey = selectedItemIds.filter(id => Boolean(items[id])).join('|');
  const selectedObjectIds = useMemo(() => selectedItemIds.filter(id => Boolean(items[id])), [selectedObjectIdsKey]);
  const selectedObjectIdSet = useMemo(() => (selectedObjectIds.length ? new Set(selectedObjectIds) : EMPTY_ID_SET), [selectedObjectIds]);
  const domSelection = useMemo(() => (selectedObjectIdSet.size > 0 && selectedObjectIdSet.size <= 64 ? selectedObjectIdSet : EMPTY_ID_SET), [selectedObjectIdSet]);
  const styledDomIds = useMemo(() => {
    const candidates = [];
    for (const [id, item] of styledCandidates) {
      if (!item || item.kind === 'stroke' || !hasAdvancedStyle(item)) continue;
      candidates.push(String(id));
    }
    if (!candidates.length) return EMPTY_ID_SET;
    const maxStaticStyled = 24;
    if (candidates.length <= maxStaticStyled) return new Set(candidates);
    const ids = new Set();
    for (let i = candidates.length - maxStaticStyled; i < candidates.length; i++) {
      ids.add(candidates[i]);
    }
    return ids;
  }, [styledCandidates]);
  const visibilityDomIds = useMemo(() => {
    let ids = null;
    for (const [id, item] of hiddenCandidates) {
      if (item && shouldUseVisibilityDom(item, { previewHidden: previewHiddenEffective, now: revealNow })) {
        if (!ids) ids = new Set();
        ids.add(String(id));
      }
    }
    return ids || EMPTY_ID_SET;
  }, [hiddenCandidates, previewHiddenEffective, revealNow]);
  const sceneDomIds = useMemo(() => {
    if (!liveContentIds.length && !domSelection.size && !styledDomIds.size && !visibilityDomIds.size && !pendingEntrance?.size && editingId == null && connectionStartId == null) {
      return EMPTY_ID_SET;
    }
    return new Set([...liveContentIds, ...domSelection, ...styledDomIds, ...visibilityDomIds, ...(pendingEntrance || []), editingId, connectionStartId].filter(Boolean));
  }, [domSelection, styledDomIds, visibilityDomIds, pendingEntrance, editingId, connectionStartId, liveContentIds]);
  const sceneModelRef = useRef(null); if (!sceneModelRef.current) sceneModelRef.current = new SceneViewModel();
  const sceneModel = sceneModelRef.current.update(portfolioEntries, items, boardSize, representationScale, sceneDomIds, selectedObjectIdSet, spatialIndex.stats.boundsCalculated, spatialIndex, 'high');
  if (sceneRef.current) { sceneRef.current.__agoraSceneStats = sceneModel.stats; sceneRef.current.__agoraContentCacheStats = objectContentCacheStats; sceneRef.current.__agoraSpatialStats = spatialIndex.stats; }
  const depthLayers = useMemo(() => {
    const raw = sceneModel.depthLayers;
    if (!styledDomIds.size && !visibilityDomIds.size && !pendingEntrance?.size) return raw;
    const domOverrideIds = new Set([...styledDomIds, ...visibilityDomIds, ...(pendingEntrance || [])]);
    return raw.map((layer) => {
      const removedVec = [];
      const removedInk = [];
      for (const id of domOverrideIds) {
        if (layer.vectors?.[id]) removedVec.push(id);
        if ((visibilityDomIds.has(id) || pendingEntrance?.has(id)) && layer.inkItems?.[id]) removedInk.push(id);
      }
      if (!removedVec.length && !removedInk.length) return layer;
      const nextVectors = removedVec.length ? changeItems(layer.vectors, null, removedVec) : layer.vectors;
      const nextInkItems = removedInk.length ? changeItems(layer.inkItems, null, removedInk) : layer.inkItems;
      return { ...layer, vectors: nextVectors, inkItems: nextInkItems };
    });
  }, [sceneModel.depthLayers, styledDomIds, visibilityDomIds, pendingEntrance]);
  // Consecutive depths without ink or persistent DOM share one vector renderer
  // (see depthRenderGroups.js); selection-only DOM never splits a group.
  const renderGroupCacheRef = useRef(null); if (!renderGroupCacheRef.current) renderGroupCacheRef.current = new Map();
  const renderGroups = useMemo(() => {
    const persistent = new Set([...liveContentIds, ...styledDomIds, ...visibilityDomIds, ...(pendingEntrance || [])].map(String));
    return buildDepthRenderGroups(depthLayers, (id, item) => persistent.has(id) || needsVectorDom(id, item, EMPTY_ID_SET, null, null, boardSize, representationScale, 'high'), renderGroupCacheRef.current);
  }, [depthLayers, liveContentIds, styledDomIds, visibilityDomIds, pendingEntrance, boardSize, representationScale]);
  const blurBudgetRef = useRef(null);
  const blurBudgetIds = useMemo(() => {
    if (!styledDomIds.size) { blurBudgetRef.current = null; return null; }
    let totalDom = 0;
    const candidates = [];
    for (let i = 0; i < depthLayers.length; i++) {
      const domObjs = depthLayers[i].domObjects;
      totalDom += domObjs.length;
      for (let j = 0; j < domObjs.length; j++) {
        const [id, item] = domObjs[j];
        if (!item || !styledDomIds.has(String(id))) continue;
        const fxList = readObjectStyle(item).effects;
        if (fxList?.some((fx) => fx.enabled !== false && fx.type === 'background-blur' && fx.blur > 0)) {
          const area = (Number(item.width) || 0.2) * (Number(item.height) || 0.14);
          candidates.push({ id: String(id), area, frame: item.kind === 'frame' });
        }
      }
    }
    const denseDom = totalDom > 24;
    const maxBlur = denseDom ? 2 : 8;
    const oversized = denseDom && candidates.some((c) => c.frame || c.area > 0.18);
    if (candidates.length <= maxBlur && !oversized) { blurBudgetRef.current = null; return null; }
    const allowed = new Set();
    if (editingId != null && styledDomIds.has(String(editingId))) allowed.add(String(editingId));
    for (const id of selectedObjectIdSet) {
      if (allowed.size >= maxBlur) break;
      if (styledDomIds.has(id)) allowed.add(id);
    }
    for (let i = candidates.length - 1; i >= 0 && allowed.size < maxBlur; i--) {
      const c = candidates[i];
      if (denseDom && (c.frame || c.area > 0.18)) continue;
      allowed.add(c.id);
    }
    const prev = blurBudgetRef.current;
    if (prev && prev.size === allowed.size) {
      let same = true;
      for (const id of allowed) if (!prev.has(id)) { same = false; break; }
      if (same) return prev;
    }
    blurBudgetRef.current = allowed;
    return allowed;
  }, [depthLayers, styledDomIds, selectedObjectIdSet, editingId]);
  const vectorHitOrder = sceneModel.hitOrder;
  const hasSingleSelection = selectedObjectIds.length === 1;
  const primarySelectedItemId = selectedObjectIdSet.has(String(selectedItemId)) ? String(selectedItemId) : selectedObjectIds[selectedObjectIds.length - 1] || null;
  const copySelectionStyle = () => {
    const sourceId = primarySelectedItemId || selectedObjectIds[0];
    const source = itemsRef.current[sourceId];
    if (!source) return false;
    const bundle = extractStyleBundle(source);
    if (!bundle) return false;
    setCopiedStyle(bundle);
    saveCopiedStyle(bundle);
    setToast(ui('스타일을 복사했습니다 (Alt+Ctrl+V로 적용)'));
    return true;
  };
  const pasteSelectionStyle = () => {
    const bundle = copiedStyle || loadCopiedStyle();
    if (!bundle || !selectedObjectIds.length) return false;
    const ok = patchEditableObjects(selectedObjectIds, (previous) => applyStyleBundlePatch(previous, bundle));
    if (ok) setToast(ui('{count}개 객체에 스타일을 적용했습니다.', { count: selectedObjectIds.length }));
    return ok;
  };
  const styleShortcutsRef = useRef({});
  styleShortcutsRef.current = { copySelectionStyle, pasteSelectionStyle };
  const selectedTable = hasSingleSelection && items[primarySelectedItemId]?.kind === 'table' ? items[primarySelectedItemId] : null;
  const selectedItem = hasSingleSelection ? items[primarySelectedItemId] : null;
  const selectedConnector = selectedItem?.kind === 'connector' ? selectedItem : null;
  const selectedArrow = selectedItem?.kind === 'shape' && selectedItem.shapeType === 'arrow' ? selectedItem : null;
  const connectorToEdit = activeTool === 'connect' ? null : selectedConnector;
  const selectedGroupIds = useMemo(() => new Set(selectedObjectIds.map((id) => items[id]?.groupId).filter(Boolean)), [selectedObjectIds, items]);
  const selectionIsSingleGroup = selectedObjectIds.length > 0 && selectedGroupIds.size === 1
    && selectedObjectIds.every((id) => items[id]?.groupId === [...selectedGroupIds][0]);
  const changeSelectionGroup = (shouldGroup) => {
    if (selectedObjectIds.some(id => isObjectLocked(itemsRef.current[id]) || !canWriteItem(itemsRef.current[id]))) { setToast(OBJECT_LOCK_MESSAGE); return; }
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
    if (!canWriteItem(itemsRef.current[id])) { setToast(WRITE_DENIED); return; }
    if (isObjectLocked(itemsRef.current[id])) { setToast(OBJECT_LOCK_MESSAGE); return; }
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
  const [objectHighlights, setObjectHighlights] = useState(() => new Set());
  const [highlightPulse, setHighlightPulse] = useState(null);
  useEffect(() => {
    if (!highlightPulse) return;
    const timer = setTimeout(() => setHighlightPulse(null), 2200);
    return () => clearTimeout(timer);
  }, [highlightPulse]);

  function highlightObject(id, mode) {
    const key = String(id);
    const item = itemsRef.current[key];
    if (!item || !canUseItem(item, accessRef.current, 'read') || isObjectInvisibleAtTime(item, Date.now())
        || item.kind === 'channel') return;
    if (mode === 'toggle') {
      setObjectHighlights(previous => {
        const next = new Set(previous);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    } else {
      setHighlightPulse({ id: key, key: createId() });
    }
    if (mode === 'agent') focusCanvasObject(key, { select: false });
  }

  const focusCanvasObject = (id, { select = true } = {}) => {
    const target = itemsRef.current[String(id)];
    const board = boardRef.current?.getBoundingClientRect();
    if (!target || !board) return;
    const bounds = objectBounds(target, itemsRef.current, boardSize.width, boardSize.height);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    if (select) {
      finishEditing(editingId);
      setActiveTool('select');
      selectItems([String(id)], String(id));
    }
    cancelCameraMotionRef.current();
    setCamera((current) => ({
      ...current,
      x: board.width / 2 - centerX * boardSize.width * current.scale,
      y: board.height / 2 - centerY * boardSize.height * current.scale,
    }));
  };
  const selectHiddenObject = (id) => {
    setPreviewHiddenObjects(true);
    focusCanvasObject(id);
  };
  const navigatePersonalAnchor = anchor => {
    if (anchor.type === 'objects') {
      const ids = anchor.objectIds.filter(id => itemsRef.current[id]); if (ids.length !== anchor.objectIds.length) { setToast(ui('대상 객체를 찾을 수 없습니다.')); return; }
      const board = boardRef.current?.getBoundingClientRect(); if (!board || !ids.length) return; const bounds = ids.map(id => objectBounds(itemsRef.current[id], itemsRef.current, boardSize.width, boardSize.height)); const x = (Math.min(...bounds.map(b => b.minX)) + Math.max(...bounds.map(b => b.maxX))) / 2, y = (Math.min(...bounds.map(b => b.minY)) + Math.max(...bounds.map(b => b.maxY))) / 2; finishEditing(editingId); setActiveTool('select'); selectItems(ids, ids[0]); cancelCameraMotionRef.current(); setCamera(current => ({ ...current, x: board.width / 2 - x * boardSize.width * current.scale, y: board.height / 2 - y * boardSize.height * current.scale })); return;
    }
    if (anchor.type === 'object') { if (itemsRef.current[anchor.objectId]) focusCanvasObject(anchor.objectId); else setToast(ui('대상 객체를 찾을 수 없습니다.')); return; }
    const board = boardRef.current?.getBoundingClientRect(); if (!board) return; cancelCameraMotionRef.current(); setCamera(current => ({ ...current, x: board.width / 2 - (anchor.x + boardSize.width / 2) * current.scale, y: board.height / 2 - (anchor.y + boardSize.height / 2) * current.scale }));
  };
  const focusConnectorTarget = (connectorId, connector) => {
    if (activeTool === 'select') focusCanvasObject(connector.to);
  };
  const sendSingleSettingsRequest = (field, value, participant) => new Promise((resolve, reject) => {
    const current = canvasSettingsRef.current;
    if (!current) { reject(new Error('설정 변경을 처리 중입니다. 잠시 후 다시 시도하세요.')); return; }
    const expected_revision = (current.settings_revision ?? 0) + settingsRequestsRef.current.size;
    const request_id = createId(), payload = { type: 'canvas_settings_update', request_id, expected_revision, field };
    if (participant) Object.assign(payload, participant); else payload.value = value;
    const timer = setTimeout(() => { settingsRequestsRef.current.delete(request_id); if (!settingsRequestsRef.current.size) setSettingsPending(false); reject(new Error('설정 응답을 확인하지 못했습니다. 최신 상태를 확인하세요.')); }, 20000);
    settingsRequestsRef.current.set(request_id, { resolve: nextSettings => { if (nextSettings) canvasSettingsRef.current = nextSettings; resolve(nextSettings); }, reject, timer });
    if (sendRaw(payload)) { if (field !== 'participant_groups') setSettingsPending(true); } else { clearTimeout(timer); settingsRequestsRef.current.delete(request_id); reject(new Error('캔버스 연결을 확인하세요.')); }
  });
  const requestSettings = (field, value, participant) => sendSingleSettingsRequest(field, value, participant);
  const sendSettings = (field, value, participant) => { requestSettings(field, value, participant).catch(() => {}); };

    const { cancelStageGesture, pointerPosition, startPan, cancelPanInertia, centeredItemPosition, hideCursor, sendCursorPosition, startZoomHold, stopZoomHold, cancelZoomHold, clickZoom, startDrawing, moveDrawing, stopDrawing } = useCanvasStageInteractions({
      canCreateProject: accessRef.current?.is_admin === true, presentation: portfolioViewing && Boolean(presentationPage?.frameId), canWriteItem, canWriteCanvas, isItemSelectable: (item) => previewHiddenEffective || !isObjectInvisibleAtTime(item),
      boardRef, camera, setCamera, activeTool, eraserRef, eraserCursorRef, itemsRef, boardSize, eraserWidth, eraserMode,
      addItem, setToast, setItems, patchItems, refreshSpatialIndex, spatialIndexRef,
      sendStrokeFrameChanges, pendingItemChangesRef, strokeSaveFlushRef,
      lastCursorSentAtRef, peerMeshRef, panRef, zoomHoldRef, zoomPointerPressRef, zoomSensitivity,
      stageWheelHandlerRef, laserDrawingRef, laserColor, setLaserStrokes, selectionRef, selectedItemIds,
      setSelectionBox, setCreationBox, selectItems, canvasSnapshotLoadedRef: hostReadyRef, finishEditing, setConnectionStartId,
      spacePressedRef, user, userGroupTemplateRef, tableConfig, permission, setSharePosition, shapeType, shapeArrowStartHead, shapeArrowHeadSize,
      shapeArrowEndHead, shapeFillColor, shapeFillOpacity, shapeSketchFillOpacity, shapeVertexCount, shapeCornerStyle, shapeVisualStyle, shapeStrokeEnabled, shapeBorderWidth, color, noteColor, setActiveTool, startEditing, strokeWidth, penBrush, penOpacity,
      drawingRef, drawingSessionRef, draftRef, vectorDraftRef,
    });
    cancelCameraMotionRef.current = cancelPanInertia;
    const stopUndoGestureRef = useRef(cancelStageGesture);
    stopUndoGestureRef.current = cancelStageGesture;
    const undoCanvas = useCallback((options) => {
      if (watchingRef.current) return false;
      // Finish and flush live ink first; otherwise the next pointer frame can
      // recreate a stroke that Ctrl+Z has just removed.
      if (drawingRef.current || eraserRef.current) stopUndoGestureRef.current({});
      strokeSaveFlushRef.current?.({ force: true });
      return undo(options);
    }, [undo]);
    const placeSharedLink = (shared) => {
      if (!sharePosition) return;
      const isVideo = shared.mediaType === 'youtube' || shared.mediaType === 'video';
      const defaultWidth = isVideo ? 0.36 : 0.3;
      const defaultHeight = isVideo ? 0.36 : 0.15;
      const draggedBounds = sharePosition.bounds;
      const width = draggedBounds ? draggedBounds.width : defaultWidth;
      const height = draggedBounds ? draggedBounds.height : defaultHeight;
      const x = draggedBounds ? draggedBounds.x : sharePosition.x - width / 2;
      const y = draggedBounds ? draggedBounds.y : sharePosition.y - height / 2;
      const media = { ...shared };
      delete media.defaultTitle;
      const id = createId();
      const item = {
        kind: 'link',
        ...media,
        ...initialVideoFields(media),
        x,
        y,
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
    const insertUserGroup = useCallback((definition) => {
      if (!canWriteCanvas) return;
      const id = createId();
      const width = 0.3;
      const height = 0.2;
      const pos = centeredItemPosition(width, height);
      const item = {
        kind: 'user-group',
        groupTitle: definition?.groupTitle || '사용자 그룹',
        members: Array.isArray(definition?.members) && definition.members.length > 0
          ? definition.members
          : (user?.user_id != null ? [groupMember(user)] : []),
        shadowEnabled: false,
        ...(definition?.groupColor ? { groupColor: definition.groupColor } : {}),
        x: pos.x,
        y: pos.y,
        width,
        height,
        permission,
      };
      if (addItem(id, item)) {
        setActiveTool('select');
        selectItems([id]);
      } else {
        setToast(ui('연결이 복구되면 사용자 그룹을 다시 추가해주세요.'));
      }
    }, [canWriteCanvas, centeredItemPosition, user, permission, addItem, setActiveTool, selectItems, setToast]);
    const uploadSheet = useSheetUpload({ canvasId, permission, addItem, centeredItemPosition, createId, setActiveTool, selectItems, setToast });
    const uploadPdf = usePdfUpload({ canvasId, token, permission, addItem, centeredItemPosition, createId, setActiveTool, selectItems, setToast, beginUpload });
    const uploadMedia = useMediaUpload({ canvasId, token, permission, addItem, centeredItemPosition, createId, setActiveTool, selectItems, setToast });
    const uploadImage = async (event, options = {}) => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (!file) return;
      if (mediaFileType(file)) return uploadMedia({ target: { files: [file], value: '' } }, options);
      const reportError = options.onError ?? setToast;
      if (!canvasImageFile(file)) { reportError('PNG·JPG·WebP·BMP·AVIF 이미지를 선택해주세요.'); return; }
      const upload = beginUpload(file.name);
      try {
        const body = new FormData();
        body.append('file', file);
        const resource = await api(`/api/canvases/${encodeURIComponent(canvasId)}/media`, {
          method: 'POST', body, token, requireCanvasTransport: true, canContinue: options.canInsert, onUploadProgress: upload.onUploadProgress,
        });
        if (resource?.mediaType !== 'image' || !resource.url) throw Error(ui('이미지 파일만 올릴 수 있어요.'));
        const src = resource.url;
        const id = createId();
        if (options.canInsert?.() === false) return;
        const position = options.position ? { x: options.position.x - .15, y: options.position.y - .1 } : centeredItemPosition(0.3, 0.2);
        if (!addItem(id, { kind: 'image', src, filename: file.name, ...position, width: 0.3, permission })) { reportError('실시간 서버에 연결된 뒤 이미지를 공유할 수 있어요.'); return; }
        setActiveTool('select'); selectItems([id]);
        if (!options.onError) setToast('이미지를 캔버스에 추가했습니다.');
        return id;
      } catch (error) {
        if (error.name !== 'AbortError') reportError(error.message || '이미지를 업로드하지 못했습니다.');
      } finally { upload.finish(); }
    };
    const uploadChatMedia = async (file) => {
      const check = validateChatMediaFile(file);
      if (!check.ok) throw new Error(ui(check.error));
      const body = new FormData();
      body.append('file', file);
      const resource = await api(`/api/canvases/${encodeURIComponent(canvasId)}/media`, { method: 'POST', body, token });
      const url = resource?.url || resource?.src || '';
      if (!url) throw new Error(ui('미디어를 업로드하지 못했습니다.'));
      return { url, mediaType: check.mediaType };
    };
    const submitMessage = (event, textOverride) => {
      event?.preventDefault();
      const text = (typeof textOverride === 'string' ? textOverride : message).trim();
      if (new TextEncoder().encode(text).length > 4096) { setToast('메시지는 UTF-8 기준 4096바이트 이하여야 합니다.'); return false; }
      if (!text || !sendRaw({ type: 'chat', ...chatTarget(activeChatChannelRef.current), text, request_id: createId() })) return false;
      setMessage('');
      return true;
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
      frameMemberIds: id => frameStore.getSnapshot().find(frame => frame.id === id)?.objectIds || [], canWriteItem, snapToGrid, gridSpacing,
      moveItems, flushMoves, beginObjectMove, previewObjectMove, finishObjectMove,
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
      vectorDragRef,
    });
    const touchNavigation = useCanvasTouchNavigation({
      boardRef, setCamera, onStart: point => {
        cancelPanInertia();
        if (dragRef.current) stopObjectDrag({ ...point, pointerId: dragRef.current.pointerId, type: 'pointercancel', currentTarget: boardRef.current, target: dragRef.current.captureElement });
        cancelStageGesture(point);
        hideCursor();
      }
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
    useEffect(() => {
      const editingTarget = event => {
        const id = editingIdRef.current, target = event.target;
        return id != null && isCollaborativeItem(itemsRef.current[id])
          && target.closest?.('.canvas-object')?.dataset.itemId === String(id)
          && target.closest?.('.inline-content-input,.sticky-note-input,.canvas-code-editor') ? String(id) : null;
      };
      const onUndo = event => {
        if (event.isComposing || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'z') return;
        const id = editingTarget(event);
        if (id !== null) { event.preventDefault(); event.stopImmediatePropagation(); if (!event.repeat) undo({ itemId: id, textOnly: true }); return; }
        if (editingIdRef.current != null || dragRef.current || event.target.closest?.('input,textarea,select,[contenteditable="true"],.monaco-editor,[role="dialog"],.canvas-management-dialog,.canvas-as-code-overlay')) return;
        event.preventDefault(); if (!event.repeat) undoCanvas();
      };
      const onNativeUndo = event => {
        if (event.inputType !== 'historyUndo' || event.isComposing) return;
        const id = editingTarget(event); if (id === null) return;
        event.preventDefault(); event.stopImmediatePropagation(); undo({ itemId: id, textOnly: true });
      };
      window.addEventListener('keydown', onUndo, true); window.addEventListener('beforeinput', onNativeUndo, true);
      return () => { window.removeEventListener('keydown', onUndo, true); window.removeEventListener('beforeinput', onNativeUndo, true); };
    }, [undo, undoCanvas]);
    useCodeExecutionShortcut({ canExecuteItem, selectedIds: selectedObjectIds, selectedIdsRef, itemsRef, editingId, editingIdRef, sessionRef: hostSessionRef, dragRef, store: runtimeStore, multiAgentStore, onMessage: setToast });
    useCanvasKeyboardNudge({ canWriteItem, activeTool, editingId, selectedIds: selectedObjectIds, itemsRef, sessionRef: hostSessionRef, dragRef, moveItems, flushMoves });
    useEffect(() => {
      const isEditableTarget = (target) => target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      const onDeleteKeyDown = (event) => {
        if (!hostSessionRef.current.editable) return;
        if (event.target.closest?.('.canvas-as-code-overlay, .canvas-management-dialog')) return;
        if (event.repeat) return;
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (event.altKey && (event.ctrlKey || event.metaKey) && editingId == null && !isEditableTarget(target)) {
          if (event.code === 'KeyC' || event.key.toLowerCase() === 'c') {
            event.preventDefault();
            event.stopPropagation();
            styleShortcutsRef.current.copySelectionStyle?.();
            return;
          }
          if (event.code === 'KeyV' || event.key.toLowerCase() === 'v') {
            event.preventDefault();
            event.stopPropagation();
            styleShortcutsRef.current.pasteSelectionStyle?.();
            return;
          }
        }
        if (event.key !== 'Delete' && event.key !== 'Backspace') return;
        if (target?.closest('.canvas-code-editor, .code-shared-input, .code-filename-input, .code-language-select')) return;
        if (editingId != null || isEditableTarget(target) || !selectedObjectIds.length) return;
        event.preventDefault();
        const remainingIds = [];
        const deletableIds = [];
        for (const id of selectedObjectIds) {
          if (!previewHiddenEffective && itemsRef.current[id] && isObjectInvisibleAtTime(itemsRef.current[id])) {
            remainingIds.push(id);
            continue;
          }
          deletableIds.push(id);
        }
        if (deletableIds.length) {
          const result = deleteItems(deletableIds, { silent: true });
          for (const id of result.remaining) remainingIds.push(id);
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
          boardRef.current?.classList.add('space-panning');
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
      const clearSpacePanning = () => {
        spacePressedRef.current = false;
        boardRef.current?.classList.remove('space-panning');
      };
      const onKeyUp = (event) => { if (event.code === 'Space') clearSpacePanning(); };
      document.addEventListener('keydown', onDeleteKeyDown, true);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', clearSpacePanning);
      return () => { document.removeEventListener('keydown', onDeleteKeyDown, true); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', clearSpacePanning); };
    }, [connectionStartId, deleteItems, editingId, finishEditing, previewHiddenEffective, saveCollaborativeItem, selectItems, selectedObjectIdsKey, selectedItemId]);
    useEffect(() => {
      const onBeforeUnload = (event) => {
        const session = hostSessionRef.current;
        const queued = (session?.flight?.operations?.length || 0) + (session?.queue?.length || 0);
        if (queued > 512) {
          event.preventDefault();
          event.returnValue = '';
        }
      };
      window.addEventListener('beforeunload', onBeforeUnload);
      return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, []);
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
    const canvasCodeApi = useCanvasAsCode({ canWriteItem, canWriteCanvas, canvasId, itemsRef, committedItemsRef, canvasSnapshotLoadedRef: hostReadyRef, permission, addItem, deleteItem, deleteItems, updateCollaborativeText, replaceTextColors, saveCollaborativeItem, sendItemChange, setItems, markItemDirty, refreshSpatialIndex, selectItems, peerMeshRef, syncClockRef, syncActorRef, itemSyncVersionsRef, getCollaborativeDoc });
    const selectCanvasTool = (tool) => {
      if (!canWriteCanvas && !(['select', 'hand', 'laser', 'anchor'].includes(tool))) { setToast(WRITE_DENIED); return; }
      if (tool === 'hand') finishEditing();
      if (tool === 'connect') setConnectionStartId(null);
      setActiveTool(tool);
    };
    const clipboardBlocked = Boolean(watchState.watching_id) || !hostStatus.editable || editingId != null || showSettings || showParticipants || showCanvasCode || showVersions || sharePosition != null;
    const objectClipboard = useObjectClipboard({
      canvasId, boardRef, itemsRef, spatialIndex, selectedIds: selectedObjectIds,
      permission, pointerPosition, canvasSnapshotLoadedRef: hostReadyRef, addItem, addItems, deleteItem, deleteItems, saveCollaborativeItem,
      pasteBackpressure: () => hostSessionRef.current.queuedBytes > 2 * 1024 * 1024 || hostSessionRef.current.pendingOperations.length > 1024,
      canPaste: canWriteCanvas, uploadMedia, uploadImage, uploadPdf, uploadSheet,
      uploadNotebookFile: (file, options) => uploadNotebookFile(file, { canvasId, token, ...options }),
      isInteracting: () => Boolean(dragRef.current || panRef.current || drawingRef.current || selectionRef.current || eraserRef.current),
      selectItems, setActiveTool, setConnectionStartId, setToast, blocked: clipboardBlocked
    });
    runtimeStore.focusCanvasObject = focusCanvasObject;
    runtimeStore.notebookCellItems = id => {
      const root = itemsRef.current[String(id)];
      if (!root || root.runtimeRole !== 'notebook' || !Array.isArray(root.notebookCellIds)) return [];
      return root.notebookCellIds.map(objectId => ({ id: objectId, item: itemsRef.current[objectId] })).filter(entry => entry.item?.runtimeRole === 'notebook-cell' && entry.item.notebookId === String(id));
    };
    runtimeStore.notebookStructure = (id, action) => {
      const root = itemsRef.current[String(id)];
      if (!root || root.runtimeRole !== 'notebook' || !hostSessionRef.current.editable || !canWriteItem(root) || root.locked) return false;
      const linked = Array.isArray(root.notebookCellIds), oldIds = linked ? root.notebookCellIds : [];
      const current = linked ? oldIds.map(objectId => { const child = itemsRef.current[objectId]; return child?.runtimeRole === 'notebook-cell' && child.notebookId === String(id) ? { objectId, item: child, cell: child.notebookCell, result: child.notebookResult } : null; }).filter(Boolean)
        : (root.notebookCells || []).map(cell => { const objectId = notebookCellObjectId(id, cell.id), child = itemsRef.current[objectId]; return { objectId, item: child?.runtimeRole === 'notebook-cell' && child.notebookId === String(id) ? child : null, cell, result: root.notebookResults?.[cell.id] }; });
      let next = current;
      if (action?.type === 'add') {
        if (current.length >= NOTEBOOK_LIMIT || !validNotebookCells([...current.map(entry => entry.cell), action.cell])) return false;
        next = [...current, { cell: action.cell, ...(action.cellObjectId ? { objectId: String(action.cellObjectId) } : {}) }];
      } else if (action?.type === 'replace') {
        if (!validNotebookCells(action.cells)) return false;
        next = action.cells.map(cell => ({ cell }));
      } else if (action?.type === 'delete') {
        next = current.filter(entry => entry.objectId !== String(action.cellObjectId));
        if (next.length === current.length) return false;
      } else if (action?.type === 'move') {
        const index = current.findIndex(entry => entry.objectId === String(action.cellObjectId)), target = index + Number(action.direction || 0);
        if (index < 0 || target < 0 || target >= current.length) return false;
        next = current.slice();[next[index], next[target]] = [next[target], next[index]];
      } else if (!['migrate', 'clear-results'].includes(action?.type)) return false;
      const rootNext = { ...root, ...(action.type === 'replace' ? action.source : undefined), groupId: String(id), height: .18, notebookCellIds: [] }; delete rootNext.notebookCells; delete rootNext.notebookResults;
      const changes = { [String(id)]: rootNext }, keep = new Set();
      for (let index = 0; index < next.length; index++) {
        const entry = next[index], cell = entry.cell; let objectId = entry.objectId;
        if (!objectId) objectId = createId();
        const collision = itemsRef.current[objectId];
        if (collision && !(collision.runtimeRole === 'notebook-cell' && collision.notebookId === String(id) && collision.notebookCell?.id === cell.id)) objectId = createId();
        const existing = entry.item || itemsRef.current[objectId];
        let cellItem = existing?.runtimeRole === 'notebook-cell' && existing.notebookId === String(id)
          ? { ...existing, notebookCell: cell, notebookId: String(id), groupId: rootNext.groupId, permission: rootNext.permission, x: Number(rootNext.x) || 0, y: (Number(rootNext.y) || 0) + rootNext.height + .025 + index * .255, width: Number(rootNext.width) || .48, height: .235 }
          : notebookCellItem(String(id), rootNext, cell, index, entry.result, objectId).item;
        if (action?.type === 'clear-results' || action?.type === 'replace' && !entry.result) delete cellItem.notebookResult;
        changes[objectId] = cellItem; keep.add(objectId); rootNext.notebookCellIds.push(objectId);
      }
      const removed = [...new Set([...oldIds, ...current.filter(entry => entry.item).map(entry => entry.objectId)])].filter(objectId => objectId && !keep.has(objectId));
      return patchItems(changes, removed, { history: !['migrate', 'clear-results'].includes(action.type) });
    };
    runtimeStore.importNotebookFile = async (id, file, signal) => {
      const canContinue = () => {
        const current = itemsRef.current[id];
        return !signal?.aborted && hostSessionRef.current.editable && current?.runtimeRole === 'notebook' && !current.locked && canWriteItem(current);
      };
      if (!canContinue()) throw Error(ui('노트북 셀 변경을 저장하지 못했습니다.'));
      const { src, filename, notebookCells } = await uploadNotebookFile(file, { canvasId, token, canContinue });
      if (!canContinue()) return;
      const accepted = notebookCells
        ? runtimeStore.notebookStructure(id, { type: 'replace', cells: notebookCells, source: { src, filename } })
        : patchItems({ [id]: { ...itemsRef.current[id], src, filename } });
      if (!accepted) throw Error(ui('노트북 셀 변경을 저장하지 못했습니다.'));
      return { editable: Boolean(notebookCells) };
    };
    runtimeStore.fetchNotebookFile = src => fetchNotebookFile(src, token);
    runtimeStore.notebook = async (id, { operation, code, cellId, cellObjectId }) => {
      const previous = itemsRef.current[id]; if (!previous || previous.runtimeRole !== 'notebook' || !canExecuteItem(previous)) throw Error(ui('이 그룹에는 실행 권한이 없습니다.'));
      if (operation === 'prepare' && (!canWriteCanvas || !canWriteItem(previous))) throw Error(ui('이 그룹에는 실행 환경을 변경할 권한이 없습니다.'));
      const active = previous.runtimeState; if (active?.running && Date.now() - active.updatedAt < runtimeStateTtl(previous, active)) throw Error(ui('노트북 실행 중…'));
      const childEntry = cellId && Array.isArray(previous.notebookCellIds)
        ? previous.notebookCellIds.map(objectId => [objectId, itemsRef.current[objectId]]).find(([, child]) => child?.runtimeRole === 'notebook-cell' && child.notebookId === String(id) && child.notebookCell?.id === cellId)
        : null;
      const executionObjectId = cellObjectId || childEntry?.[0] || id;
      const executionObject = itemsRef.current[executionObjectId];
      if (operation === 'execute' && cellId && Array.isArray(previous.notebookCellIds) && (!childEntry || executionObjectId !== childEntry[0] || !canExecuteItem(executionObject))) throw Error(ui('이 셀을 실행할 권한이 없습니다.'));
      saveRuntimeStateRef.current(id, { running: true, status: 'running', phase: operation, language: 'python', detail: cellId || operation });
      try {
        const result = await executeCanvasCode({ canvasId, token, user, action: 'notebook', operation, objectId: executionObjectId, notebookId: id, cellId, code, sendRaw, pendingRequests: runtimeSocketRequestsRef.current });
        const current = itemsRef.current[id];
        if (current && canExecuteItem(current) && cellId) {
          const entry = { outputs: result.outputs || [], executionCount: result.executionCount ?? null, exitCode: result.exitCode ?? 1, ...(result.error ? { error: result.error } : {}), ...(result.truncated ? { truncated: true } : {}) };
          if (Array.isArray(current.notebookCellIds)) {
            if (!childEntry || !canExecuteItem(childEntry[1])) throw Error(ui('이 셀을 실행할 권한이 없습니다.'));
            if (JSON.stringify(entry).length > 524288) throw Error(ui('셀 출력이 너무 큽니다. 출력을 지운 뒤 다시 실행하세요.'));
            patchItems({ [childEntry[0]]: { ...childEntry[1], notebookResult: entry } }, [], { history: false });
          } else {
            const notebookResults = { ...(current.notebookResults || {}), [cellId]: entry };
            if (JSON.stringify(notebookResults).length > 524288) throw Error(ui('노트북 출력이 너무 큽니다. 출력 일부를 지운 뒤 다시 실행하세요.'));
            patchItems({ [id]: { ...current, notebookResults } }, [], { history: false });
          }
        }
        saveRuntimeStateRef.current(id, { running: false, status: result.exitCode ? 'error' : 'success', failed: Boolean(result.exitCode), completed: true, language: 'python', ...(result.error ? { error: result.error } : {}) });
        return result;
      } catch (error) { saveRuntimeStateRef.current(id, { running: false, status: 'error', failed: true, error: error.message }); throw error; }
    };
    const legacyNotebooks = useRef(null);
    if (!legacyNotebooks.current) legacyNotebooks.current = new ItemSubset(item => item.runtimeRole === 'notebook' && Array.isArray(item.notebookCellIds));
    useEffect(() => {
      if (!hostStatus.editable) return;
      for (const [id, item] of legacyNotebooks.current.update(items)) {
        if (item?.runtimeRole !== 'notebook' || !Array.isArray(item.notebookCellIds) || item.locked || !canWriteItem(item)) continue;
        const children = item.notebookCellIds.map(childId => ({ id: childId, item: items[childId] }));
        if (children.some(entry => entry.item?.runtimeRole !== 'notebook-cell' || entry.item.notebookId !== id)) continue;
        const next = { ...item, height: Math.max(.65, Number(item.height) || 0), notebookCells: children.map(entry => entry.item.notebookCell), notebookResults: Object.fromEntries(children.filter(entry => entry.item.notebookResult).map(entry => [entry.item.notebookCell.id, entry.item.notebookResult])) };
        delete next.notebookCellIds; delete next.groupId;
        patchItems({ [id]: next }, children.map(entry => entry.id), { history: false });
      }
    }, [canvasId, hostStatus.editable, items, canWriteItem]);
    runtimeStore.connectTerminal = (objectId, request) => openTerminalSocket({ canvasId, token, user, objectId, ...request });
    getAgentAnchorRef.current = id => {
      const target = itemsRef.current[String(id)];
      return target ? { x: Number(target.x) || 0, y: Number(target.y) || 0 } : centeredItemPosition(0, 0);
    };
    saveAgentTextOutputRef.current = (id, text) => {
      const key = String(id);
      const previous = itemsRef.current[key];
      if (!hostSessionRef.current.editable || !previous || !canWriteItem(previous) || isObjectLocked(previous)) return false;
      if (isCollaborativeItem(previous)) {
        updateCollaborativeText(key, text);
        saveCollaborativeItemRef.current?.(key, { silent: true });
        return true;
      }
      return false;
    };
    multiAgentStore.focusCanvasObject = focusCanvasObject;
    multiAgentStore.openAgentPanel = agentAccess ? () => setShowAgent(true) : null;
    multiAgentStore.patchConnector = (connectorId, patch) => updateTableItem(connectorId, patch);
    multiAgentStore.startConnectorFrom = (sourceId) => {
      if (!hostSessionRef.current.editable || !canWriteCanvas) return;
      finishEditing(editingId);
      setActiveTool('connect');
      setConnectionStartId(String(sourceId));
      setToast(ui('도착 오브젝트를 선택해 연결을 완성하세요.'));
    };
    multiAgentStore.createTemplate = (orchestratorId, templateId) => {
      const root = itemsRef.current[String(orchestratorId)];
      if (!root || !isAgentOrchestratorItem(root) || !hostSessionRef.current.editable || !canWriteItem(root) || isObjectLocked(root)) return false;
      try {
        const { updatedOrchestrator, createdEntries } = buildMultiAgentTemplate(templateId, String(orchestratorId), root, root.permission || permission, createId);
        const snapInterval = activeGridInterval(snapToGrid, gridSpacing);
        const changes = { [String(orchestratorId)]: updatedOrchestrator };
        for (const { id: entryId, item } of createdEntries) {
          const placed = item.kind === 'connector' ? item : snapNewItem(item, snapInterval, boardSize);
          changes[entryId] = makeCollaborativeItem(placed);
        }
        const ok = patchItems(changes);
        if (ok) refreshSpatialIndex(Object.keys(changes));
        return ok;
      } catch (error) {
        setToast(error.message);
        return false;
      }
    };
    const panelLayout = usePanelLayout();
    const autoOpenedInspectorRef = useRef(false);
    const prevSelectionCountRef = useRef(selectedObjectIds.length);
    const syncSelectionInspector = (currentCount) => {
      const previousCount = prevSelectionCountRef.current;
      prevSelectionCountRef.current = currentCount;
      if (previousCount === 0 && currentCount > 0 && activeTool === 'select' && hostReadyRef.current) {
        if (panelLayout.isCollapsed('inspector') && panelLayout.setCollapsedState('inspector', false, { persist: false })) {
          autoOpenedInspectorRef.current = true;
        }
      } else if (currentCount === 0 && autoOpenedInspectorRef.current) {
        autoOpenedInspectorRef.current = false;
        panelLayout.setCollapsedState('inspector', true, { persist: false });
      }
    };
    syncSelectionInspectorRef.current = syncSelectionInspector;
    // Sync synchronously inside selectItems so selection and panel state commit together, with useLayoutEffect handling tool/remote changes before paint.
    useLayoutEffect(() => {
      syncSelectionInspector(selectedObjectIds.length);
    }, [selectedObjectIds.length, activeTool]);
    const baseInspectorHandle = panelLayout.handle('inspector');
    const inspectorHandle = {
      ...baseInspectorHandle,
      onToggle: () => {
        autoOpenedInspectorRef.current = false;
        baseInspectorHandle.onToggle();
      },
    };
    const personalTimerElement = useMemo(
      () => <Timer state={personalTimer} onChange={patch => setPersonalTimer(current => ({ ...current, ...patch }))} />,
      [personalTimer],
    );
    const toggleMonitoring = () => {
      if (!showMonitoring || panelLayout.isCollapsed('inspector')) {
        autoOpenedInspectorRef.current = false;
        panelLayout.setCollapsedState('inspector', false, { persist: true });
        setShowMonitoring(true);
      } else {
        setShowMonitoring(false);
      }
    };
    const closeMonitoring = useCallback(() => setShowMonitoring(false), []);
    const watch = useCanvasWatch({ canvasId, connection, sendRaw, camera, setCamera: applyCanvasCamera, boardRef, state: watchState, setState: setWatchState, onFollow: () => { setPortfolioViewing(false); setPortfolioLocked(false); finishEditing(editingIdRef.current); cancelStageGesture(); cancelPanInertia(); setShowAgent(false); setShowRuntimeSettings(false); setShowCanvasCode(false); setShowVersions(false); } });
    useEffect(() => { if (!watchState.watching_id) return; const block = event => { if (event.target.closest?.('input,textarea,[contenteditable="true"]') || event.key === 'Escape' || event.key === 'Tab') return; event.preventDefault(); event.stopImmediatePropagation(); }; window.addEventListener('keydown', block, true); return () => window.removeEventListener('keydown', block, true); }, [watchState.watching_id]);
    const canvasParticipants = useParticipantProfiles(settings?.participants, token, user);
    const { backgroundColor, setBackgroundColor, backgroundStyle } = useCanvasBackground(canvasId);
    const onlineParticipants = useMemo(() => onlineCanvasParticipants(user, peerList, canvasParticipants, connection === 'connected'), [user, peerList, canvasParticipants, connection]);
    const mentionParticipants = useMemo(() => uniqueCanvasParticipants([...canvasParticipants, ...onlineParticipants]), [canvasParticipants, onlineParticipants]);
    // Channel lists only depend on channel items. Scanning every item on each
    // drag frame or peer update cost O(N) twice per change on large canvases.
    const channelSubset = useRef(null);
    if (!channelSubset.current) channelSubset.current = new ItemSubset(item => item.kind === CHANNEL_KIND);
    const channelEntries = channelSubset.current.update(items);
    const channelItems = useMemo(() => Object.fromEntries(channelEntries), [channelEntries]);
    const channelCategories = useMemo(() => listCategories(channelItems), [channelItems]);
    const textChannels = useMemo(() => listChannels(channelItems, 'text', ui('일반')), [channelItems]);
    const voiceChannels = useMemo(() => listChannels(channelItems, 'voice', ui('일반 통화')), [channelItems]);
    // A deleted (or no longer visible) channel falls back to the default one.
    useEffect(() => {
      if (!textChannels.some(channel => channel.id === activeChatChannel)) selectChatChannel(DEFAULT_TEXT_CHANNEL);
    }, [textChannels, activeChatChannel, selectChatChannel]);
    useEffect(() => {
      if (!voiceChannels.some(channel => channel.id === voice.state.channel)) voice.call.setChannel(voiceChannels[0].id);
    }, [voiceChannels, voice]);
    const channelControls = (() => {
      const canManage = canWriteCanvas && hostStatus.editable && connection === 'connected';
      const duplicate = (list, name, except) => list.some(channel => channel.id !== except && channel.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      const syncCategoryAccess = (categoryId, channelGroups, patches) => {
        if (!categoryId) return;
        const catItem = itemsRef.current[categoryId];
        if (!isCategoryItem(catItem) || !canWriteItem(catItem)) return;
        const catGroups = normalizeObjectGroups(catItem.permission);
        const mergedCatGroups = normalizeObjectGroups([...catGroups, ...channelGroups]);
        if (mergedCatGroups.length === catGroups.length) return;
        const isAdminUser = capabilities?.is_admin === true || settings?.can_manage === true;
        const allowedGroups = new Set([...(capabilities?.member_groups || capabilities?.groups || [])]);
        if (isAdminUser || mergedCatGroups.every(group => catGroups.includes(group) || allowedGroups.has(group))) {
          patches[categoryId] = { ...catItem, permission: mergedCatGroups };
        }
      };
      return {
        text: textChannels, voice: voiceChannels, categories: channelCategories, activeText: activeChatChannel, unread: chatUnread, canManage,
        groupAccess: { settings, capabilities, defaultGroups: permission },
        selectText: selectChatChannel,
        create: (type, name, categoryId = null, accessGroups = null) => {
          const channelType = type === 'voice' ? 'voice' : 'text';
          const list = channelType === 'text' ? textChannels : voiceChannels;
          if (list.length > CHANNEL_LIMIT) { setToast(ui('채널은 종류별로 최대 50개까지 만들 수 있습니다.')); return false; }
          if (duplicate(list, name)) { setToast(ui('같은 이름의 채널이 이미 있습니다.')); return false; }
          const validCatId = categoryId && channelCategories.some(cat => cat.id === categoryId) ? categoryId : null;
          const explicitGroups = Array.isArray(accessGroups) && accessGroups.length > 0 ? normalizeObjectGroups(accessGroups) : null;
          const targetPermission = explicitGroups || permission;
          const id = newChannelId(), item = newChannel(channelType, name, targetPermission, nextChannelOrder(list), validCatId);
          if (!targetPermission.length || !canWriteItem(item)) {
            setToast(ui(explicitGroups ? '선택한 그룹에 채널을 만들 권한이 없습니다.' : WRITE_DENIED));
            return false;
          }
          const patches = { [id]: item };
          syncCategoryAccess(validCatId, targetPermission, patches);
          if (!patchItems(patches)) { setToast(ui('채널을 만들지 못했습니다. 연결 상태를 확인해주세요.')); return false; }
          if (channelType === 'text') selectChatChannel(id); else if (!voice.state.active) voice.call.setChannel(id);
          return true;
        },
        updateGroups: (id, nextGroups) => {
          const item = itemsRef.current[id];
          if (!isChannelItem(item) || !canWriteItem(item)) { setToast(WRITE_DENIED); return false; }
          const normalized = normalizeObjectGroups(nextGroups);
          if (!normalized.length) return false;
          const current = normalizeObjectGroups(item.permission);
          if (normalized.length === current.length && normalized.every((group, index) => group === current[index])) return true;
          const updated = { ...item, permission: normalized };
          if (!canWriteItem(updated)) { setToast(WRITE_DENIED); return false; }
          const patches = { [id]: updated };
          syncCategoryAccess(item.categoryId, normalized, patches);
          return patchItems(patches) !== false;
        },
        rename: (id, name) => {
          const item = itemsRef.current[id];
          if (!isChannelItem(item) || !canWriteItem(item)) { setToast(WRITE_DENIED); return false; }
          if (duplicate(item.channelType === 'text' ? textChannels : voiceChannels, name, id)) { setToast(ui('같은 이름의 채널이 이미 있습니다.')); return false; }
          return patchItems({ [id]: { ...item, name } }) !== false;
        },
        remove: id => {
          const item = itemsRef.current[id];
          if (!isChannelItem(item) || !canWriteItem(item)) { setToast(WRITE_DENIED); return; }
          if (!window.confirm(ui(item.channelType === 'text' ? '이 채팅 채널과 메시지 기록을 삭제할까요?' : '이 통화 채널을 삭제할까요? 참여 중인 사람은 기본 통화 채널로 이동합니다.'))) return;
          patchItems({}, [id]);
        },
        createCategory: name => {
          if (channelCategories.length >= CATEGORY_LIMIT) { setToast(ui('카테고리는 최대 50개까지 만들 수 있습니다.')); return false; }
          if (duplicate(channelCategories, name)) { setToast(ui('같은 이름의 카테고리가 이미 있습니다.')); return false; }
          const id = newCategoryId(), item = newCategory(name, permission, nextChannelOrder(channelCategories));
          if (!canWriteItem(item)) { setToast(WRITE_DENIED); return false; }
          if (!patchItems({ [id]: item })) { setToast(ui('카테고리를 만들지 못했습니다. 연결 상태를 확인해주세요.')); return false; }
          return true;
        },
        renameCategory: (id, name) => {
          const item = itemsRef.current[id];
          if (!isCategoryItem(item) || !canWriteItem(item)) { setToast(WRITE_DENIED); return false; }
          if (duplicate(channelCategories, name, id)) { setToast(ui('같은 이름의 카테고리가 이미 있습니다.')); return false; }
          return patchItems({ [id]: { ...item, name } }) !== false;
        },
        removeCategory: id => {
          const item = itemsRef.current[id];
          if (!isCategoryItem(item) || !canWriteItem(item)) { setToast(WRITE_DENIED); return; }
          if (!window.confirm(ui('이 카테고리를 삭제할까요? 속한 채널은 삭제되지 않고 미분류로 이동합니다.'))) return;
          const updates = {};
          for (const [channelId, candidate] of Object.entries(itemsRef.current || {})) {
            if (isChannelItem(candidate) && candidate.categoryId === id && canWriteItem(candidate)) {
              const next = { ...candidate };
              delete next.categoryId;
              updates[channelId] = next;
            }
          }
          patchItems(updates, [id]);
        },
        moveChannel: (id, categoryId = null, targetChannelId = null) => {
          const item = itemsRef.current[id];
          if (!isChannelItem(item) || !canWriteItem(item)) { setToast(WRITE_DENIED); return false; }
          const patches = moveChannelPatch(itemsRef.current, id, categoryId, targetChannelId);
          if (!patches || !Object.keys(patches).length) return true;
          const writablePatches = Object.fromEntries(
            Object.entries(patches).filter(([patchId]) => canWriteItem(itemsRef.current[patchId])),
          );
          if (!writablePatches[id]) { setToast(WRITE_DENIED); return false; }
          return patchItems(writablePatches) !== false;
        },
        reorderCategory: (id, targetCategoryId) => {
          const item = itemsRef.current[id];
          if (!isCategoryItem(item) || !canWriteItem(item)) { setToast(WRITE_DENIED); return false; }
          const patches = reorderCategoryPatch(itemsRef.current, id, targetCategoryId);
          if (!patches || !Object.keys(patches).length) return true;
          const writablePatches = Object.fromEntries(
            Object.entries(patches).filter(([patchId]) => canWriteItem(itemsRef.current[patchId])),
          );
          if (!Object.keys(writablePatches).length) return false;
          return patchItems(writablePatches) !== false;
        },
      };
    })();
    const jumpToMention = note => {
      if (note.objectId && chatChannelRef.current.isChannel(note.objectId)) {
        const chat = panelLayout.handle('chat');
        if (chat.collapsed) chat.onToggle();
        setCommunicationTab('chat');
        selectChatChannel(note.objectId);
        setChatHighlight(note.id);
        requestedChatMention.current = null;
        setChatJumpNote(note);
      } else if (note.objectId) { focusCanvasObject(note.objectId); comments.open(note.objectId, note.id, note.sequence, note); }
      else {
        const chat = panelLayout.handle('chat');
        if (chat.collapsed) chat.onToggle();
        setCommunicationTab('chat');
        setChatHighlight(note.id);
        requestedChatMention.current = null;
        setChatJumpNote(note);
      }
    };
    const objectActionsRef = useRef(null);
    objectActionsRef.current = {
      onUndo: id => undo({ itemId: String(id), textOnly: true }), onStartEditing: startEditing, onTextChange: updateCollaborativeText, onTextColorChange: updateTextColor,
      onMetadataChange: (id, field, value) => ['renderMode', 'filename', 'language'].includes(field)
        ? updateContentSetting(id, field, value) : updateCollaborativeMetadata(id, field, value),
      onFormulaChange: updateFormulaItem, onTableChange: updateTableItem, onQuestionChange: updateTableItem, onStopEditing: stopEditing,
      onSave: saveCollaborativeItem, onPointerDown: startObjectDrag, onResizeStart: startObjectResize,
      onArrowBendStart: startArrowBend, onPointerMove: moveObject, onPointerUp: stopObjectDrag,
      onCopy: value => navigator.clipboard?.writeText(value), onConnectorDoubleClick: focusConnectorTarget,
    };
    // One set of stable dispatchers serves every object and always calls this
    // render's actions, including the latest camera and collaboration state.
    const objectActions = useMemo(() => Object.fromEntries(Object.keys(objectActionsRef.current)
      .map(key => [key, (...args) => objectActionsRef.current[key](...args)])), []);

    const toolsHandle = panelLayout.handle('tools');
    // Manage React-owned tool and grid stage classes imperatively so re-renders
    // never overwrite active camera motion/zoom/gesture classes on .canvas-stage.
    useLayoutEffect(() => {
      const stage = boardRef.current;
      if (!stage) return;
      stage.classList.toggle('select-mode', activeTool === 'select');
      stage.classList.toggle('creation-mode', !['select', 'connect', 'hand'].includes(activeTool));
      stage.classList.toggle('drawing-mode', activeTool === 'pen');
      stage.classList.toggle('laser-mode', activeTool === 'laser');
      stage.classList.toggle('hand-mode', activeTool === 'hand');
      stage.classList.toggle('eraser-active', activeTool === 'eraser');
      stage.classList.toggle('no-grid', !showGrid);
    }, [activeTool, showGrid, error, boardRef]);

    const frameClipPath = portfolioViewing && presentationPage?.frameId
      ? 'inset(var(--frame-screen-top) calc(100% - var(--frame-screen-left) - var(--frame-screen-width)) calc(100% - var(--frame-screen-top) - var(--frame-screen-height)) var(--frame-screen-left))'
      : undefined;
    const sceneStyle = useMemo(() => ({
      clipPath: frameClipPath,
      width: viewportSize.width,
      height: viewportSize.height,
      right: 'auto',
      bottom: 'auto',
    }), [frameClipPath, viewportSize.width, viewportSize.height]);
    const vectorLayerStyle = useMemo(() => ({
      width: viewportSize.width,
      height: viewportSize.height,
      right: 'auto',
      bottom: 'auto',
    }), [viewportSize.width, viewportSize.height]);
    const worldLayerStyle = useMemo(() => ({
      position: 'absolute',
      width: boardSize.width,
      height: boardSize.height,
      transformOrigin: 'top left',
    }), [boardSize.width, boardSize.height]);
    const worldLayerOverlayStyle = useMemo(() => ({
      position: 'absolute',
      width: boardSize.width,
      height: boardSize.height,
      transformOrigin: 'top left',
      zIndex: depthLayers.length + 1,
      pointerEvents: 'none',
    }), [boardSize.width, boardSize.height, depthLayers.length]);

    const uiActionsRef = useRef(null);
    uiActionsRef.current = {
      onOpenAnchors: () => window.dispatchEvent(new CustomEvent('canvas-open-anchors')),
      onSelectTool: (...args) => selectCanvasTool(...args),
      onColorChange: (...args) => setColor(...args),
      onUploadPdf: (...args) => uploadPdf(...args),
      onUploadSheet: (...args) => uploadSheet(...args),
      onUploadImage: (...args) => uploadImage(...args),
      onUploadMedia: (...args) => uploadMedia(...args),
      onSaveFavorite: (...args) => saveFavoriteColor(...args),
      setAnchors: (...args) => setPersonalAnchors(...args),
      onNavigateAnchor: (...args) => navigatePersonalAnchor(...args),
      navigationGuard: () => editingIdRef.current == null && !dragRef.current && !drawingRef.current && !panRef.current && !selectionRef.current && !portfolioViewing,
      shortcutGuard: () => hostSessionRef.current.editable && editingIdRef.current == null && !dragRef.current && !drawingRef.current && !panRef.current && !selectionRef.current,
      onUndo: (...args) => undoCanvas(...args),
      onToggleTools: () => toolsHandle.onToggle(),
      onVectorDraftReady: (setDraft) => { vectorDraftRef.current = setDraft; },
      onSaveAnchor: (ids) => window.dispatchEvent(new CustomEvent('canvas-open-anchors', { detail: { objectIds: [...ids] } })),
      onOpenComments: (id) => { finishEditing(editingId); comments.open(id); },
      canWriteItem: (...args) => canWriteItem(...args),
      updateContentSetting: (...args) => updateContentSetting(...args),
      updateChartItem: (...args) => updateTableItem(...args),
      onNavigateObject: (...args) => focusCanvasObject(...args),
      onInsertUserGroup: (...args) => insertUserGroup(...args),
      onUserGroupTemplateChange: (...args) => setUserGroupTemplate(...args),
      setBackgroundColor: (...args) => setBackgroundColor(...args),
      changeSelectionGroup: (...args) => changeSelectionGroup(...args),
      changeStrokeWidth: (...args) => changeStrokeWidth(...args),
      changeEraserWidth: (...args) => changeEraserWidth(...args),
      changeEraserMode: (...args) => changeEraserMode(...args),
      changeTableCount: (...args) => changeTableCount(...args),
      changeTableSize: (...args) => changeTableSize(...args),
      changeTheme: (...args) => changeTheme(...args),
      changeZoomSensitivity: (...args) => changeZoomSensitivity(...args),
      deleteItem: (...args) => deleteItem(...args),
      updateUserGroup: (...args) => updateUserGroup(...args),
      selectItems: (...args) => selectItems(...args),
      setShapeType: (...args) => changeShapeType(...args),
      setShowSettings: (...args) => setShowSettings(...args),
      updateItemGroups: (...args) => updateItemGroups(...args),
      setLaserColor: (...args) => setLaserColor(...args),
      setConnectorColor: (...args) => setConnectorColor(...args),
      setConnectorWidth: (...args) => setConnectorWidth(...args),
      setNoteColor: (...args) => setNoteColor(...args),
      setShapeFillOpacity: (...args) => setShapeFillOpacity(...args),
      setShapeSketchFillOpacity: (...args) => setShapeSketchFillOpacity(...args),
      updateNewShapeGeometry: (...args) => updateNewShapeGeometry(...args),
      setShapeVisualStyle: (...args) => setShapeVisualStyle(...args),
      setShapeStrokeEnabled: (...args) => setShapeStrokeEnabled(...args),
      setShapeBorderWidth: (...args) => setShapeBorderWidth(...args),
      updateShapeAppearance: (...args) => updateShapeAppearance(...args),
      setConnectorVisualStyle: (...args) => setConnectorVisualStyle(...args),
      setShapeFillColor: (...args) => changeShapeFillColor(...args),
      updateShapeFill: (...args) => updateShapeFill(...args),
      changeGridSpacing: (...args) => changeGridSpacing(...args),
      toggleSnapToGrid: (...args) => toggleSnapToGrid(...args),
      toggleXAxis: (...args) => toggleXAxis(...args),
      toggleYAxis: (...args) => toggleYAxis(...args),
      changePenBrush: (...args) => changePenBrush(...args),
      changePenOpacity: (...args) => changePenOpacity(...args),
      toggleGrid: (...args) => toggleGrid(...args),
      updateArrowHead: (...args) => updateArrowHead(...args),
      updateConnectorAppearance: (...args) => updateConnectorAppearance(...args),
      updateItemRotation: (...args) => updateItemRotation(...args),
      updateItemDepth: (...args) => updateItemDepth(...args),
      updateItemLocked: (...args) => updateItemLocked(...args),
      updateItemHidden: (ids, hidden) => updateItemHidden(ids, hidden),
      onTogglePreviewHidden: () => setPreviewHiddenObjects((value) => !value),
      onToggleRevealAfterAnimation: (...args) => setRevealAfterAnimation(...args),
      onRevealAfterAnimation: (...args) => revealObjectsAfterAnimation(...args),
      onUnhideAll: (ids) => updateItemHidden(ids, false),
      onRevealAllAfterAnimation: (...args) => revealObjectsAfterAnimation(...args),
      onSelectHiddenObject: (...args) => selectHiddenObject(...args),
      updateItemShadow: (...args) => updateItemShadow(...args),
      updateImageFrame: (...args) => updateImageFrame(...args),
      updateObjectCornerStyle: (...args) => updateObjectCornerStyle(...args),
      updateObjectColor: (...args) => updateObjectColor(...args),
      updateObjectDimensions: (...args) => updateObjectDimensions(...args),
      updateObjectFontSize: (...args) => updateObjectFontSize(...args),
      onCopyStyle: (...args) => copySelectionStyle(...args),
      onPasteStyle: (...args) => pasteSelectionStyle(...args),
      onPatchStyle: (...args) => patchEditableObjects(...args),
      onPatchAllItems: (...args) => patchAllStyledItems(...args),
      onApplyAutoLayout: (...args) => applyContainerAutoLayout(...args),
      updateNewConnectorHead: (...args) => updateNewConnectorHead(...args),
      updateNewShapeArrowHead: (...args) => updateNewShapeArrowHead(...args),
      updateShapeArrowBend: (...args) => updateShapeArrowBend(...args),
      onChatTabChange: (...args) => setCommunicationTab(...args),
      loadOlderMessages: (...args) => loadOlderMessages(...args),
      setMessage: (...args) => setMessage(...args),
      submitMessage: (...args) => submitMessage(...args),
      onUploadChatMedia: (...args) => uploadChatMedia(...args),
      onChatHighlightExpired: () => setChatHighlight(null),
      onChatHighlightVisible: () => { if (chatJumpNote) { comments.dismiss(chatJumpNote); setChatJumpNote(null); } },
      onAgentBusyChange: (...args) => setAgentBusy(...args),
      onAgentClose: () => setShowAgent(false),
      onAgentRequest: async ({ operation, ...agent }, onOutput) => {
        const result = await executeCanvasCode({ canvasId, action: 'agent', operation, agent, sendRaw, pendingRequests: runtimeSocketRequestsRef.current }, onOutput);
        if (typeof result.highlight_id === 'string') highlightObject(result.highlight_id, 'agent');
        return result;
      },
    };
    const uiActions = useMemo(() => Object.fromEntries(
      Object.keys(uiActionsRef.current).map((key) => [key, (...args) => uiActionsRef.current[key](...args)])
    ), []);


    return <LiveContentContext.Provider value={liveContent}><WebAssetsContext.Provider value={webAssetStore}><AnimationContext.Provider value={animationStore}><ProjectContext.Provider value={projectStore}><div className={`canvas-app-page${portfolioViewing ? ' portfolio-view' : ''}`} data-presentation-settings={portfolioSettings} style={portfolioViewing && presentationPage?.frame ? { '--frame-screen-left': `${presentationPage.frame.x * boardSize.width * camera.scale + camera.x}px`, '--frame-screen-top': `${presentationPage.frame.y * boardSize.height * camera.scale + camera.y}px`, '--frame-screen-width': `${presentationPage.frame.width * boardSize.width * camera.scale}px`, '--frame-screen-height': `${presentationPage.frame.height * boardSize.height * camera.scale}px`, '--frame-view-fill': presentationPage.frame.fill || '#fff', '--frame-content-color': isColorDark(presentationPage.frame.fill || '#fff') ? '#f0f1f5' : '#1e2029', '--frame-content-muted': isColorDark(presentationPage.frame.fill || '#fff') ? '#a3a4bb' : '#5f6377' } : undefined} data-frame-view={Boolean(portfolioViewing && presentationPage?.frameId)} data-theme={theme} data-info-collapsed={chrome.collapsed.info}>
      <div style={{ display: 'contents' }} inert={!hostStatus.editable && !error ? '' : undefined}>
        <header className={`canvas-topbar${chrome.collapsed.info ? ' is-collapsed' : ''}`}>
          <ChromeToggle label={ui("캔버스 정보")} collapsed={chrome.collapsed.info} onToggle={() => chrome.toggle('info')} controls="canvas-info-content" />
          {chrome.collapsed.info && <span className="canvas-chrome-label">{ui("캔버스 정보")}</span>}
          <div id="canvas-info-content" className="canvas-info-content" hidden={chrome.collapsed.info}>
            <div className="canvas-title-group"><div className="canvas-title-copy"><h1 title={canvas?.canvas_name}>{canvas?.canvas_name || ui('캔버스 {id}', { id: canvasId })}</h1></div></div>
            <div className="canvas-header-right"><div className="canvas-top-right"><LanguageSwitcher />{!chrome.collapsed.info && <button type="button" className={`canvas-monitor-trigger${showMonitoring ? ' is-active' : ''}`} title={ui(showMonitoring ? '모니터링 닫기' : '모니터링')} aria-label={ui(showMonitoring ? '모니터링 닫기' : '모니터링')} aria-pressed={showMonitoring} onClick={toggleMonitoring}><Icon name="chart" size={16} /><span>{ui('모니터링')}</span></button>}{!chrome.collapsed.info && <button type="button" className={`canvas-voice-trigger${voice.state.active ? ' is-active' : ''}`} title={ui(voice.state.active ? '통화 중' : '음성 통화')} aria-label={ui(voice.state.active ? '통화 중' : '음성 통화')} aria-expanded={!panelLayout.handle('chat').collapsed && communicationTab === 'voice'} aria-controls="canvas-communication-panel" onClick={() => { const panel = panelLayout.handle('chat'); if (!panel.collapsed && communicationTab === 'voice') panel.onToggle(); else { setCommunicationTab('voice'); if (panel.collapsed) panel.onToggle(); } }}><Icon name="microphone" size={16} /><span>{ui(voice.state.active ? '통화 중' : '음성 통화')}</span>{voice.state.active && <i aria-hidden="true" />}</button>}<span className={`connection-pill ${connection}`} role="status" aria-live="polite" title={connection === 'connecting' ? ui("다시 연결하는 중입니다. 캔버스 편집은 계속할 수 있고 변경 사항은 연결 후 저장됩니다.") : connection === 'connected' ? ui("서버에 연결되어 변경 사항을 동기화하고 있습니다.") : ui("서버 연결이 해제되었습니다.")}><i />{connection === 'connected' ? ui("연결됨") : connection === 'connecting' ? ui("연결 중") : ui("연결 해제")}</span><CanvasPresenceStack watch={watch} participants={onlineParticipants} token={token} onManage={() => { setShowSettings(false); setShowParticipants(true); }} /><button className="button button-outline canvas-settings-button" onClick={() => { setShowParticipants(false); setShowSettings(true); }}><Icon name="settings" size={17} /><span>{ui("설정")}</span></button></div></div>
          </div>{chrome.collapsed.info && <div className="canvas-folded-language"><LanguageSwitcher /><button type="button" className={`canvas-monitor-trigger${showMonitoring ? ' is-active' : ''}`} title={ui(showMonitoring ? '모니터링 닫기' : '모니터링')} aria-label={ui(showMonitoring ? '모니터링 닫기' : '모니터링')} aria-pressed={showMonitoring} onClick={toggleMonitoring}><Icon name="chart" size={16} /><span>{ui('모니터링')}</span></button><button type="button" className={`canvas-voice-trigger${voice.state.active ? ' is-active' : ''}`} aria-label={ui(voice.state.active ? '통화 중' : '음성 통화')} aria-expanded={!panelLayout.handle('chat').collapsed && communicationTab === 'voice'} aria-controls="canvas-communication-panel" onClick={() => { const panel = panelLayout.handle('chat'); if (!panel.collapsed && communicationTab === 'voice') panel.onToggle(); else { setCommunicationTab('voice'); if (panel.collapsed) panel.onToggle(); } }}><Icon name="microphone" size={16} />{voice.state.active && <i aria-hidden="true" />}</button></div>}
        </header>
        {error ? <div className="canvas-error-state"><div className="error-art"><Icon name="grid" size={30} /></div><span className="section-kicker">CANVAS CONNECTION</span><h1>{ui("캔버스를 열 수 없어요.")}</h1><p>{error}</p><div><button className="button button-dark" onClick={() => window.location.reload()}>{ui("다시 연결하기")}</button><Link className="button button-outline" to="/search">{ui("캔버스 목록")}</Link></div></div> : <div className="canvas-workspace resizable-workspace" ref={panelLayout.ref} style={panelLayout.style}>
          <ResizablePanel {...toolsHandle}><CanvasToolPanel onOpenAnchors={uiActions.onOpenAnchors} activeTool={activeTool} onSelectTool={uiActions.onSelectTool} color={color} onColorChange={uiActions.onColorChange} onUploadPdf={uiActions.onUploadPdf} onUploadSheet={uiActions.onUploadSheet} onUploadImage={uiActions.onUploadImage} onUploadMedia={uiActions.onUploadMedia} favoriteColors={favoriteColors} onSaveFavorite={uiActions.onSaveFavorite} /></ResizablePanel>
          <CanvasQuickDock anchors={personalAnchors} setAnchors={uiActions.setAnchors} selectedItemIds={selectedItemIds} onNavigateAnchor={uiActions.onNavigateAnchor} allowPageKeys={selectedItemIds.length === 0 && !portfolioViewing} navigationGuard={uiActions.navigationGuard} shortcutGuard={uiActions.shortcutGuard} undoCount={undoCount} onUndo={uiActions.onUndo} canUndo={!watchState.watching_id && hostStatus.editable && editingId == null} canWrite={canWriteCanvas} activeTool={activeTool} onSelectTool={uiActions.onSelectTool} onUploadImage={uiActions.onUploadImage}
            toolsExpanded={!toolsHandle.collapsed} onToggleTools={uiActions.onToggleTools} />
          <main className="board-region">{agentAccess && <CanvasAgentLauncher open={showAgent} busy={agentBusy || multiAgentBusy} disabled={Boolean(watchState.watching_id) || !canvasSnapshotLoadedRef.current} onClick={() => setShowAgent(value => !value)} />}<MultiAgentActivity store={multiAgentStore} onFocusObject={focusCanvasObject} /><div className="board-topline"><div className="board-toolbar-actions"><button className="board-toggle" disabled={!canvasSnapshotLoadedRef.current} onClick={() => { finishEditing(editingId); setShowVersions(false); setCanvasCodeSource(null); setShowCanvasCode(true); }}><Icon name="code" size={15} />{ui("캔버스 코드")}</button><button className="board-toggle" title={ui("변경 이력")} aria-haspopup="dialog" disabled={!canvasSnapshotLoadedRef.current} onClick={() => { finishEditing(editingId); setShowCanvasCode(false); setShowVersions(true); }}><Icon name="document" size={15} />{ui("변경 이력")}</button><button className="board-toggle" disabled={!canvasSnapshotLoadedRef.current} onClick={() => setShowRuntimeSettings(true)}><Icon name="settings" size={15} />{ui("실행 환경")}</button><button className="zoom-button" disabled={camera.scale >= MAX_CANVAS_SCALE - 1e-6} aria-label={ui("확대")} title={ui("클릭: 한 단계 확대 · 길게 누르기: 계속 확대")} onPointerDown={(event) => startZoomHold(event, 1 + 0.3 * zoomSensitivity)} onPointerUp={stopZoomHold} onPointerCancel={cancelZoomHold} onLostPointerCapture={stopZoomHold} onClick={() => clickZoom(1 + 0.3 * zoomSensitivity)}>+</button><span className="zoom-value">{formatCanvasZoom(camera.scale)}</span><button className="zoom-button" disabled={camera.scale <= MIN_CANVAS_SCALE + 1e-6} aria-label={ui("축소")} title={ui("클릭: 한 단계 축소 · 길게 누르기: 계속 축소")} onPointerDown={(event) => startZoomHold(event, 1 / (1 + 0.3 * zoomSensitivity))} onPointerUp={stopZoomHold} onPointerCancel={cancelZoomHold} onLostPointerCapture={stopZoomHold} onClick={() => clickZoom(1 / (1 + 0.3 * zoomSensitivity))}>−</button><button className="zoom-button zoom-reset" onClick={() => { cancelPanInertia(); setCamera(fitCanvasCamera(viewportSize)); }}>{ui("맞춤")}</button><button className={`board-toggle${showGrid ? ' active' : ''}`} onClick={toggleGrid} aria-pressed={showGrid}><Icon name="grid" size={15} />{"" + ui("격자") + " "}{showGrid ? ui("켜짐") : ui("꺼짐")}</button></div></div>
            <div className="canvas-stage" data-grid-spacing={gridSpacing.x} data-grid-spacing-x={gridSpacing.x} data-grid-spacing-y={gridSpacing.y} style={backgroundStyle} ref={boardRef} tabIndex={-1} {...stagePointerHandlers({
              disabled: Boolean(watchState.watching_id), touchNavigation, activeTool, dragRef, panRef, spacePressedRef, startPan, cancelCameraMotion: cancelPanInertia, startDrawing, moveDrawing, stopDrawing, moveObject, stopObjectDrag, hideCursor, sendCursorPosition, pickVector: (event, doubleClick = false, capture = false) => {
                if (!['select', 'connect'].includes(activeTool) || event.button !== 0 || event.target.closest?.('.stage-label, button, input, textarea')) return false;
                if (activeTool === 'connect') {
                  const frameHit = hitTestFrameBorder(spatialIndex, pointerPosition(event), boardSize, camera.scale);
                  if (frameHit && (previewHiddenEffective || !isObjectInvisibleAtTime(frameHit.item, Date.now()))) {
                    if (!capture) return false;
                    objectActions.onPointerDown(event, frameHit.id, frameHit.item);
                    return true;
                  }
                }
                const target = event.target.closest?.('.canvas-object');
                if (capture !== Boolean(target)) return false;
                const hit = hitTestVector(spatialIndex, pointerPosition(event), boardSize, camera.scale, vectorHitOrder, representationScale);
                if (!hit || (!previewHiddenEffective && isObjectInvisibleAtTime(hit.item, Date.now()))) return false;
                if (target) {
                  const targetId = target.dataset.itemId, below = items[targetId];
                  if (hit.id === targetId || !below || itemDepth(hit.item) < itemDepth(below)) return false;
                  if (itemDepth(hit.item) === itemDepth(below) && (!['shape', 'stroke', 'connector', 'text'].includes(below.kind) || (vectorHitOrder.get(hit.id) || 0) <= (vectorHitOrder.get(targetId) || 0))) return false;
                }
                if (doubleClick) handleObjectDoubleClick(event, { id: hit.id, item: hit.item, activeTool, editing: editingId === hit.id, ...objectActions });
                else objectActions.onPointerDown(event, hit.id, hit.item);
                return true;
              }
            })}>
              <InteractiveAtmosphere variant="canvas" />
              <div className="stage-label"><span>FRELOG / {String(canvasId).padStart(2, '0')}</span><b>{canvas?.canvas_name || ui("공유 캔버스")}</b></div>
              <div className="canvas-grid-surface" aria-hidden="true" />
              <CanvasWatchOverlay watch={watch} />
              <div className="coordinate-plane" style={coordinatePlaneStyle} aria-hidden="true">{(showXAxis || showYAxis) && <CanvasAxisTicks boardRef={boardRef} camera={camera} showXAxis={showXAxis} showYAxis={showYAxis} isLabelCovered={isAxisLabelCovered} />}{showXAxis && <span className="coordinate-x" />}{showYAxis && <span className="coordinate-y" />}{(showXAxis || showYAxis) && <i className="coordinate-origin">0</i>}</div>
              <BlurBudgetContext.Provider value={blurBudgetIds}><div className="canvas-scene" ref={sceneRef} style={sceneStyle}>
                {renderGroups.map((layer, index) => <div className="canvas-depth-layer" key={layer.key} data-depth={layer.depths.at(-1)} style={{ position: 'absolute', inset: 0, zIndex: index + 1, pointerEvents: 'none' }}>
                  <Suspense fallback={null}><VectorLayer token={token} style={vectorLayerStyle} worldSize={boardSize} items={layer.vectors} referenceItems={items} routingRevision={spatialIndex.stats.boundsCalculated} inkItems={layer.inkItems} previewStrokes={layer.hasDepthZero ? remoteDrawingStrokes : undefined} camera={camera} onReady={layer.hasDepthZero ? uiActions.onVectorDraftReady : undefined} onDragReady={getVectorDragCallback(layer.key)} /></Suspense>
                  <div className="canvas-world-layer" style={worldLayerStyle}><PresentationContext.Provider value={portfolioViewing}><VisibilityContext.Provider value={visibilityContextValue}><Suspense fallback={null}><CanvasLayerObjects pendingEntrance={pendingEntrance} objects={layer.domObjects} allItems={items} domSelection={domSelection} editingId={editingId} connectionStartId={connectionStartId} world={boardSize} scale={representationScale} token={token} runtimeStore={runtimeStore} multiAgentStore={multiAgentStore} selected={selectedObjectIdSet} singleSelection={hasSingleSelection} activeTool={activeTool} dirtyItems={dirtyItems} editorsByItem={editorsByItem} actions={objectActions} access={capabilities} canWriteItem={uiActions.canWriteItem} canExecuteItem={canExecuteItem} /></Suspense></VisibilityContext.Provider></PresentationContext.Provider></div>
                </div>)}
                <div className="canvas-world-layer" style={worldLayerOverlayStyle}>
                  {activeTool === 'connect' && connectionStartId != null && items[connectionStartId] && <ConnectorCreationPreview boardRef={boardRef} itemsRef={itemsRef} startId={connectionStartId} boardSize={boardSize} pointerPosition={pointerPosition} spatialIndex={spatialIndex} vectorHitOrder={vectorHitOrder} cameraScale={camera.scale} representationScale={representationScale} />}
                  {selectedItem && (!isObjectInvisibleAtTime(selectedItem, revealNow) || previewHiddenEffective) && canWriteItem(selectedItem) && !isObjectLocked(selectedItem) && !['connector', 'frame'].includes(selectedItem.kind) && activeTool === 'select' && !editingId && <RotationHandles sceneRef={sceneRef} id={String(primarySelectedItemId)} item={selectedItem} viewSize={boardSize} onPointerDown={startObjectRotation} onPointerMove={moveObject} onPointerUp={stopObjectDrag} />}
                  {selectionIsSingleGroup && selectedObjectIds.every(id => canWriteItem(items[id]) && !isObjectLocked(items[id]) && (!isObjectInvisibleAtTime(items[id], revealNow) || previewHiddenEffective)) && selectedObjectIds.length > 1 && activeTool === 'select' && !editingId && <GroupRotationHandles sceneRef={sceneRef} ids={selectedObjectIds} items={items} viewSize={boardSize} onPointerDown={startGroupRotation} onPointerMove={moveObject} onPointerUp={stopObjectDrag} />}
                  {(objectHighlights.size > 0 || highlightPulse) && (
                    <svg className="canvas-object-highlight-layer" width={boardSize.width} height={boardSize.height} aria-hidden="true">
                      {[...new Set([...objectHighlights, ...(highlightPulse ? [highlightPulse.id] : [])])].map(id => {
                        const item = items[id];
                        if (!item || !canUseItem(item, capabilities, 'read') || isObjectInvisibleAtTime(item, revealNow)) return null;
                        const bounds = objectBounds(item, items, boardSize.width, boardSize.height);
                        const pulse = highlightPulse?.id === id;
                        return <rect key={pulse ? highlightPulse.key : id}
                          className={pulse ? 'canvas-object-highlight is-pulsing' : 'canvas-object-highlight'}
                          x={bounds.minX * boardSize.width - 4} y={bounds.minY * boardSize.height - 4}
                          width={(bounds.maxX - bounds.minX) * boardSize.width + 8}
                          height={(bounds.maxY - bounds.minY) * boardSize.height + 8}
                          rx="6" vectorEffect="non-scaling-stroke" />;
                      })}
                    </svg>
                  )}
                  <RemoteCursorLayer updaterRef={remoteCursorUpdaterRef} activePeerIds={activePeerIds} visibleBounds={visibleBounds} />
                </div>
              </div></BlurBudgetContext.Provider>
              <LaserLayer updaterRef={laserUpdaterRef} activeDrawingRef={laserDrawingRef} width={viewportSize.width} height={viewportSize.height} worldSize={boardSize} camera={camera} />
              <div ref={selectionBoxRef} className="canvas-selection-marquee" style={{ display: 'none', left: 0, top: 0 }} aria-hidden="true" />
              <div ref={creationBoxRef} className="canvas-creation-preview" style={{ display: 'none', left: 0, top: 0 }} aria-hidden="true"><span className="canvas-creation-preview-size" /></div>
              {selectedObjectIds.length > 0 && (previewHiddenEffective || selectedObjectIds.some((id) => items[id] && !isObjectInvisibleAtTime(items[id], revealNow))) && activeTool === 'select' && editingId == null && !watchState.watching_id && !portfolioViewing && hostStatus.editable && (
                <FloatingContextToolbar
                  selectedIds={selectedObjectIds}
                  items={items}
                  camera={camera}
                  boardSize={boardSize}
                  viewportSize={viewportSize}
                  onPatchStyle={patchEditableObjects}
                  onFontSizeChange={(ids, value) => (ids.length === 1 ? updateObjectFontSize(ids[0], value) : patchEditableObjects(ids, (prev) => (supportsObjectFontSize(prev) ? { fontSize: value } : null)))}
                  onBringToFront={bringSelectionToFront}
                  onSendToBack={sendSelectionToBack}
                  onCopyStyle={copySelectionStyle}
                  onPasteStyle={pasteSelectionStyle}
                  hasCopiedStyle={Boolean(copiedStyle)}
                  onToggleLock={updateItemLocked}
                  onToggleHidden={(ids, hidden) => updateItemHidden(ids, hidden, { deselectHidden: !previewHiddenEffective })}
                />
              )}
              {activeTool === 'eraser' && <div className="eraser-cursor" ref={eraserCursorRef} style={{ left: 0, top: 0, width: `${eraserWidth}px`, height: `${eraserWidth}px` }} aria-hidden="true" />}
              {sharePosition && <ShareComposer onCancel={() => { setSharePosition(null); setActiveTool('select'); }} onSubmit={placeSharedLink} />}
              {activeTool === 'anchor' && <div className="draw-cursor-label"><Icon name="anchor" size={13} /> {ui('저장할 위치를 클릭하세요.')}</div>}{activeTool === 'laser' && <div className="draw-cursor-label laser-cursor-label"><Icon name="laser" size={13} />{" " + ui("가리키는 중 · 1.6초 후 사라짐") + ""}</div>}{activeTool === 'pen' && <div className="draw-cursor-label"><Icon name="pen" size={13} />{" " + ui("그리는 중") + ""}</div>}{activeTool === 'eraser' && <div className="draw-cursor-label"><Icon name="eraser" size={13} />{" " + ui("드로잉을 드래그해 지우기") + ""}</div>}{activeTool === 'connect' && <div className="draw-cursor-label"><Icon name="connect" size={13} /> {connectionStartId ? ui("도착 오브젝트 선택") : ui("시작 오브젝트 선택")}</div>}{activeTool === 'link' && !sharePosition && <div className="draw-cursor-label"><Icon name="link" size={13} />{" " + ui("공유 자료를 놓을 위치 선택") + ""}</div>}
            </div>
          </main>
          <ResizablePanel {...inspectorHandle}><Suspense fallback={null}><CanvasInspectorPanel personalTimer={personalTimerElement} onSaveAnchor={uiActions.onSaveAnchor} portfolioFrames={framePages} portfolioActions={portfolioActions} portfolioViewing={portfolioViewing} spatialIndex={spatialIndex} updateContentSetting={uiActions.updateContentSetting} updateChartItem={uiActions.updateChartItem} onNavigateObject={uiActions.onNavigateObject} onOpenComments={uiActions.onOpenComments} {...{
            activeTool,
            canvasId,
            canvasParticipants: mentionParticipants,
            onInsertUserGroup: uiActions.onInsertUserGroup,
            userGroupTemplate,
            onUserGroupTemplateChange: uiActions.onUserGroupTemplateChange,
            backgroundColor,
            setBackgroundColor: uiActions.setBackgroundColor,
            changeSelectionGroup: uiActions.changeSelectionGroup,
            changeStrokeWidth: uiActions.changeStrokeWidth,
            eraserWidth,
            changeEraserWidth: uiActions.changeEraserWidth,
            eraserMode,
            changeEraserMode: uiActions.changeEraserMode,
            changeTableCount: uiActions.changeTableCount,
            changeTableSize: uiActions.changeTableSize,
            changeTheme: uiActions.changeTheme,
            changeZoomSensitivity: uiActions.changeZoomSensitivity,
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
            selectItems: uiActions.selectItems,
            selectedArrow,
            selectedConnector,
            selectedItem,
            objectHighlighted: objectHighlights.has(String(primarySelectedItemId)),
            onObjectHighlight: highlightObject,
            objectClipboard, clipboardBlocked, canWriteItem: uiActions.canWriteItem, canWriteCanvas,
            deleteItem: uiActions.deleteItem,
            user, token, updateUserGroup: uiActions.updateUserGroup,
            selectedObjectIds,
            selectedTable,
            selectionIsSingleGroup,
            setColor: uiActions.onColorChange,
            favoriteColors,
            saveFavoriteColor: uiActions.onSaveFavorite,
            laserColor, setLaserColor: uiActions.setLaserColor,
            setConnectorColor: uiActions.setConnectorColor,
            setConnectorWidth: uiActions.setConnectorWidth,
            setNoteColor: uiActions.setNoteColor,
            setShapeType: uiActions.setShapeType,
            setShowSettings: uiActions.setShowSettings,
            showMonitoring,
            onCloseMonitoring: closeMonitoring,
            settings,
            capabilities,
            updateItemGroups: uiActions.updateItemGroups,
            shapeArrowEndHead,
            shapeArrowStartHead, shapeArrowHeadSize,
            shapeType,
            shapeFillColor,
            shapeFillOpacity, setShapeFillOpacity: uiActions.setShapeFillOpacity, shapeSketchFillOpacity, setShapeSketchFillOpacity: uiActions.setShapeSketchFillOpacity, shapeVertexCount, shapeCornerStyle, updateNewShapeGeometry: uiActions.updateNewShapeGeometry,
            shapeVisualStyle, setShapeVisualStyle: uiActions.setShapeVisualStyle, shapeStrokeEnabled, setShapeStrokeEnabled: uiActions.setShapeStrokeEnabled, shapeBorderWidth, setShapeBorderWidth: uiActions.setShapeBorderWidth, updateShapeAppearance: uiActions.updateShapeAppearance,
            connectorVisualStyle, setConnectorVisualStyle: uiActions.setConnectorVisualStyle,
            setShapeFillColor: uiActions.setShapeFillColor,
            updateShapeFill: uiActions.updateShapeFill,
            showGrid, gridSpacing, changeGridSpacing: uiActions.changeGridSpacing, snapToGrid, toggleSnapToGrid: uiActions.toggleSnapToGrid, showXAxis, showYAxis, toggleXAxis: uiActions.toggleXAxis, toggleYAxis: uiActions.toggleYAxis,
            strokeWidth,
            penBrush, penOpacity, changePenBrush: uiActions.changePenBrush, changePenOpacity: uiActions.changePenOpacity,
            tableConfig,
            theme,
            toggleGrid: uiActions.toggleGrid,
            updateArrowHead: uiActions.updateArrowHead,
            updateConnectorAppearance: uiActions.updateConnectorAppearance,
            updateItemRotation: uiActions.updateItemRotation, updateItemDepth: uiActions.updateItemDepth, updateItemLocked: uiActions.updateItemLocked,
            updateItemHidden: uiActions.updateItemHidden,
            previewHiddenObjects,
            onTogglePreviewHidden: uiActions.onTogglePreviewHidden,
            onToggleRevealAfterAnimation: uiActions.onToggleRevealAfterAnimation,
            onRevealAfterAnimation: uiActions.onRevealAfterAnimation,
            onUnhideAll: uiActions.onUnhideAll,
            onRevealAllAfterAnimation: uiActions.onRevealAllAfterAnimation,
            onSelectHiddenObject: uiActions.onSelectHiddenObject,
            updateItemShadow: uiActions.updateItemShadow, updateImageFrame: uiActions.updateImageFrame, updateObjectCornerStyle: uiActions.updateObjectCornerStyle, updateObjectColor: uiActions.updateObjectColor,
            updateObjectDimensions: uiActions.updateObjectDimensions,
            updateObjectFontSize: uiActions.updateObjectFontSize,
            hasCopiedStyle: Boolean(copiedStyle),
            onCopyStyle: uiActions.onCopyStyle,
            onPasteStyle: uiActions.onPasteStyle,
            onPatchStyle: uiActions.onPatchStyle,
            onPatchAllItems: uiActions.onPatchAllItems,
            onApplyAutoLayout: uiActions.onApplyAutoLayout,
            updateNewConnectorHead: uiActions.updateNewConnectorHead,
            updateNewShapeArrowHead: uiActions.updateNewShapeArrowHead,
            updateShapeArrowBend: uiActions.updateShapeArrowBend,
            multiAgentStore,
            updateAgentItem: uiActions.updateChartItem,
            zoomSensitivity
          }} /></Suspense></ResizablePanel>
          <ScreenShareViewer voice={voice} /><ResizablePanel {...panelLayout.handle('chat')} title={ui('채팅 · 통화')} callActive={voice.state.active}><CanvasChatPanel token={token} voice={voice} tab={communicationTab} onTabChange={uiActions.onChatTabChange} canWrite={canUseCanvas(capabilities, 'write')} chatHistoryLoading={chatHistoryLoading} connection={connection} hasOlderMessages={hasOlderMessages} loadOlderMessages={uiActions.loadOlderMessages} message={message} messages={messages} setMessage={uiActions.setMessage} submitMessage={uiActions.submitMessage} chatMessageTotal={chatMessageTotal} participants={mentionParticipants} highlight={chatHighlight} onHighlightExpired={uiActions.onChatHighlightExpired} onHighlightVisible={uiActions.onChatHighlightVisible} channels={channelControls} onUploadChatMedia={uiActions.onUploadChatMedia} /></ResizablePanel>
        </div>}
        {passwordPrompt.prompt && <CanvasPasswordDialog prompt={passwordPrompt.prompt} theme={theme} />}
        {fileUploads.length > 0 && <div className="toast-message canvas-file-upload-status" role="status">
          <span className="runtime-spinner" aria-hidden="true" />
          <span className="canvas-file-upload-name" title={fileUploads[0].name}>{fileUploads[0].name}</span>
          <span>{fileUploads[0].percent === 100 ? ui('캔버스에 추가하는 중…') : ui('파일을 업로드하는 중…')}</span>
          {fileUploads[0].percent != null && fileUploads[0].percent < 100 && <span aria-hidden="true">{fileUploads[0].percent}%</span>}
          {fileUploads.length > 1 && <span>{ui('외 {count}개', { count: fileUploads.length - 1 })}</span>}
        </div>}
        {toast && <div className="toast-message" role="status"><Icon name="check" size={16} />{ui(toast)}</div>}
        {comments.activeId && <ObjectCommentsPanel token={token} comments={comments} participants={mentionParticipants} connection={connection} />}
        <MentionNotifications notifications={comments.notifications} onJump={jumpToMention} onDismiss={comments.dismiss} channelName={id => textChannels.find(channel => channel.id === id)?.name} />
        {agentEligible && (agentAccess || showAgent) && <CanvasAgentPanel key={`${canvasId}:${user?.user_id || ''}`} theme={theme} isAdmin={Boolean(capabilities?.is_admin)} onBusyChange={uiActions.onAgentBusyChange} open={showAgent} onClose={uiActions.onAgentClose} canvasId={canvasId} selectedIds={selectedObjectIds}
          selectedLabel={selectedItem ? String(selectedItem.title || selectedItem.name || selectedItem.filename || selectedItem.text || selectedItem.kind).slice(0, 100) : undefined}
          canEditSelected={Boolean(selectedItem && canWriteItem(selectedItem) && !isObjectLocked(selectedItem))}
          anchor={showAgent ? centeredItemPosition(0, 0) : null} request={uiActions.onAgentRequest} token={token} canvasConnection={connection} />}
        {showRuntimeSettings && <RuntimeSettingsDialog request={management => executeCanvasCode({ canvasId, action: 'manage', management, sendRaw, pendingRequests: runtimeSocketRequestsRef.current })} canManage={canWriteCanvas && canUseCanvas(capabilities, 'execute')} canvasId={canvasId} token={token} user={user} initialLanguage={selectedItem?.language || 'cpp'} isRunning={() => runtimeStore.isRunning()} onClose={() => setShowRuntimeSettings(false)} />}
        {versionsOpened.current && <CanvasVersionDialog open={showVersions} api={canvasCodeApi} canvasId={canvasId} onClose={() => setShowVersions(false)} onInspect={source => { setCanvasCodeSource(source); setShowVersions(false); setShowCanvasCode(true); }} />}
        {showCanvasCode && <CanvasAsCodeDialog api={canvasCodeApi} canvasId={canvasId} initialSource={canvasCodeSource} onClose={() => setShowCanvasCode(false)} />}
        {showSettings && <SettingsDialog backgroundColor={backgroundColor} setBackgroundColor={setBackgroundColor} favoriteColors={favoriteColors} saveFavoriteColor={saveFavoriteColor} theme={theme} canvasId={canvasId} image={canvas?.image} token={token} onImageSaved={(image) => setCanvas(current => ({ ...current, image }))} settings={settings} pending={settingsPending} onClose={() => setShowSettings(false)} onUpdate={sendSettings} onRequest={requestSettings} />}
        {showParticipants && <CanvasParticipantsDialog participants={canvasParticipants} token={token} settings={settings} pending={settingsPending} onRequest={requestSettings} onClose={() => setShowParticipants(false)} onAddParticipant={(nickname, tag) => sendSettings('participant_add', null, { nickname, tag_number: tag })} onRemoveParticipant={(person) => sendSettings('participant_remove', null, { nickname: person.nickname, tag_number: person.tag_number })} />}
      </div>
      {!error && !hostStatus.editable && <CanvasLoadingStatus overlay message={hostStatus.message} />}
      {portfolioViewing && presentationPage && <PortfolioViewer portfolio={{ ...items[PORTFOLIO_ID], title: items[PORTFOLIO_ID]?.title || ui('포트폴리오'), portfolioPages: presentationPages }} index={portfolioIndex} onAdvance={advancePresentation} sending={presentationSending} busyUntil={presentationBusy.current} step={cursor?.frameId === presentationPage.frameId ? cursor?.step || 0 : 0} totalSteps={animationGroups(presentationPage, itemsRef.current).length} canAdvance={portfolioWritable(presentationPage.frame || itemsRef.current[PORTFOLIO_ID]) && portfolioWritable(itemsRef.current[PORTFOLIO_ID] || frameMeta())} remainingFrames={(() => { let n = 0, id = presentationPage.nextFrameId; const seen = new Set([presentationPage.frameId]); while (id && !seen.has(id)) { seen.add(id); n++; id = presentationPageById.get(id)?.nextFrameId; } return n; })()} locked={portfolioLocked} onExit={exitPortfolio} />}
    </div></ProjectContext.Provider></AnimationContext.Provider></WebAssetsContext.Provider></LiveContentContext.Provider>;
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
