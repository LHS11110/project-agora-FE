import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from '../routing.jsx';
import Icon from '../components/Icon.jsx';
import { api, canvasSocketUrl } from '../api/client.js';
import { useAuth } from '../state/AuthContext.jsx';

const inkColors = ['#263b35', '#d9785e', '#617db2', '#d8a443', '#7e6b9d'];
const createId = () => globalThis.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function CodeDialog({ onClose, onShare }) {
  const [code, setCode] = useState('');
  const [filename, setFilename] = useState('idea.js');
  const [language, setLanguage] = useState('javascript');
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-card code-dialog" role="dialog" aria-modal="true" aria-labelledby="code-dialog-title"><button className="icon-button modal-close" onClick={onClose} aria-label="닫기"><Icon name="close" /></button><span className="section-kicker">SHARE A CODE IDEA</span><h2 id="code-dialog-title">코드를 캔버스에 놓아요.</h2><p>작은 실험이나 예시를 팀과 함께 살펴보세요.</p><form className="modal-form" onSubmit={(event) => { event.preventDefault(); onShare({ code, filename, language }); }}><div className="code-fields"><label className="form-field"><span>파일 이름</span><input className="plain-input" value={filename} onChange={(e) => setFilename(e.target.value)} maxLength={80} required /></label><label className="form-field"><span>언어</span><select className="plain-input" value={language} onChange={(e) => setLanguage(e.target.value)}><option>javascript</option><option>typescript</option><option>python</option><option>html</option><option>css</option><option>json</option><option>text</option></select></label></div><label className="form-field"><span>코드</span><textarea className="code-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder={'const idea = "together";\nmakeSomethingGood(idea);'} rows="9" required /></label><button className="button button-dark button-submit">캔버스에 공유하기 <Icon name="arrow" size={17} /></button></form></section></div>;
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

function DrawnStrokes({ items }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return undefined;
    const paint = () => {
      const bounds = parent.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(bounds.width * ratio));
      canvas.height = Math.max(1, Math.round(bounds.height * ratio));
      canvas.style.width = `${bounds.width}px`; canvas.style.height = `${bounds.height}px`;
      const context = canvas.getContext('2d');
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineCap = 'round'; context.lineJoin = 'round'; context.clearRect(0, 0, bounds.width, bounds.height);
      for (const item of Object.values(items)) {
        if (item?.kind !== 'stroke' || !Array.isArray(item.points) || !item.points.length) continue;
        context.beginPath(); context.strokeStyle = item.color || '#263b35'; context.lineWidth = item.strokeWidth || 4;
        context.moveTo(item.points[0].x * bounds.width, item.points[0].y * bounds.height);
        for (const point of item.points.slice(1)) context.lineTo(point.x * bounds.width, point.y * bounds.height);
        if (item.points.length === 1) { context.lineTo(item.points[0].x * bounds.width + 0.1, item.points[0].y * bounds.height + 0.1); }
        context.stroke();
      }
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [items]);
  return <canvas className="draw-layer" ref={canvasRef} aria-label="공유 드로잉 캔버스" />;
}

