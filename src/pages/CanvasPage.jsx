import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Automerge from '@automerge/automerge/slim';
import automergeWasmUrl from '@automerge/automerge/automerge.wasm?url';
import { Link, useNavigate, useParams } from '../routing.jsx';
import Icon from '../components/Icon.jsx';
import MathFormula from '../components/MathFormula.jsx';
import VectorLayer from '../components/VectorLayer.jsx';
import CanvasPeerMesh from '../components/CanvasPeerMesh.js';
import CanvasSpatialBTree from '../components/CanvasSpatialBTree.js';
import { api, apiUrl, canvasSocketUrl, rtcSocketUrl } from '../api/client.js';
import { useAuth } from '../state/AuthContext.jsx';

const inkColors = ['#263b35', '#d9785e', '#617db2', '#d8a443', '#7e6b9d'];
const CHAT_ROOM_ID = 'general';
const CHAT_HISTORY_LIMIT = 50;
const ZOOM_SENSITIVITY_KEY = 'agora_canvas_zoom_sensitivity';
const MIN_ZOOM_SENSITIVITY = 0.5;
const MAX_ZOOM_SENSITIVITY = 2;
const createId = () => globalThis.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const automergeReady = Automerge.initializeWasm(automergeWasmUrl);

function toChatEntry(message, user) {
  const numericTimestamp = Number(message.created_at);
  const timestamp = Number.isFinite(numericTimestamp) && String(message.created_at ?? '').trim() !== ''
    ? new Date(numericTimestamp < 1e12 ? numericTimestamp * 1000 : numericTimestamp)
    : new Date(message.created_at || Date.now());
  const sequence = Number(message.sequence);
  const hasSequence = Number.isFinite(sequence) && sequence > 0;
  const nickname = message.sender || '알 수 없는 사용자';
  const tagNumber = message.tag_number;
  return {
    id: hasSequence ? `${CHAT_ROOM_ID}-${sequence}` : createId(),
    sequence: hasSequence ? sequence : null,
    sender: `${nickname}#${tagNumber ?? '?'}`,
    text: message.text || '',
    time: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
    own: nickname === user?.nickname && Number(tagNumber) === Number(user?.tag_number),
  };
}

function mergeChatEntries(current, incoming) {
  const entries = new Map();
  for (const entry of [...current, ...incoming]) {
    entries.set(entry.sequence == null ? entry.id : `sequence-${entry.sequence}`, entry);
  }
  return [...entries.values()].sort((left, right) => {
    if (left.sequence == null) return 1;
    if (right.sequence == null) return -1;
    return left.sequence - right.sequence;
  });
}

function encodeBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(encoded) {
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function collaborativeField(item) {
  return item.kind === 'code' ? 'code' : 'text';
}

function collaborativeContent(item) {
  return item?.[collaborativeField(item)] || '';
}

function createActorId() {
  return globalThis.crypto?.randomUUID?.().replaceAll('-', '') || `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function makeCollaborativeItem(item) {
  if (!['text', 'note', 'code'].includes(item.kind)) return item;
  const doc = Automerge.from({ content: collaborativeContent(item) });
  return {
    ...item,
    automerge_snapshot: encodeBase64(Automerge.save(doc)),
    automerge_changes: [],
  };
}

function mergeCollaborativeHistory(...histories) {
  const seen = new Set();
  const merged = [];
  for (const history of histories) {
    for (const entry of history || []) {
      const change = typeof entry === 'string' ? entry : entry?.change;
      if (!change || seen.has(change)) continue;
      seen.add(change);
      merged.push(typeof entry === 'string' ? { change } : entry);
    }
  }
  return merged;
}

function isCollaborativeItem(item) {
  return ['text', 'note', 'code'].includes(item?.kind);
}

function canPeerAccessItem(item, peer) {
  if (peer?.is_admin) return true;
  const allowedGroups = new Set(Array.isArray(peer?.groups) ? peer.groups : []);
  const permission = item?.permission;
  const required = typeof permission === 'string' ? [permission]
    : Array.isArray(permission) ? permission
      : permission && typeof permission === 'object'
        ? Object.entries(permission).filter(([, level]) => Number(level) > 0).map(([group]) => group)
        : [];
  return required.some((group) => allowedGroups.has(String(group)));
}

function cursorColor(nickname, tagNumber) {
  const identity = `${nickname || ''}#${tagNumber ?? ''}`;
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `hsl(${(hash >>> 0) % 360} 66% 43%)`;
}

function SettingsDialog({ settings, pending, onClose, onUpdate, onAddParticipant, onRemoveParticipant }) {
  const [name, setName] = useState(settings?.canvas_name || '');
  const [description, setDescription] = useState(settings?.description || '');
  const [password, setPassword] = useState('');
  const [participant, setParticipant] = useState({ nickname: '', tag: '' });
  const [message, setMessage] = useState('');
  useEffect(() => { setName(settings?.canvas_name || ''); setDescription(settings?.description || ''); }, [settings]);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-card settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><button className="icon-button modal-close" onClick={onClose} aria-label="닫기"><Icon name="close" /></button><span className="section-kicker">CANVAS SETTINGS</span><h2 id="settings-title">캔버스 설정</h2><p>변경 사항은 접속 중인 멤버에게 바로 전달돼요.</p>
    <div className="settings-dialog-content"><label className="form-field"><span>캔버스 이름</span><div className="setting-row"><input className="plain-input" value={name} maxLength={255} onChange={(e) => setName(e.target.value)} /><button className="button button-outline" disabled={pending || name === settings?.canvas_name} onClick={() => onUpdate('name', name)}>저장</button></div></label><label className="form-field"><span>설명</span><div className="setting-row"><textarea className="plain-input" rows="2" value={description} onChange={(e) => setDescription(e.target.value)} /><button className="button button-outline" disabled={pending || description === (settings?.description || '')} onClick={() => onUpdate('description', description)}>저장</button></div></label><label className="form-field"><span>비밀번호 <small>{settings?.password_protected ? '현재 보호 중' : '현재 비밀번호 없음'}</small></span><div className="setting-row"><input className="plain-input" type="password" placeholder="새 비밀번호 입력" value={password} onChange={(e) => setPassword(e.target.value)} /><button className="button button-outline" disabled={pending || !password} onClick={() => { onUpdate('password', password); setPassword(''); }}>적용</button></div></label>
      <div className="form-field"><span>참여자 <small>닉네임과 태그로 관리</small></span><div className="participant-chips">{(settings?.participants || []).map((person) => <span className="participant-chip" key={`${person.nickname}-${person.tag_number}`}><i>{person.nickname.slice(0, 1)}</i>{person.nickname}#{person.tag_number}<button onClick={() => onRemoveParticipant(person)} aria-label={`${person.nickname} 참여자 제외`} title="참여자 제외">×</button></span>)}</div><div className="setting-row participant-add-row"><input className="plain-input" placeholder="닉네임" value={participant.nickname} onChange={(e) => setParticipant({ ...participant, nickname: e.target.value })} /><input className="plain-input tag-input" inputMode="numeric" placeholder="태그" value={participant.tag} onChange={(e) => setParticipant({ ...participant, tag: e.target.value })} /><button className="button button-outline" disabled={pending || !participant.nickname || !participant.tag} onClick={() => { onAddParticipant(participant.nickname, Number(participant.tag)); setParticipant({ nickname: '', tag: '' }); }}>추가</button></div></div>
    </div>{message && <p className="field-hint">{message}</p>}{pending && <div className="settings-pending"><span className="loader" /> 변경 내용을 확인하고 있어요.</div>}<div className="settings-dialog-footer"><span>revision {settings?.settings_revision ?? '—'}</span><button className="button button-dark" onClick={onClose}>완료</button></div>
  </section></div>;
}

function CanvasObject({ id, item, activeTool, connectionStartId, editing, dirty, onStartEditing, onTextChange, onMetadataChange, onStopEditing, onSave, onPointerDown, onPointerMove, onPointerUp, onDelete, onCopy }) {
  const width = Number(item.width) || ({ image: 0.3, code: 0.32, shape: 0.14, math: 0.2, text: 0.22, note: 0.22 }[item.kind] || 0.2);
  const height = Number(item.height) || ({ shape: 0.12, math: 0.09, text: 0.12, note: 0.15 }[item.kind] || 0.2);
  const style = { left: `${(Number(item.x) || 0) * 100}%`, top: `${(Number(item.y) || 0) * 100}%`, width: `${width * 100}%`, '--object-color': item.color || '#617d68' };
  if (item.height) style.height = `${height * 100}%`;
  const movable = activeTool === 'select';
  const classes = `canvas-object canvas-object-${item.kind}${movable ? ' movable' : ''}${connectionStartId === id ? ' connection-source' : ''}`;
  const handlers = { onPointerDown: (event) => onPointerDown(event, id, item), onPointerMove, onPointerUp, onPointerCancel: onPointerUp };

  if (item.kind === 'image') return <div key={id} className={`${classes} image-object`} style={style} {...handlers}><img src={item.src} alt={item.filename || '공유된 이미지'} /><div className="object-caption"><Icon name="image" size={13} />{item.filename || '공유 이미지'}<button onClick={() => onDelete(id)} aria-label="이미지 삭제">×</button></div></div>;
  if (item.kind === 'code') return <div key={id} className={`${classes} code-object`} style={style} data-item-id={id} {...handlers} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onStopEditing(id); }} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.stopPropagation(); onSave(id); } }}><div className="code-object-head"><span className="code-file-icon"><Icon name="code" size={15} /></span>{editing ? <><input className="code-filename-input" aria-label="코드 파일 이름" value={item.filename || ''} placeholder="idea.js" maxLength={80} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => onMetadataChange(id, 'filename', event.target.value)} /><select className="code-language-select" aria-label="코드 언어" value={item.language || 'javascript'} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => onMetadataChange(id, 'language', event.target.value)}><option>javascript</option><option>typescript</option><option>python</option><option>html</option><option>css</option><option>json</option><option>text</option></select></> : <><strong>{item.filename || 'snippet.js'}</strong><small>{item.language || 'text'}</small></>}<button onClick={() => onDelete(id)} aria-label="코드 삭제">×</button></div>{editing ? <textarea className="code-shared-input" autoFocus aria-label="공동 편집 코드" value={item.code || ''} placeholder="여기에 코드를 작성하세요." onPointerDown={(event) => event.stopPropagation()} onChange={(event) => onTextChange(id, event.target.value)} /> : <pre onDoubleClick={() => onStartEditing(id)} title="두 번 클릭해 함께 편집"><code>{item.code}</code></pre>}<div className="code-object-foot"><span><i /> {dirty ? '저장되지 않음 · Ctrl + S' : editing ? 'P2P 실시간 편집' : '두 번 클릭해 편집'}</span><button onClick={() => onCopy(item.code || '')}>복사</button></div></div>;
  if (item.kind === 'shape') return <div key={id} className={`${classes} shape-object shape-vector-hit shape-${item.shapeType || 'rectangle'}`} style={style} {...handlers}><button onClick={() => onDelete(id)} aria-label="도형 삭제">×</button></div>;
  if (item.kind === 'text' || item.kind === 'note') return <div key={id} className={`${classes} text-object`} style={style} data-item-id={id} {...handlers}>{editing ? <><textarea autoFocus aria-label="공동 편집 텍스트" value={item.text || ''} placeholder="여기에 텍스트를 입력하세요." onPointerDown={(event) => event.stopPropagation()} onChange={(event) => onTextChange(id, event.target.value)} onBlur={() => onStopEditing(id)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.stopPropagation(); onSave(id); } }} /><small className="collab-save-hint">{dirty ? '저장되지 않음 · Ctrl + S' : '저장됨'}</small></> : <p onDoubleClick={() => onStartEditing(id)} title="두 번 클릭해 함께 편집">{item.text || '두 번 클릭해 편집'}</p>}<button onClick={() => onDelete(id)} aria-label="텍스트 삭제">×</button></div>;
  if (item.kind === 'math') return <div key={id} className={`${classes} math-object`} style={style} {...handlers}><MathFormula formula={item.formula || item.text || 'x + y'} /><button onClick={() => onDelete(id)} aria-label="수식 삭제">×</button></div>;
  return null;
}

function CanvasWorkspace() {
  const { canvasId } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const boardRef = useRef(null);
  const wsRef = useRef(null);
  const rtcWsRef = useRef(null);
  const itemsRef = useRef({});
  const pendingItemChangesRef = useRef([]);
  const rejectedEventPongsRef = useRef(0);
  const collaborativeDocsRef = useRef(new Map());
  const collaborativeBaseDocsRef = useRef(new Map());
  const groupsRef = useRef([]);
  const dirtyItemsRef = useRef(new Set());
  const peerMeshRef = useRef(null);
  const syncedPeersRef = useRef(new Set());
  const newCollaborativeItemsRef = useRef(new Set());
  const chatHistoryRequestRef = useRef(null);
  const chatHistoryPageRef = useRef({ hasMore: false, nextToSequence: null });
  const itemEditRevisionRef = useRef(new Map());
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const spacePressedRef = useRef(false);
  const lastCursorSentAtRef = useRef(0);
  const drawingRef = useRef(false);
  const draftRef = useRef([]);
  const vectorDraftRef = useRef(null);
  const [canvas, setCanvas] = useState(null);
  const [itemsInitialized, setItemsInitialized] = useState(false);
  const [items, setItems] = useState({});
  const [spatialRevision, setSpatialRevision] = useState(0);
  const [groups, setGroups] = useState([]);
  const [peerList, setPeerList] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [dirtyItems, setDirtyItems] = useState(() => new Set());
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [boardSize, setBoardSize] = useState({ width: 1, height: 1 });
  const [zoomSensitivity, setZoomSensitivity] = useState(() => {
    const stored = Number(localStorage.getItem(ZOOM_SENSITIVITY_KEY));
    return Number.isFinite(stored) && stored >= MIN_ZOOM_SENSITIVITY && stored <= MAX_ZOOM_SENSITIVITY ? stored : 1;
  });
  const [settings, setSettings] = useState(null);
  const [connection, setConnection] = useState('connecting');
  const [error, setError] = useState('');
  const [activeTool, setActiveTool] = useState('select');
  const [color, setColor] = useState(inkColors[0]);
  const [theme, setTheme] = useState(() => localStorage.getItem('agora_canvas_theme') || 'light');
  const [showGrid, setShowGrid] = useState(() => localStorage.getItem('agora_canvas_grid') !== 'false');
  const [shapeType, setShapeType] = useState('rectangle');
  const [connectionStartId, setConnectionStartId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [canvasImageSrc, setCanvasImageSrc] = useState('');
  const [messages, setMessages] = useState([]);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPending, setSettingsPending] = useState(false);
  const [toast, setToast] = useState('');
  groupsRef.current = groups;
  dirtyItemsRef.current = dirtyItems;

  const sendRaw = useCallback((payload) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload)); return true;
  }, []);
  const sendRtcRaw = useCallback((payload) => {
    const socket = rtcWsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload)); return true;
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
    setDirtyItems((current) => new Set(current).add(key));
  }, []);
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
      nextDoc = Automerge.change(previousDoc, (draft) => Automerge.updateText(draft, ['content'], value));
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
    if (change) peerMeshRef.current?.sendData({ type: 'doc_change', item_id: String(id), field, change }, (peer) => canPeerAccessItem(item, peer));
    markItemDirty(id);
  }, [getCollaborativeDoc, markItemDirty]);
  const updateCollaborativeMetadata = useCallback((id, field, value) => {
    const key = String(id);
    const item = itemsRef.current[key];
    if (!isCollaborativeItem(item) || !['filename', 'language'].includes(field)) return;
    const nextItem = { ...item, [field]: value };
    itemsRef.current = { ...itemsRef.current, [key]: nextItem };
    setItems((current) => ({ ...current, [key]: nextItem }));
    markItemDirty(key);
    peerMeshRef.current?.sendData({ type: 'item_metadata', item_id: key, field, value }, (peer) => canPeerAccessItem(nextItem, peer));
  }, [markItemDirty]);
  const sendItemChange = useCallback((payload, previous) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    const id = String(payload.item_id);
    pendingItemChangesRef.current.push({
      id,
      previous,
      type: payload.type,
      wasNewCollaborative: payload.type === 'item_save' && newCollaborativeItemsRef.current.has(id),
    });
    socket.send(JSON.stringify(payload));
    socket.send(JSON.stringify({ type: 'ping' }));
    return true;
  }, []);
  const addItem = useCallback((id, item) => {
    if (!itemsInitialized || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
    const sharedItem = makeCollaborativeItem(item);
    if (isCollaborativeItem(sharedItem)) {
      const baseDoc = Automerge.load(decodeBase64(sharedItem.automerge_snapshot), { actor: createActorId() });
      itemsRef.current = { ...itemsRef.current, [id]: sharedItem };
      collaborativeDocsRef.current.set(String(id), baseDoc);
      collaborativeBaseDocsRef.current.set(String(id), baseDoc);
      newCollaborativeItemsRef.current.add(String(id));
      setItems((current) => ({ ...current, [id]: sharedItem }));
      setSelectedItemId(String(id));
      refreshSpatialIndex();
      markItemDirty(id);
      peerMeshRef.current?.sendData({ type: 'item_create', item_id: String(id), item: sharedItem }, (peer) => canPeerAccessItem(sharedItem, peer));
      return true;
    }
    if (!sendItemChange({ type: 'item_update', item_id: id, item: sharedItem }, null)) return false;
    itemsRef.current = { ...itemsRef.current, [id]: sharedItem };
    setItems((current) => ({ ...current, [id]: sharedItem }));
    refreshSpatialIndex();
    return true;
  }, [itemsInitialized, markItemDirty, refreshSpatialIndex, sendItemChange]);
  const deleteItem = useCallback((id) => {
    const previous = itemsRef.current[id];
    const key = String(id);
    const isUnsavedCollaborative = isCollaborativeItem(previous) && newCollaborativeItemsRef.current.has(key);
    if (isUnsavedCollaborative) peerMeshRef.current?.sendData({ type: 'item_delete', item_id: key }, (peer) => canPeerAccessItem(previous, peer));
    else if (!sendItemChange({ type: 'item_delete', item_id: id }, previous)) return false;
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
  const saveCollaborativeItem = useCallback((id) => {
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
      setToast('서버 연결이 복구되면 Ctrl + S로 다시 저장해주세요.');
      return false;
    }
    itemsRef.current = { ...itemsRef.current, [key]: savedItem };
    setItems((current) => ({ ...current, [key]: savedItem }));
    newCollaborativeItemsRef.current.delete(key);
    if ((itemEditRevisionRef.current.get(key) || 0) === revision) {
      setDirtyItems((current) => { const next = new Set(current); next.delete(key); return next; });
    }
    setToast('텍스트 저장 요청을 서버에 보냈습니다.');
    window.setTimeout(() => setToast(''), 2400);
    return true;
  }, [getCollaborativeBaseDoc, getCollaborativeDoc, sendItemChange]);
  const receivePeerData = useCallback((peer, data) => {
    if (!data || typeof data !== 'object') return;
    const localPeer = { groups: groupsRef.current, is_admin: groupsRef.current.includes('admin-group') };
    if (data.type === 'item_create' && data.item_id && isCollaborativeItem(data.item)) {
      const key = String(data.item_id);
      if (!canPeerAccessItem(data.item, localPeer) || !canPeerAccessItem(data.item, peer)) return;
      const existing = itemsRef.current[key];
      let item = data.item;
      if (existing && isCollaborativeItem(existing)) {
        try {
          const localDoc = getCollaborativeDoc(key, existing);
          const incomingDoc = Automerge.load(decodeBase64(data.item.automerge_snapshot), { actor: createActorId() });
          const mergedDoc = Automerge.merge(localDoc, incomingDoc);
          collaborativeDocsRef.current.set(key, mergedDoc);
          item = { ...existing, ...data.item, [collaborativeField(data.item)]: mergedDoc.content };
        } catch { return; }
      } else {
        try {
          const baseDoc = Automerge.load(decodeBase64(item.automerge_snapshot), { actor: createActorId() });
          collaborativeBaseDocsRef.current.set(key, baseDoc);
          collaborativeDocsRef.current.set(key, baseDoc);
        }
        catch { return; }
      }
      itemsRef.current = { ...itemsRef.current, [key]: item };
      newCollaborativeItemsRef.current.add(key);
      setItems((current) => ({ ...current, [key]: item }));
      if (!existing) refreshSpatialIndex();
      markItemDirty(key);
      return;
    }
    if (data.type === 'doc_snapshot' && data.item_id && data.snapshot) {
      const key = String(data.item_id);
      const item = data.item || itemsRef.current[key];
      if (!isCollaborativeItem(item) || !canPeerAccessItem(item, localPeer) || !canPeerAccessItem(item, peer)) return;
      try {
        const incomingDoc = Automerge.load(decodeBase64(data.snapshot), { actor: createActorId() });
        const localItem = itemsRef.current[key];
        const localDoc = localItem ? getCollaborativeDoc(key, localItem) : incomingDoc;
        const mergedDoc = localItem ? Automerge.merge(localDoc, incomingDoc) : incomingDoc;
        if (!localItem && item.automerge_snapshot) {
          collaborativeBaseDocsRef.current.set(key, Automerge.load(decodeBase64(item.automerge_snapshot), { actor: createActorId() }));
        }
        const field = collaborativeField(item);
        const mergedItem = { ...item, ...localItem, [field]: mergedDoc.content };
        collaborativeDocsRef.current.set(key, mergedDoc);
        itemsRef.current = { ...itemsRef.current, [key]: mergedItem };
        setItems((current) => ({ ...current, [key]: mergedItem }));
        if (!localItem) {
          newCollaborativeItemsRef.current.add(key);
          refreshSpatialIndex();
        }
        if (data.dirty) markItemDirty(key);
      } catch { /* Ignore an invalid/stale Automerge snapshot. */ }
      return;
    }
    if (data.type === 'doc_change' && data.item_id && data.change) {
      const key = String(data.item_id);
      const item = itemsRef.current[key];
      if (!isCollaborativeItem(item) || !canPeerAccessItem(item, localPeer) || !canPeerAccessItem(item, peer)) return;
      const expectedField = collaborativeField(item);
      if (data.field !== expectedField) return;
      try {
        const doc = Automerge.loadIncremental(getCollaborativeDoc(key, item), decodeBase64(data.change));
        collaborativeDocsRef.current.set(key, doc);
        const nextItem = { ...item, [expectedField]: doc.content };
        itemsRef.current = { ...itemsRef.current, [key]: nextItem };
        setItems((current) => ({ ...current, [key]: nextItem }));
        markItemDirty(key);
      } catch { /* A later snapshot can recover an interrupted peer sync. */ }
      return;
    }
    if (data.type === 'item_metadata' && data.item_id && ['filename', 'language'].includes(data.field)) {
      const key = String(data.item_id);
      const item = itemsRef.current[key];
      if (!isCollaborativeItem(item) || !canPeerAccessItem(item, localPeer) || !canPeerAccessItem(item, peer)) return;
      const value = String(data.value ?? '');
      if (item[data.field] === value) return;
      const nextItem = { ...item, [data.field]: value };
      itemsRef.current = { ...itemsRef.current, [key]: nextItem };
      setItems((current) => ({ ...current, [key]: nextItem }));
      markItemDirty(key);
      return;
    }
    if (data.type === 'item_geometry' && data.item_id) {
      const key = String(data.item_id);
      const item = itemsRef.current[key];
      if (!isCollaborativeItem(item) || !canPeerAccessItem(item, localPeer) || !canPeerAccessItem(item, peer)) return;
      const nextItem = { ...item, x: Number(data.x) || 0, y: Number(data.y) || 0 };
      itemsRef.current = { ...itemsRef.current, [key]: nextItem };
      setItems((current) => ({ ...current, [key]: nextItem }));
      if (item.x !== nextItem.x || item.y !== nextItem.y) refreshSpatialIndex();
      markItemDirty(key);
      return;
    }
    if (data.type === 'item_delete' && data.item_id) {
      const key = String(data.item_id);
      const item = itemsRef.current[key];
      if (!isCollaborativeItem(item) || !canPeerAccessItem(item, localPeer) || !canPeerAccessItem(item, peer)) return;
      const next = { ...itemsRef.current };
      delete next[key];
      itemsRef.current = next;
      collaborativeDocsRef.current.delete(key);
      collaborativeBaseDocsRef.current.delete(key);
      newCollaborativeItemsRef.current.delete(key);
      setItems(next);
      refreshSpatialIndex();
      setDirtyItems((current) => { const dirty = new Set(current); dirty.delete(key); return dirty; });
    }
  }, [getCollaborativeDoc, markItemDirty, refreshSpatialIndex]);

  useEffect(() => {
    let cancelled = false;
    let socket;
    let rtcSocket;
    let rtcReady = false;
    let canvasConnectionId = '';
    let canvasConnectionHash = '';
    let joinedCanvasConnectionId = '';
    const joinRtcSocket = () => {
      if (!rtcReady || !canvasConnectionId || !canvasConnectionHash || !rtcSocket || rtcSocket.readyState !== WebSocket.OPEN
        || joinedCanvasConnectionId === canvasConnectionId) return;
      rtcSocket.send(JSON.stringify({
        type: 'rtc_join',
        canvas_connection_id: canvasConnectionId,
        canvas_connection_hash: canvasConnectionHash,
      }));
      joinedCanvasConnectionId = canvasConnectionId;
    };
    const resetPeerMesh = () => {
      if (peerMeshRef.current) peerMeshRef.current.close();
      peerMeshRef.current = null;
      syncedPeersRef.current.clear();
      setPeerList([]);
      setRemoteCursors({});
    };
    async function connect() {
      setConnection('connecting'); setError(''); setItemsInitialized(false);
      setMessages([]);
      setHasOlderMessages(false);
      setChatHistoryLoading(false);
      chatHistoryRequestRef.current = null;
      chatHistoryPageRef.current = { hasMore: false, nextToSequence: null };
      try {
        const summary = await api(`/api/canvases/${canvasId}`, { token });
        if (cancelled) return;
        setCanvas(summary);
        let access;
        try { access = await api(`/api/canvases/${canvasId}/access`, { method: 'POST', token }); }
        catch (err) {
          if (err.code !== 'CANVAS_004') throw err;
          const password = window.prompt('이 캔버스의 비밀번호를 입력해주세요.');
          if (password === null) { navigate('/search'); return; }
          access = await api(`/api/canvases/${canvasId}/access`, { method: 'POST', token, body: { password } });
        }
        if (cancelled) return;
        socket = new WebSocket(canvasSocketUrl(canvasId, access.ws_port, access.canvas_access_token));
        wsRef.current = socket;
        rtcSocket = new WebSocket(rtcSocketUrl(canvasId, access.ws_port, access.canvas_access_token));
        rtcWsRef.current = rtcSocket;
        const handleRtcMessage = (event) => {
          let data;
          try { data = JSON.parse(event.data); } catch { return; }
          if (data.type === 'rtc_ready') {
            rtcReady = true;
            joinRtcSocket();
            return;
          }
          if (data.type === 'rtc_peers') {
            let mesh = peerMeshRef.current;
            if (!mesh) {
              mesh = new CanvasPeerMesh({
                sendSignal: sendRtcRaw,
                onData: receivePeerData,
                onCursor: (peer, cursor) => {
                  if (cursor.visible === false) {
                    setRemoteCursors((current) => { const next = { ...current }; delete next[peer.peer_id]; return next; });
                    return;
                  }
                  if (!Number.isFinite(Number(cursor.x)) || !Number.isFinite(Number(cursor.y))) return;
                  setRemoteCursors((current) => ({
                    ...current,
                    [peer.peer_id]: { ...peer, x: Number(cursor.x), y: Number(cursor.y), color: cursorColor(peer.nickname, peer.tag_number) },
                  }));
                },
                onPeersChanged: (peers) => {
                  setPeerList(peers);
                  const activeIds = new Set(peers.map((peer) => peer.peer_id));
                  setRemoteCursors((current) => Object.fromEntries(Object.entries(current).filter(([peerId]) => activeIds.has(peerId))));
                  for (const peer of peers) {
                    if (!peer.connected || syncedPeersRef.current.has(peer.peer_id)) continue;
                    syncedPeersRef.current.add(peer.peer_id);
                    for (const [id, item] of Object.entries(itemsRef.current)) {
                      if (!isCollaborativeItem(item) || !canPeerAccessItem(item, peer)) continue;
                      try {
                        const doc = getCollaborativeDoc(id, item);
                        const field = collaborativeField(item);
                        mesh.sendToPeer(peer.peer_id, {
                          type: 'doc_snapshot', item_id: id,
                          item: { ...item, [field]: doc.content },
                          snapshot: encodeBase64(Automerge.save(doc)),
                          dirty: dirtyItemsRef.current.has(String(id)),
                        });
                      } catch { /* A later snapshot can recover an interrupted peer sync. */ }
                    }
                  }
                },
              });
              peerMeshRef.current = mesh;
            }
            mesh.setInitialPeers(data.self_peer_id, data.peers);
            return;
          }
          if (data.type === 'rtc_peer_joined') {
            peerMeshRef.current?.addPeer(data.peer);
            return;
          }
          if (data.type === 'rtc_peer_left') {
            peerMeshRef.current?.removePeer(data.peer_id);
            syncedPeersRef.current.delete(data.peer_id);
            setRemoteCursors((current) => { const next = { ...current }; delete next[data.peer_id]; return next; });
            return;
          }
          if (data.type === 'rtc_signal') {
            void peerMeshRef.current?.handleSignal(data);
            return;
          }
          if (data.type === 'rtc_disconnected') {
            resetPeerMesh();
            return;
          }
          if (data.type === 'error' && data.code?.startsWith('RTC_')) {
            setToast(`P2P 연결 오류: ${data.code}`);
          }
        };
        rtcSocket.onmessage = handleRtcMessage;
        rtcSocket.onerror = () => {
          if (!cancelled && wsRef.current?.readyState === WebSocket.OPEN) setToast('P2P 신호 서버에 연결할 수 없습니다.');
        };
        rtcSocket.onclose = () => {
          if (rtcWsRef.current === rtcSocket) rtcWsRef.current = null;
          resetPeerMesh();
          if (!cancelled && wsRef.current?.readyState === WebSocket.OPEN) setToast('P2P 신호 연결이 종료되었습니다.');
        };
        socket.onopen = () => { if (!cancelled) setConnection('connected'); };
        socket.onmessage = (event) => {
          let data;
          try { data = JSON.parse(event.data); } catch { return; }
          if (data.type === 'init_items') {
            const initialItems = data.items && typeof data.items === 'object' ? data.items : {};
            collaborativeDocsRef.current.clear();
            collaborativeBaseDocsRef.current.clear();
            const hydratedItems = { ...initialItems };
            for (const [id, item] of Object.entries(initialItems)) {
              if (!isCollaborativeItem(item)) continue;
              try {
                const doc = getCollaborativeDoc(id, item);
                hydratedItems[id] = { ...item, [collaborativeField(item)]: doc.content };
              } catch { /* Keep the stored plain-text fallback for damaged legacy snapshots. */ }
            }
            itemsRef.current = hydratedItems;
            setItems(hydratedItems);
            refreshSpatialIndex();
            setItemsInitialized(true);
            const currentGroups = Array.isArray(data.groups) ? data.groups : [];
            groupsRef.current = currentGroups;
            setGroups(currentGroups);
            setCanvas((current) => ({ ...current, canvas_name: data.canvas_name || current?.canvas_name }));
            canvasConnectionId = data.rtc_canvas_connection_id == null ? '' : String(data.rtc_canvas_connection_id);
            canvasConnectionHash = typeof data.rtc_canvas_connection_hash === 'string' ? data.rtc_canvas_connection_hash : '';
            if (!canvasConnectionId || !canvasConnectionHash) setToast('RTC 연결 증명값을 받지 못했습니다. 페이지를 새로고침해주세요.');
            joinRtcSocket();
            sendRaw({ type: 'canvas_settings_get' });
            requestChatHistory();
            return;
          }
          if (data.type === 'canvas_settings_snapshot' || data.type === 'canvas_settings_changed') {
            setSettings(data.settings);
            setCanvas((current) => ({ ...current, canvas_name: data.settings?.canvas_name || current?.canvas_name, description: data.settings?.description ?? current?.description }));
            return;
          }
          if (data.type === 'canvas_settings_result') {
            setSettingsPending(false);
            if (data.settings) setSettings(data.settings);
            setToast(data.ok ? '설정이 업데이트되었습니다.' : data.code === 'SETTINGS_CONFLICT' ? '다른 변경사항이 먼저 저장되어 최신 정보를 불러왔어요.' : `설정 변경 실패: ${data.code || '오류'}`);
            window.setTimeout(() => setToast(''), 3400);
            return;
          }
          if (data.type === 'item_crdt_change') return;
          if (data.type === 'item_update' || data.type === 'item_add' || data.type === 'update_item' || data.type === 'item_save') {
            const id = data.item_id ?? data['item-id'];
            const item = data.item || data.data;
            if (id != null && item && typeof item === 'object') {
              const key = String(id);
              const existing = itemsRef.current[key];
              let nextItem = item;
              if (isCollaborativeItem(item)) {
                try {
                  let doc;
                  let savedDoc;
                  if (data.type === 'item_save' && item.automerge_snapshot) {
                    const incomingBaseDoc = Automerge.load(decodeBase64(item.automerge_snapshot), { actor: createActorId() });
                    if (!collaborativeBaseDocsRef.current.has(key)) collaborativeBaseDocsRef.current.set(key, incomingBaseDoc);
                    savedDoc = incomingBaseDoc;
                    for (const entry of item.automerge_changes || []) {
                      const change = typeof entry === 'string' ? entry : entry?.change;
                      if (change) savedDoc = Automerge.loadIncremental(savedDoc, decodeBase64(change));
                    }
                    doc = existing && isCollaborativeItem(existing)
                      ? Automerge.merge(getCollaborativeDoc(key, existing), savedDoc)
                      : savedDoc;
                  } else if (existing && existing.kind === item.kind) {
                    doc = getCollaborativeDoc(key, existing);
                    for (const entry of item.automerge_changes || []) {
                      const change = typeof entry === 'string' ? entry : entry?.change;
                      if (change) doc = Automerge.loadIncremental(doc, decodeBase64(change));
                    }
                  } else if (item.automerge_snapshot) {
                    doc = Automerge.load(decodeBase64(item.automerge_snapshot), { actor: createActorId() });
                  } else {
                    doc = Automerge.from({ content: collaborativeContent(item) });
                  }
                  collaborativeDocsRef.current.set(key, doc);
                  const field = collaborativeField(item);
                  nextItem = {
                    ...(existing || {}),
                    ...item,
                    [field]: doc.content,
                    automerge_changes: mergeCollaborativeHistory(existing?.automerge_changes, item.automerge_changes),
                  };
                  if (data.type === 'item_save') {
                    newCollaborativeItemsRef.current.delete(key);
                    if (savedDoc && doc.content !== savedDoc.content) markItemDirty(key);
                    else setDirtyItems((current) => { const next = new Set(current); next.delete(key); return next; });
                  }
                } catch { /* Keep the server-sent item if its legacy CRDT data cannot be read. */ }
              }
              const next = { ...itemsRef.current, [key]: nextItem };
              itemsRef.current = next;
              if (nextItem === item) collaborativeDocsRef.current.delete(key);
              setItems(next);
              if (!existing || existing.x !== nextItem.x || existing.y !== nextItem.y
                || existing.width !== nextItem.width || existing.height !== nextItem.height) refreshSpatialIndex();
            }
            return;
          }
          if (data.type === 'item_delete' || data.type === 'delete_item') {
            const id = data.item_id ?? data['item-id'];
            if (id != null) {
              const next = { ...itemsRef.current };
              delete next[id];
              itemsRef.current = next;
              collaborativeDocsRef.current.delete(String(id));
              setItems(next);
              refreshSpatialIndex();
            }
            return;
          }
          if (data.type === 'chat_history') {
            if (chatHistoryRequestRef.current && data.request_id !== chatHistoryRequestRef.current) return;
            chatHistoryRequestRef.current = null;
            setChatHistoryLoading(false);
            const entries = Array.isArray(data.messages) ? data.messages.map((entry) => toChatEntry(entry, user)) : [];
            setMessages((current) => mergeChatEntries(current, entries));
            const nextToSequence = Number(data.next_to_sequence);
            const hasMore = Boolean(data.has_more) && Number.isFinite(nextToSequence) && nextToSequence > 0;
            chatHistoryPageRef.current = { hasMore, nextToSequence: hasMore ? nextToSequence : null };
            setHasOlderMessages(hasMore);
            return;
          }
          if (data.type === 'chat') {
            setMessages((current) => mergeChatEntries(current, [toChatEntry(data, user)]));
            return;
          }
          if (data.type === 'pong') {
            if (rejectedEventPongsRef.current > 0) rejectedEventPongsRef.current -= 1;
            else pendingItemChangesRef.current.shift();
            return;
          }
          if (data.type === 'error') {
            if (chatHistoryRequestRef.current && data.request_id === chatHistoryRequestRef.current) {
              chatHistoryRequestRef.current = null;
              setChatHistoryLoading(false);
              if (data.code === 'CHAT_ROOM_NOT_FOUND') {
                chatHistoryPageRef.current = { hasMore: false, nextToSequence: null };
                setHasOlderMessages(false);
                return;
              }
              setToast(data.code === 'ITEM_ACCESS_DENIED' ? '이 채팅방의 내역을 볼 권한이 없습니다.' : `채팅 내역을 불러오지 못했습니다: ${data.code || '오류'}`);
              return;
            }
            if (data.code?.startsWith('CHAT_')) {
              setToast(`채팅을 처리하지 못했습니다: ${data.code}`);
              return;
            }
            if (['ITEM_ACCESS_DENIED', 'ITEM_SAVE_INVALID', 'ITEM_SAVE_REQUIRED'].includes(data.code)) {
              const rejected = pendingItemChangesRef.current.shift();
              if (rejected) {
                rejectedEventPongsRef.current += 1;
                if (rejected.type === 'item_save') {
                  markItemDirty(rejected.id);
                  if (rejected.wasNewCollaborative) newCollaborativeItemsRef.current.add(rejected.id);
                } else {
                  const next = { ...itemsRef.current };
                  if (rejected.previous == null) delete next[rejected.id];
                  else next[rejected.id] = rejected.previous;
                  itemsRef.current = next;
                  setItems(next);
                  refreshSpatialIndex();
                }
              }
            }
            setToast(data.code === 'ITEM_ACCESS_DENIED' ? '이 아이템을 수정할 권한이 없습니다.' : data.code === 'ITEM_SAVE_REQUIRED' ? 'Ctrl + S로 저장한 뒤 서버에 반영할 수 있습니다.' : data.message || data.code || '서버 오류가 발생했습니다.');
          }
        };
        socket.onerror = () => { if (!cancelled) setError('실시간 서버에 연결할 수 없습니다. 서버 주소와 WebSocket 설정을 확인해주세요.'); };
        socket.onclose = (event) => {
          if (wsRef.current === socket) wsRef.current = null;
          chatHistoryRequestRef.current = null;
          setChatHistoryLoading(false);
          for (const pending of pendingItemChangesRef.current.splice(0)) {
            if (pending.type === 'item_save') {
              markItemDirty(pending.id);
              if (pending.wasNewCollaborative) newCollaborativeItemsRef.current.add(pending.id);
            }
          }
          rejectedEventPongsRef.current = 0;
          if (rtcSocket && rtcSocket.readyState !== WebSocket.CLOSED) rtcSocket.close();
          if (rtcWsRef.current === rtcSocket) rtcWsRef.current = null;
          rtcReady = false;
          canvasConnectionId = '';
          canvasConnectionHash = '';
          joinedCanvasConnectionId = '';
          resetPeerMesh();
          setItemsInitialized(false);
          if (!cancelled) { setConnection('disconnected'); if (event.code === 1008) setError('캔버스 권한이나 설정이 변경되었습니다. 다시 접속해주세요.'); }
        };
      } catch (err) {
        if (!cancelled) { setConnection('disconnected'); setError(err.message || '캔버스에 접속할 수 없습니다.'); }
      }
    }
    connect();
    return () => {
      cancelled = true;
      rtcReady = false;
      canvasConnectionId = '';
      canvasConnectionHash = '';
      joinedCanvasConnectionId = '';
      resetPeerMesh();
      if (rtcSocket && rtcSocket.readyState !== WebSocket.CLOSED) rtcSocket.close();
      if (rtcWsRef.current === rtcSocket) rtcWsRef.current = null;
      if (socket) socket.close();
      if (wsRef.current === socket) wsRef.current = null;
    };
  }, [canvasId, getCollaborativeDoc, markItemDirty, navigate, receivePeerData, refreshSpatialIndex, requestChatHistory, sendRaw, sendRtcRaw, token, user]);

  const spatialIndex = useMemo(() => new CanvasSpatialBTree(items), [spatialRevision]);
  const visibleBounds = useMemo(() => ({
    minX: -camera.x / (Math.max(1, boardSize.width) * camera.scale),
    minY: -camera.y / (Math.max(1, boardSize.height) * camera.scale),
    maxX: (boardSize.width - camera.x) / (Math.max(1, boardSize.width) * camera.scale),
    maxY: (boardSize.height - camera.y) / (Math.max(1, boardSize.height) * camera.scale),
  }), [boardSize, camera]);
  const axisOriginX = boardSize.width * camera.scale / 2 + camera.x;
  const axisOriginY = boardSize.height * camera.scale / 2 + camera.y;
  const coordinatePlaneStyle = {
    '--axis-origin-x': `${axisOriginX}px`,
    '--axis-origin-y': `${axisOriginY}px`,
    '--axis-x-arrow-opacity': axisOriginX <= boardSize.width ? 1 : 0,
    '--axis-y-arrow-opacity': axisOriginY >= 0 ? 1 : 0,
  };
  const visibleEntries = useMemo(() => spatialIndex.query(visibleBounds)
    .map((entry) => ({ ...entry, item: items[entry.id] || entry.item })), [items, spatialIndex, visibleBounds]);
  const visibleItemKey = visibleEntries.map((entry) => entry.id).join('\u0000');
  const visibleItemIds = useMemo(() => new Set(visibleEntries.map((entry) => entry.id)), [visibleItemKey]);
  const visibleVectorItems = useMemo(() => Object.fromEntries(visibleEntries
    .filter(({ item }) => ['stroke', 'shape', 'connector'].includes(item?.kind))
    .map(({ id, item }) => [id, item])), [visibleEntries]);
  const sortedItems = useMemo(() => visibleEntries
    .filter(({ item }) => ['image', 'code', 'note', 'shape', 'text', 'math'].includes(item?.kind))
    .sort((a, b) => a.bounds.minY - b.bounds.minY)
    .map(({ id, item }) => [id, item]), [visibleEntries]);
  const permission = groups.includes('default') ? 'default' : groups[0] || 'admin-group';
  const startEditing = (id) => { setSelectedItemId(String(id)); setEditingId(id); };
  const stopEditing = (id) => setEditingId((current) => current === id ? null : current);
  const sendSettings = (field, value, participant) => {
    if (!settings || settingsPending) return;
    const payload = { type: 'canvas_settings_update', request_id: createId(), expected_revision: settings.settings_revision ?? 0, field };
    if (participant) Object.assign(payload, participant); else payload.value = value;
    if (sendRaw(payload)) setSettingsPending(true);
  };
  const pointerPosition = (event) => {
    const bounds = boardRef.current.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left - camera.x) / (bounds.width * camera.scale),
      y: (event.clientY - bounds.top - camera.y) / (bounds.height * camera.scale),
    };
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
  const hideCursor = () => peerMeshRef.current?.sendCursor({ type: 'cursor', visible: false });
  const startPan = (event) => {
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
  const handleStageWheel = (event) => {
    if (event.target.closest?.('.canvas-object')) return;
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      zoomBy(Math.exp(-event.deltaY * 0.0015 * zoomSensitivity), event.clientX, event.clientY);
    } else {
      setCamera((current) => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
    }
  };
  const startDrawing = (event) => {
    if (event.button === 1 || spacePressedRef.current || (activeTool === 'select' && !event.target.closest?.('.canvas-object'))) { startPan(event); return; }
    if (connection !== 'connected' || event.target.closest?.('.canvas-object')) return;
    if (activeTool === 'shape' || activeTool === 'text' || activeTool === 'math' || activeTool === 'code') {
      event.preventDefault();
      const point = pointerPosition(event);
      const itemWidth = activeTool === 'shape' ? 0.14 : activeTool === 'math' ? 0.2 : activeTool === 'code' ? 0.32 : 0.22;
      const x = point.x - itemWidth / 2;
      const y = point.y - (activeTool === 'code' ? 0.1 : 0.06);
      let item;
      if (activeTool === 'shape') item = { kind: 'shape', shapeType, x, y, width: itemWidth, height: 0.12, color, permission };
      else if (activeTool === 'text') item = { kind: 'text', text: '', x, y, width: itemWidth, permission };
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
        if (activeTool === 'text' || activeTool === 'code') startEditing(id);
      }
      return;
    }
    if (activeTool === 'connect') { setToast('연결할 오브젝트 두 개를 차례로 선택하세요.'); return; }
    if (activeTool !== 'pen') return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true; draftRef.current = [pointerPosition(event)];
  };
  const moveDrawing = (event) => {
    sendCursorPosition(event);
    if (panRef.current) {
      const pan = panRef.current;
      setCamera((current) => ({ ...current, x: pan.cameraX + event.clientX - pan.x, y: pan.cameraY + event.clientY - pan.y }));
      return;
    }
    if (!drawingRef.current) return;
    const point = pointerPosition(event);
    const previous = draftRef.current[draftRef.current.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.0018) return;
    draftRef.current.push(point);
    vectorDraftRef.current?.({ points: draftRef.current, color, strokeWidth: 4 });
  };
  const stopDrawing = (event) => {
    if (panRef.current) {
      panRef.current = null;
      boardRef.current?.classList.remove('panning');
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (!drawingRef.current) return;
    drawingRef.current = false; event.currentTarget.releasePointerCapture?.(event.pointerId);
    const points = draftRef.current; draftRef.current = [];
    vectorDraftRef.current?.(null);
    if (!points.length) return;
    const id = createId();
    if (!addItem(id, { kind: 'stroke', points, color, strokeWidth: 4, permission })) setToast('실시간 서버에 연결된 뒤 그릴 수 있어요.');
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
  const startObjectDrag = (event, id, item) => {
    if (event.button === 1 || spacePressedRef.current) { startPan(event); return; }
    if (activeTool === 'connect') {
      event.preventDefault(); event.stopPropagation();
      if (!connectionStartId) { setConnectionStartId(id); setToast('도착 오브젝트를 선택해 연결을 완성하세요.'); return; }
      if (connectionStartId === id) { setConnectionStartId(null); return; }
      const from = itemsRef.current[connectionStartId];
      const to = itemsRef.current[id];
      if (from && to) addItem(createId(), { kind: 'connector', from: connectionStartId, to: id, color, permission });
      setConnectionStartId(null); setActiveTool('select'); return;
    }
    setSelectedItemId(String(id));
    if (activeTool !== 'select' || event.target.closest('button')) { event.stopPropagation(); return; }
    event.preventDefault(); event.stopPropagation();
    const start = pointerPosition(event);
    dragRef.current = { id, initial: item, offsetX: start.x - (item.x || 0), offsetY: start.y - (item.y || 0) };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveObject = (event) => {
    if (!dragRef.current) return;
    const { id, initial, offsetX, offsetY } = dragRef.current; const point = pointerPosition(event);
    const next = { ...initial, x: point.x - offsetX, y: point.y - offsetY };
    itemsRef.current = { ...itemsRef.current, [id]: next };
    setItems((current) => ({ ...current, [id]: next }));
  };
  const stopObjectDrag = () => {
    if (!dragRef.current) return;
    const { id, initial } = dragRef.current; dragRef.current = null;
    const item = itemsRef.current[id];
    refreshSpatialIndex();
    if (isCollaborativeItem(item)) {
      peerMeshRef.current?.sendData({ type: 'item_geometry', item_id: String(id), x: item.x, y: item.y }, (peer) => canPeerAccessItem(item, peer));
      markItemDirty(id);
    } else if (item && !sendItemChange({ type: 'item_update', item_id: id, item }, initial)) {
      setItems((current) => ({ ...current, [id]: initial }));
    }
  };
  const changeTheme = (nextTheme) => { localStorage.setItem('agora_canvas_theme', nextTheme); setTheme(nextTheme); };
  const toggleGrid = () => { const next = !showGrid; localStorage.setItem('agora_canvas_grid', String(next)); setShowGrid(next); };
  const changeZoomSensitivity = (event) => {
    const next = Number(event.target.value);
    setZoomSensitivity(next);
    localStorage.setItem(ZOOM_SENSITIVITY_KEY, String(next));
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
    const onKeyDown = (event) => {
      if (event.code === 'Space' && !isEditableTarget(event.target)) {
        spacePressedRef.current = true;
        event.preventDefault();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        const targetId = editingId || selectedItemId;
        if (targetId && isCollaborativeItem(itemsRef.current[targetId]) && dirtyItemsRef.current.has(String(targetId))) {
          event.preventDefault();
          saveCollaborativeItem(targetId);
        }
      }
    };
    const onKeyUp = (event) => { if (event.code === 'Space') spacePressedRef.current = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [editingId, saveCollaborativeItem, selectedItemId]);
  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    const image = canvas?.image;
    setImageFailed(false);
    setCanvasImageSrc('');
    if (!image) return undefined;

    if (image.startsWith('data:') || image.startsWith('blob:')) {
      setCanvasImageSrc(image);
      return undefined;
    }

    let imageUrl;
    try {
      imageUrl = new URL(apiUrl(image), window.location.href);
    } catch {
      setImageFailed(true);
      return undefined;
    }
    const apiOrigin = new URL(apiUrl('/'), window.location.href).origin;
    if (imageUrl.origin !== apiOrigin) {
      setCanvasImageSrc(imageUrl.href);
      return undefined;
    }

    fetch(imageUrl.href, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((response) => {
        if (!response.ok) throw new Error(`대표 이미지 요청 실패 (${response.status})`);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setCanvasImageSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setImageFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [canvas?.image, token]);

  return <div className="canvas-app-page" data-theme={theme}>
    <header className="canvas-topbar">
      <div className="canvas-title-group"><Link to="/search" className="canvas-back" aria-label="캔버스 목록"><Icon name="back" size={19} /></Link><div className="canvas-cover-image">{canvas?.image && !imageFailed && canvasImageSrc ? <img src={canvasImageSrc} alt="캔버스 대표 이미지" onError={() => setImageFailed(true)} /> : <div className="canvas-cover-art"><i /><i /><i /><span>AG</span></div>}</div><div className="canvas-title-copy"><span>AGORA CANVAS · #{canvasId}</span><h1>{canvas?.canvas_name || `캔버스 ${canvasId}`}</h1></div></div>
      <div className="canvas-header-right"><div className="canvas-description-card"><span>캔버스 설명</span><p>{canvas?.description || '함께 아이디어를 모으고 실시간으로 만들어가는 공간입니다.'}</p></div><div className="canvas-top-right"><span className={`connection-pill ${connection}`}><i />{connection === 'connected' ? '실시간 연결됨' : connection === 'connecting' ? '연결 중' : '연결 끊김'}</span><div className="collaborator-avatars"><span>{(user?.nickname || 'A').slice(0, 1)}</span>{settings?.participants?.slice(0, 2).map((person) => <span key={`${person.nickname}-${person.tag_number}`}>{person.nickname.slice(0, 1)}</span>)}</div><button className="button button-outline canvas-settings-button" onClick={() => setShowSettings(true)}><Icon name="settings" size={17} /><span>설정</span></button></div></div>
    </header>
    {error ? <div className="canvas-error-state"><div className="error-art"><Icon name="grid" size={30} /></div><span className="section-kicker">CANVAS CONNECTION</span><h1>캔버스를 열 수 없어요.</h1><p>{error}</p><div><button className="button button-dark" onClick={() => window.location.reload()}>다시 연결하기</button><Link className="button button-outline" to="/search">캔버스 목록</Link></div></div> : <div className="canvas-workspace">
      <aside className="canvas-tools" aria-label="캔버스 도구">
        <div className="tool-group"><button className={`tool-button${activeTool === 'select' ? ' active' : ''}`} title="선택 및 이동" aria-label="선택 및 이동" onClick={() => setActiveTool('select')}><Icon name="select" size={19} /></button><button className={`tool-button${activeTool === 'pen' ? ' active' : ''}`} title="드로잉" aria-label="드로잉" onClick={() => setActiveTool('pen')}><Icon name="pen" size={19} /></button><button className={`tool-button${activeTool === 'connect' ? ' active' : ''}`} title="오브젝트 연결" aria-label="오브젝트 연결" onClick={() => { setConnectionStartId(null); setActiveTool('connect'); }}><Icon name="connect" size={19} /></button></div>
        <div className="tool-separator" /><div className="tool-group"><button className={`tool-button${activeTool === 'shape' ? ' active' : ''}`} title="도형" aria-label="도형" onClick={() => setActiveTool('shape')}><Icon name="shape" size={19} /></button><button className={`tool-button${activeTool === 'text' ? ' active' : ''}`} title="텍스트" aria-label="텍스트" onClick={() => setActiveTool('text')}><Icon name="text" size={19} /></button><button className={`tool-button${activeTool === 'math' ? ' active' : ''}`} title="수식 작성" aria-label="수식 작성" onClick={() => setActiveTool('math')}><Icon name="math" size={19} /></button></div>
        <div className="tool-separator" /><div className="tool-group"><label className="tool-button file-tool" title="사진 올리기" aria-label="사진 올리기"><Icon name="image" size={19} /><input type="file" accept="image/*" onChange={uploadImage} /></label><button className={`tool-button${activeTool === 'code' ? ' active' : ''}`} title="코드 블록" aria-label="코드 블록" onClick={() => setActiveTool('code')}><Icon name="code" size={19} /></button></div>
        <div className="tool-separator" /><div className="color-picker" aria-label="펜 및 도형 색상">{inkColors.map((ink) => <button key={ink} style={{ '--ink': ink }} className={color === ink ? 'selected' : ''} onClick={() => setColor(ink)} aria-label={`색상 ${ink}`} />)}</div><div className="tool-bottom"><span className="tool-help">CANVAS</span><span>도구</span></div>
      </aside>
      <main className="board-region"><div className="board-topline"><span className="board-section-label"><i /> 2차 좌표 캔버스</span><div className="board-toolbar-actions"><span className="board-updated"><Icon name="clock" size={14} /> P2P {peerList.filter((peer) => peer.connected).length}명 · 저장 Ctrl+S</span><button className="zoom-button" aria-label="확대" onClick={() => zoomBy(1 + 0.15 * zoomSensitivity)}>+</button><span className="zoom-value">{Math.round(camera.scale * 100)}%</span><button className="zoom-button" aria-label="축소" onClick={() => zoomBy(1 / (1 + 0.15 * zoomSensitivity))}>−</button><button className="zoom-button zoom-reset" onClick={() => setCamera({ x: 0, y: 0, scale: 1 })}>맞춤</button><button className={`board-toggle${showGrid ? ' active' : ''}`} onClick={toggleGrid} aria-pressed={showGrid}><Icon name="grid" size={15} />격자 {showGrid ? '켜짐' : '꺼짐'}</button></div></div>
        <div className={`canvas-stage ${activeTool === 'pen' ? 'drawing-mode' : ''}${showGrid ? '' : ' no-grid'}`} style={{ '--grid-size': `${20 * camera.scale}px`, '--grid-dot-radius': `${camera.scale}px`, '--grid-position-x': `${camera.x}px`, '--grid-position-y': `${camera.y}px` }} ref={boardRef} onPointerDown={startDrawing} onPointerMove={moveDrawing} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} onPointerLeave={hideCursor} onWheel={handleStageWheel}>
          <div className="stage-label"><span>AGORA / {String(canvasId).padStart(2, '0')}</span><b>{canvas?.canvas_name || '공유 캔버스'}</b></div>
          <div className="coordinate-plane" style={coordinatePlaneStyle} aria-hidden="true"><span className="coordinate-x" /><span className="coordinate-y" /><i className="coordinate-origin">0</i><b className="coordinate-x-label">X</b><b className="coordinate-y-label">Y</b></div>
          <div className="canvas-scene" style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})` }}>
            <VectorLayer items={visibleVectorItems} referenceItems={items} onReady={(setDraft) => { vectorDraftRef.current = setDraft; }} />
            {sortedItems.map(([id, item]) => <CanvasObject key={id} id={id} item={item} activeTool={activeTool} connectionStartId={connectionStartId} editing={editingId === id} dirty={dirtyItems.has(String(id))} onStartEditing={startEditing} onTextChange={updateCollaborativeText} onMetadataChange={updateCollaborativeMetadata} onStopEditing={stopEditing} onSave={saveCollaborativeItem} onPointerDown={startObjectDrag} onPointerMove={moveObject} onPointerUp={stopObjectDrag} onDelete={deleteItem} onCopy={(value) => navigator.clipboard?.writeText(value)} />)}
            {Object.entries(remoteCursors).filter(([, cursor]) => cursor.visible !== false && cursor.x >= visibleBounds.minX && cursor.x <= visibleBounds.maxX && cursor.y >= visibleBounds.minY && cursor.y <= visibleBounds.maxY).map(([peerId, cursor]) => <div className="remote-cursor" key={peerId} style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%`, '--cursor-color': cursor.color }} title={`${cursor.nickname}#${cursor.tag_number}`}><svg viewBox="0 0 18 22" aria-hidden="true"><path d="M1 1v17l4.5-4.3 3.1 7.1 3.1-1.4-3.2-6.8H15z" /></svg><span>{cursor.nickname}</span></div>)}
          </div>
          {activeTool === 'pen' && <div className="draw-cursor-label"><Icon name="pen" size={13} /> 그리는 중</div>}{activeTool === 'connect' && <div className="draw-cursor-label"><Icon name="connect" size={13} /> {connectionStartId ? '도착 오브젝트 선택' : '시작 오브젝트 선택'}</div>}
        </div><div className="board-footer"><span>무한 좌표 평면 · X/Y축</span><span className="board-footer-center">드래그 이동 · 휠 이동 · Ctrl/⌘ + 휠 확대</span><span>{visibleItemIds.size}/{Object.keys(items).length}개 표시</span></div>
      </main>
      <aside className="canvas-sidepanel canvas-inspector"><div className="inspector-heading"><div><span className="section-kicker">WORKSPACE</span><h2>환경 설정</h2></div><button className="icon-button" onClick={() => setShowSettings(true)} aria-label="캔버스 세부 설정"><Icon name="settings" size={18} /></button></div>
        <section className="inspector-section"><div className="inspector-label">화면 모드</div><div className="theme-switch" role="group" aria-label="테마 선택"><button className={theme === 'light' ? 'active' : ''} aria-pressed={theme === 'light'} onClick={() => changeTheme('light')}><Icon name="sun" size={16} />라이트</button><button className={theme === 'dark' ? 'active' : ''} aria-pressed={theme === 'dark'} onClick={() => changeTheme('dark')}><Icon name="moon" size={16} />다크</button></div></section>
        <section className="inspector-section"><div className="inspector-switch-row"><span><strong>좌표 격자</strong><small>2차 평면 가이드라인</small></span><button className={`toggle-switch${showGrid ? ' on' : ''}`} role="switch" aria-checked={showGrid} onClick={toggleGrid}><i /></button></div><div className="axis-preview"><span>X축</span><i /><span>Y축</span><i className="axis-preview-origin" /></div></section>
        <section className="inspector-section zoom-sensitivity-section"><div className="zoom-sensitivity-heading"><strong>줌 감도</strong><span>{Math.round(zoomSensitivity * 100)}%</span></div><input type="range" min={MIN_ZOOM_SENSITIVITY} max={MAX_ZOOM_SENSITIVITY} step="0.1" value={zoomSensitivity} onChange={changeZoomSensitivity} aria-label="줌 감도" /><small>휠과 확대·축소 버튼 반응 속도</small></section>
        {activeTool === 'shape' && <section className="inspector-section"><label className="inspector-label" htmlFor="shape-kind">도형 종류</label><select id="shape-kind" className="shape-select" value={shapeType} onChange={(event) => setShapeType(event.target.value)}><option value="rectangle">사각형</option><option value="ellipse">타원</option><option value="arrow">화살표</option></select><small className="inspector-hint">캔버스를 클릭해 도형을 놓으세요.</small></section>}
        {(activeTool === 'text' || activeTool === 'code') && <section className="inspector-section"><strong className="inspector-label">{activeTool === 'text' ? '텍스트 작성' : '코드 작성'}</strong><small className="inspector-hint">캔버스를 클릭하면 편집 가능한 아이템이 놓입니다.</small></section>}
        <section className="inspector-section inspector-stats"><div><span>캔버스 ID</span><strong>#{canvasId}</strong></div><div><span>오브젝트</span><strong>{Object.keys(items).length}</strong></div><div><span>설정 revision</span><strong>{settings?.settings_revision ?? '—'}</strong></div></section>
        <section className="inspector-members"><div className="member-panel-title"><strong>참여자</strong><span>{settings?.participants?.length || 0}명</span></div>{(settings?.participants || []).slice(0, 5).map((person, index) => <div className="member-row" key={`${person.nickname}-${person.tag_number}`}><span className={`avatar member-avatar avatar-tone-${index % 4}`}>{person.nickname.slice(0, 1)}</span><span><strong>{person.nickname} <small>#{person.tag_number}</small></strong><small>{index === 0 ? '캔버스 멤버' : '참여자'}</small></span></div>)}<button className="manage-members-button" onClick={() => setShowSettings(true)}>참여자 관리 <Icon name="arrow" size={14} /></button></section>
        <div className="sidepanel-bottom"><span className="online-indicator"><i /> {connection === 'connected' ? '동기화됨' : '연결 확인 중'}</span></div>
      </aside>
      <section className="canvas-chat-panel" aria-label="캔버스 채팅"><div className="chat-dock-heading"><span className="conversation-icon"><Icon name="chat" size={16} /></span><div><strong>캔버스 채팅</strong><small>아이디어를 바로 나눠보세요</small></div><span className="chat-message-count">{messages.length}개 표시</span>{hasOlderMessages && <button type="button" className="chat-load-more" style={{ padding: '5px 7px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--panel-soft)', color: 'var(--ink-muted)', fontSize: 7, whiteSpace: 'nowrap' }} onClick={loadOlderMessages} disabled={chatHistoryLoading}>{chatHistoryLoading ? '불러오는 중' : '이전 메시지'}</button>}</div><div className="message-list">{messages.length ? messages.map((entry) => <div className={`chat-entry${entry.own ? ' own' : ''}`} key={entry.id}><div className="chat-entry-avatar">{entry.sender.slice(0, 1)}</div><div className="chat-entry-content"><div><strong>{entry.sender}</strong><time>{entry.time.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{entry.text}</p></div></div>) : <div className="chat-empty"><span>✳</span><strong>첫 대화를 시작해보세요.</strong><small>캔버스에 대한 생각을 멤버들과 나눠요.</small></div>}</div><form className="chat-compose" onSubmit={submitMessage}><textarea rows="2" placeholder="메시지를 남겨보세요..." value={message} onChange={(event) => setMessage(event.target.value)} disabled={connection !== 'connected'} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} /><div><span>Enter 전송 · Shift + Enter 줄바꿈</span><button type="submit" disabled={!message.trim() || connection !== 'connected'} aria-label="메시지 전송"><Icon name="send" size={16} /></button></div></form></section>
    </div>}
    {toast && <div className="toast-message" role="status"><Icon name="check" size={16} />{toast}</div>}
    {showSettings && <SettingsDialog settings={settings} pending={settingsPending} onClose={() => setShowSettings(false)} onUpdate={sendSettings} onAddParticipant={(nickname, tag) => sendSettings('participant_add', null, { nickname, tag_number: tag })} onRemoveParticipant={(person) => sendSettings('participant_remove', null, { nickname: person.nickname, tag_number: person.tag_number })} />}
  </div>;
}

export default function CanvasPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    automergeReady.then(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  if (!ready) return <div className="canvas-app-page canvas-loading-state"><span className="loader" /> 공동 편집 엔진을 불러오는 중이에요.</div>;
  return <CanvasWorkspace />;
}