export default function CanvasPage() {
  const { canvasId } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const boardRef = useRef(null);
  const wsRef = useRef(null);
  const itemsRef = useRef({});
  const pendingItemChangesRef = useRef([]);
  const dragRef = useRef(null);
  const drawingRef = useRef(false);
  const draftRef = useRef([]);
  const [canvas, setCanvas] = useState(null);
  const [items, setItems] = useState({});
  const [groups, setGroups] = useState([]);
  const [settings, setSettings] = useState(null);
  const [connection, setConnection] = useState('connecting');
  const [error, setError] = useState('');
  const [activeTool, setActiveTool] = useState('select');
  const [color, setColor] = useState(inkColors[0]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPending, setSettingsPending] = useState(false);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState('chat');

  useEffect(() => { itemsRef.current = items; }, [items]);
  const sendRaw = useCallback((payload) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload)); return true;
  }, []);
  const sendItemChange = useCallback((payload, previous) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    pendingItemChangesRef.current.push({ id: String(payload.item_id), previous });
    socket.send(JSON.stringify(payload));
    socket.send(JSON.stringify({ type: 'ping' }));
    return true;
  }, []);
  const addItem = useCallback((id, item) => {
    if (!sendItemChange({ type: 'item_update', item_id: id, item }, null)) return false;
    setItems((current) => ({ ...current, [id]: item }));
    return true;
  }, [sendItemChange]);
  const deleteItem = useCallback((id) => {
    const previous = itemsRef.current[id];
    if (!sendItemChange({ type: 'item_delete', item_id: id }, previous)) return false;
    setItems((current) => { const next = { ...current }; delete next[id]; return next; });
    return true;
  }, [sendItemChange]);

  useEffect(() => {
    let cancelled = false;
    let socket;
    async function connect() {
      setConnection('connecting'); setError('');
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
        socket.onopen = () => { if (!cancelled) setConnection('connected'); };
        socket.onmessage = (event) => {
          let data;
          try { data = JSON.parse(event.data); } catch { return; }
          if (data.type === 'init_items') {
            setItems(data.items && typeof data.items === 'object' ? data.items : {});
            setGroups(Array.isArray(data.groups) ? data.groups : []);
            setCanvas((current) => ({ ...current, canvas_name: data.canvas_name || current?.canvas_name }));
            sendRaw({ type: 'canvas_settings_get' });
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
          if (data.type === 'item_update' || data.type === 'item_add' || data.type === 'update_item') {
            const id = data.item_id ?? data['item-id'];
            const item = data.item || data.data;
            if (id != null && item && typeof item === 'object') setItems((current) => ({ ...current, [id]: item }));
            return;
          }
          if (data.type === 'item_delete' || data.type === 'delete_item') {
            const id = data.item_id ?? data['item-id'];
            if (id != null) setItems((current) => { const next = { ...current }; delete next[id]; return next; });
            return;
          }
          if (data.type === 'chat') {
            setMessages((current) => [...current, { id: createId(), sender: data.sender ? `${data.sender}#${data.tag_number ?? '?'}` : '알 수 없는 사용자', text: data.text || '', time: new Date() }]);
            return;
          }
          if (data.type === 'pong') {
            pendingItemChangesRef.current.shift();
            return;
          }
          if (data.type === 'error') {
            if (data.code === 'ITEM_ACCESS_DENIED') {
              const rejected = pendingItemChangesRef.current.shift();
              if (rejected) setItems((current) => {
                const next = { ...current };
                if (rejected.previous == null) delete next[rejected.id];
                else next[rejected.id] = rejected.previous;
                return next;
              });
            }
            setToast(data.code === 'ITEM_ACCESS_DENIED' ? '이 아이템을 수정할 권한이 없습니다.' : data.message || data.code || '서버 오류가 발생했습니다.');
          }
        };
        socket.onerror = () => { if (!cancelled) setError('실시간 서버에 연결할 수 없습니다. 서버 주소와 WebSocket 설정을 확인해주세요.'); };
        socket.onclose = (event) => {
          if (wsRef.current === socket) wsRef.current = null;
          if (!cancelled) { setConnection('disconnected'); if (event.code === 1008) setError('캔버스 권한이나 설정이 변경되었습니다. 다시 접속해주세요.'); }
        };
      } catch (err) {
        if (!cancelled) { setConnection('disconnected'); setError(err.message || '캔버스에 접속할 수 없습니다.'); }
      }
    }
    connect();
    return () => { cancelled = true; if (socket) socket.close(); if (wsRef.current === socket) wsRef.current = null; };
  }, [canvasId, navigate, sendRaw, token]);

  const sortedItems = useMemo(() => Object.entries(items).filter(([, item]) => item?.kind === 'image' || item?.kind === 'code' || item?.kind === 'note'), [items]);
  const permission = groups.includes('default') ? 'default' : groups[0] || 'admin-group';
  const sendSettings = (field, value, participant) => {
    if (!settings || settingsPending) return;
    const payload = { type: 'canvas_settings_update', request_id: createId(), expected_revision: settings.settings_revision ?? 0, field };
    if (participant) Object.assign(payload, participant); else payload.value = value;
    if (sendRaw(payload)) setSettingsPending(true);
  };
  const pointerPosition = (event) => {
    const bounds = boardRef.current.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) };
  };
  const startDrawing = (event) => {
    if (activeTool !== 'pen' || connection !== 'connected') return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true; draftRef.current = [pointerPosition(event)];
  };
  const moveDrawing = (event) => {
    if (!drawingRef.current) return;
    draftRef.current.push(pointerPosition(event));
    const stage = boardRef.current;
    const canvasElement = stage?.querySelector('canvas');
    const ctx = canvasElement?.getContext('2d');
    if (!stage || !ctx) return;
    const bounds = stage.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const points = draftRef.current;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (points.length > 1) { const previous = points[points.length - 2]; const current = points[points.length - 1]; ctx.moveTo(previous.x * bounds.width, previous.y * bounds.height); ctx.lineTo(current.x * bounds.width, current.y * bounds.height); ctx.stroke(); }
  };
  const stopDrawing = (event) => {
    if (!drawingRef.current) return;
    drawingRef.current = false; event.currentTarget.releasePointerCapture?.(event.pointerId);
    const points = draftRef.current; draftRef.current = [];
    if (!points.length) return;
    const id = createId();
    if (!addItem(id, { kind: 'stroke', points, color, strokeWidth: 4, permission })) setToast('실시간 서버에 연결된 뒤 그릴 수 있어요.');
  };
  const shareCode = ({ code, filename, language }) => {
    const id = createId();
    if (!addItem(id, { kind: 'code', code, filename, language, x: 0.53, y: 0.16, width: 0.32, permission })) { setToast('실시간 서버에 연결된 뒤 코드를 공유할 수 있어요.'); return; }
    setShowCode(false); setActiveTool('select');
  };
  const uploadImage = async (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setToast('이미지 파일만 올릴 수 있어요.'); return; }
    if (file.size > 2 * 1024 * 1024) { setToast('이미지는 2MB 이하로 올려주세요.'); return; }
    try {
      const src = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      const id = createId();
      if (!addItem(id, { kind: 'image', src, filename: file.name, x: 0.16, y: 0.22, width: 0.3, permission })) { setToast('실시간 서버에 연결된 뒤 이미지를 공유할 수 있어요.'); return; }
      setActiveTool('select');
    } catch { setToast('이미지를 읽지 못했습니다.'); }
  };
  const submitMessage = (event) => {
    event.preventDefault(); const text = message.trim();
    if (!text || !sendRaw({ type: 'chat', text })) return;
    setMessages((current) => [...current, { id: createId(), sender: `${user?.nickname || '나'}#${user?.tag_number ?? '?'}`, text, time: new Date(), own: true }]); setMessage('');
  };
  const startObjectDrag = (event, id, item) => {
    if (activeTool !== 'select' || event.target.closest('button')) return;
    event.preventDefault(); event.stopPropagation();
    const start = pointerPosition(event);
    dragRef.current = { id, initial: item, offsetX: start.x - (item.x || 0), offsetY: start.y - (item.y || 0) };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveObject = (event) => {
    if (!dragRef.current) return;
    const { id, initial, offsetX, offsetY } = dragRef.current; const point = pointerPosition(event);
    const next = { ...initial, x: Math.max(0, Math.min(0.88, point.x - offsetX)), y: Math.max(0, Math.min(0.82, point.y - offsetY)) };
    setItems((current) => ({ ...current, [id]: next }));
  };
  const stopObjectDrag = () => {
    if (!dragRef.current) return;
    const { id, initial } = dragRef.current; dragRef.current = null;
    const item = itemsRef.current[id];
    if (item && !sendItemChange({ type: 'item_update', item_id: id, item }, initial)) {
      setItems((current) => ({ ...current, [id]: initial }));
    }
  };

  return <div className="canvas-app-page">
    <header className="canvas-topbar"><div className="canvas-top-left"><Link to="/search" className="canvas-back" aria-label="캔버스 목록"><Icon name="back" size={19} /></Link><span className="top-divider" /><div className="canvas-breadcrumb"><span>워크스페이스</span><Icon name="chevron" size={14} /><strong>{canvas?.canvas_name || `캔버스 ${canvasId}`}</strong><small>#{canvasId}</small></div></div><div className="canvas-top-right"><span className={`connection-pill ${connection}`}><i />{connection === 'connected' ? '실시간 연결됨' : connection === 'connecting' ? '연결 중' : '연결 끊김'}</span><div className="collaborator-avatars"><span>{(user?.nickname || 'A').slice(0, 1)}</span>{settings?.participants?.slice(0, 2).map((person) => <span key={`${person.nickname}-${person.tag_number}`}>{person.nickname.slice(0, 1)}</span>)}</div><button className="button button-outline canvas-settings-button" onClick={() => setShowSettings(true)}><Icon name="settings" size={17} /><span>설정</span></button></div></header>
    {error ? <div className="canvas-error-state"><div className="error-art"><Icon name="grid" size={30} /></div><span className="section-kicker">CANVAS CONNECTION</span><h1>캔버스를 열 수 없어요.</h1><p>{error}</p><div><button className="button button-dark" onClick={() => window.location.reload()}>다시 연결하기</button><Link className="button button-outline" to="/search">캔버스 목록</Link></div></div> : <div className="canvas-workspace">
      <aside className="canvas-tools"><div className="tool-group"><button className={`tool-button${activeTool === 'select' ? ' active' : ''}`} title="선택 및 이동" aria-label="선택 및 이동" onClick={() => setActiveTool('select')}><Icon name="more" size={20} /></button><button className={`tool-button${activeTool === 'pen' ? ' active' : ''}`} title="그리기" aria-label="그리기" onClick={() => setActiveTool('pen')}><Icon name="pen" size={19} /></button></div><div className="tool-separator" /><div className="tool-group"><label className="tool-button file-tool" title="사진 올리기" aria-label="사진 올리기"><Icon name="image" size={19} /><input type="file" accept="image/*" onChange={uploadImage} /></label><button className="tool-button" title="코드 공유" aria-label="코드 공유" onClick={() => setShowCode(true)}><Icon name="code" size={19} /></button></div><div className="tool-separator" /><div className="color-picker" aria-label="펜 색상">{inkColors.map((ink) => <button key={ink} style={{ '--ink': ink }} className={color === ink ? 'selected' : ''} onClick={() => setColor(ink)} aria-label={`색상 ${ink}`} />)}</div><div className="tool-bottom"><span className="tool-help">⌘ /</span><span>도구</span></div></aside>
      <main className="board-region"><div className="board-topline"><span className="board-section-label"><i /> 캔버스 보드</span><span className="board-updated"><Icon name="clock" size={14} /> 모든 변경사항은 실시간 공유돼요</span></div><div className={`canvas-stage ${activeTool === 'pen' ? 'drawing-mode' : ''}`} ref={boardRef} onPointerDown={startDrawing} onPointerMove={moveDrawing} onPointerUp={stopDrawing} onPointerCancel={stopDrawing}>
        <div className="stage-label"><span>AGORA / {String(canvasId).padStart(2, '0')}</span><b>{canvas?.canvas_name || '공유 캔버스'}</b></div>
        <DrawnStrokes items={items} />
        {sortedItems.map(([id, item]) => item.kind === 'image' ? <div key={id} className={`canvas-object image-object ${activeTool === 'select' ? 'movable' : ''}`} style={{ left: `${(item.x || 0) * 100}%`, top: `${(item.y || 0) * 100}%`, width: `${(item.width || 0.3) * 100}%` }} onPointerDown={(event) => startObjectDrag(event, id, item)} onPointerMove={moveObject} onPointerUp={stopObjectDrag} onPointerCancel={stopObjectDrag}><img src={item.src} alt={item.filename || '공유된 이미지'} /><div className="object-caption"><Icon name="image" size={13} />{item.filename || '공유 이미지'}<button onClick={() => deleteItem(id)} aria-label="이미지 삭제">×</button></div></div> : item.kind === 'code' ? <div key={id} className={`canvas-object code-object ${activeTool === 'select' ? 'movable' : ''}`} style={{ left: `${(item.x || 0) * 100}%`, top: `${(item.y || 0) * 100}%`, width: `${(item.width || 0.32) * 100}%` }} onPointerDown={(event) => startObjectDrag(event, id, item)} onPointerMove={moveObject} onPointerUp={stopObjectDrag} onPointerCancel={stopObjectDrag}><div className="code-object-head"><span className="code-file-icon"><Icon name="code" size={15} /></span><strong>{item.filename || 'snippet.js'}</strong><small>{item.language || 'text'}</small><button onClick={() => deleteItem(id)} aria-label="코드 삭제">×</button></div><pre><code>{item.code}</code></pre><div className="code-object-foot"><span><i /> SHARED SNIPPET</span><button onClick={() => navigator.clipboard?.writeText(item.code || '')}>복사</button></div></div> : null)}
        {activeTool === 'pen' && <div className="draw-cursor-label"><Icon name="pen" size={13} /> 그리는 중</div>}
      </div><div className="board-footer"><span>확대 100%</span><span className="board-footer-center">아이디어는 아직 자라는 중 <i>✳</i></span><span>{Object.keys(items).length}개 오브젝트</span></div></main>
      <aside className="canvas-sidepanel"><div className="sidepanel-tabs"><button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}><Icon name="chat" size={17} /> 대화 <span>{messages.length}</span></button><button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}><Icon name="user" size={17} /> 멤버</button></div>
        {tab === 'chat' ? <><div className="conversation-heading"><span className="conversation-icon"><Icon name="sparkle" size={16} /></span><div><strong>캔버스 대화</strong><small>떠오르는 생각을 나눠보세요</small></div></div><div className="message-list">{messages.length ? messages.map((entry) => <div className={`chat-entry${entry.own ? ' own' : ''}`} key={entry.id}><div className="chat-entry-avatar">{entry.sender.slice(0, 1)}</div><div className="chat-entry-content"><div><strong>{entry.sender}</strong><time>{entry.time.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{entry.text}</p></div></div>) : <div className="chat-empty"><span>✳</span><strong>첫 대화를 시작해보세요.</strong><small>캔버스에 대한 생각을 멤버들과 나눠요.</small></div>}</div><form className="chat-compose" onSubmit={submitMessage}><textarea rows="2" placeholder="메시지를 남겨보세요..." value={message} onChange={(e) => setMessage(e.target.value)} disabled={connection !== 'connected'} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form.requestSubmit(); } }} /><div><span>Enter로 전송 · Shift + Enter 줄바꿈</span><button type="submit" disabled={!message.trim() || connection !== 'connected'} aria-label="메시지 전송"><Icon name="send" size={16} /></button></div></form></> : <div className="member-list-panel"><div className="member-panel-title"><strong>함께 만드는 사람</strong><span>{settings?.participants?.length || 0}명</span></div>{(settings?.participants || []).map((person, index) => <div className="member-row" key={`${person.nickname}-${person.tag_number}`}><span className={`avatar member-avatar avatar-tone-${index % 4}`}>{person.nickname.slice(0, 1)}</span><span><strong>{person.nickname} <small>#{person.tag_number}</small></strong><small>{index === 0 ? '캔버스 멤버' : '함께 작업 중'}</small></span>{index === 0 && <i className="member-online-dot" />}</div>)}</div>}
        <div className="sidepanel-bottom"><span className="online-indicator"><i /> {connection === 'connected' ? '모든 변경사항 동기화됨' : '연결을 확인 중이에요'}</span><button className="sidepanel-more" onClick={() => setShowSettings(true)} aria-label="캔버스 상세 설정"><Icon name="more" size={18} /></button></div>
      </aside>
    </div>}
    {toast && <div className="toast-message" role="status"><Icon name="check" size={16} />{toast}</div>}
    {showCode && <CodeDialog onClose={() => setShowCode(false)} onShare={shareCode} />}
    {showSettings && <SettingsDialog settings={settings} pending={settingsPending} onClose={() => setShowSettings(false)} onUpdate={sendSettings} onAddParticipant={(nickname, tag) => sendSettings('participant_add', null, { nickname, tag_number: tag })} onRemoveParticipant={(person) => sendSettings('participant_remove', null, { nickname: person.nickname, tag_number: person.tag_number })} />}
  </div>;
}
