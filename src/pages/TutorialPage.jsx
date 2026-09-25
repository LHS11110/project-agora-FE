import { useEffect, useRef, useState } from 'react';
import { Link } from '../routing.jsx';
import Icon from '../components/Icon.jsx';
import MarkdownText from '../components/MarkdownText.jsx';
import EditableTable from '../components/EditableTable.jsx';
import MathFormula from '../components/MathFormula.jsx';
import VectorLayer from '../components/VectorLayer.jsx';
import { objectBounds } from '../components/CanvasSpatialBTree.js';
import { connectorGeometry } from '../components/connectorGeometry.js';
import { createTableData, normalizeTableCount, resizeTableData, updateTableValue, MAX_TABLE_COLUMNS, MAX_TABLE_ROWS } from '../components/tableModel.js';
import '../tutorial.css';

const demoItems = {
  'demo-rectangle': { kind: 'shape', shapeType: 'rectangle', x: 0.11, y: 0.19, width: 0.24, height: 0.15, color: '#d58165' },
  'demo-ellipse': { kind: 'shape', shapeType: 'ellipse', x: 0.6, y: 0.22, width: 0.17, height: 0.13, color: '#6c8d77' },
  'demo-connector': { kind: 'connector', from: 'demo-note', to: 'demo-math', color: '#8b8f8c', strokeWidth: 1.5 },
  'demo-note': { kind: 'text', text: '생각을 그려봐요', x: 0.15, y: 0.25, width: 0.18 },
  'demo-math': { kind: 'math', formula: 'x^2 + y^2 = r^2', x: 0.58, y: 0.28, width: 0.22 },
  'demo-sticky': { kind: 'note', text: '# 좋은 생각\n- 작게 시작하기\n**함께 발전시키기**', x: 0.36, y: 0.54, width: 0.24, color: '#f6edcf', rotation: -1.2 },
  'demo-table': { kind: 'table', ...createTableData(2, 3), rows: [['아이디어 정리', '함께 작업', '초안 작성'], ['마지막 확인', '다음 단계', '**완료**']], x: 0.6, y: 0.56, width: 0.36, height: 0.28 },
};

const stickyNoteColors = ['#f6edcf', '#f3d8cc', '#dce9e0', '#dce6f4', '#eadff1'];

const tools = [
  { id: 'select', label: '선택 및 이동', icon: 'select' },
  { id: 'pen', label: '드로잉', icon: 'pen' },
  { id: 'connect', label: '오브젝트 연결', icon: 'connect' },
  { id: 'rectangle', label: '사각형', icon: 'rectangle' },
  { id: 'ellipse', label: '타원', icon: 'ellipse' },
  { id: 'arrow', label: '화살표', icon: 'connect' },
  { id: 'text', label: '텍스트', icon: 'text' },
  { id: 'note', label: '포스트잇', icon: 'sticky' },
  { id: 'table', label: '테이블', icon: 'table' },
  { id: 'math', label: '수식', icon: 'math' },
  { id: 'code', label: '코드 블록', icon: 'code' },
];

const makeId = () => globalThis.crypto?.randomUUID?.() || `tutorial-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const isEditableTarget = (target) => target instanceof HTMLElement
  && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

export default function TutorialPage() {
  const boardRef = useRef(null);
  const draftSetterRef = useRef(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef([]);
  const panRef = useRef(null);
  const dragRef = useRef(null);
  const spacePressedRef = useRef(false);
  const zoomHoldRef = useRef(null);
  const zoomPointerPressRef = useRef(false);
  const [items, setItems] = useState(demoItems);
  const [activeTool, setActiveTool] = useState('select');
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [connectionStartId, setConnectionStartId] = useState(null);
  const [color, setColor] = useState('#d58165');
  const [connectorColor, setConnectorColor] = useState('#8b8f8c');
  const [connectorWidth, setConnectorWidth] = useState(1.5);
  const [noteColor, setNoteColor] = useState(stickyNoteColors[0]);
  const [tableConfig, setTableConfig] = useState({ rows: 3, columns: 3, width: 42, height: 32 });
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [showGrid, setShowGrid] = useState(true);
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [boardSize, setBoardSize] = useState({ width: 1, height: 1 });
  const [zoomSensitivity, setZoomSensitivity] = useState(1);
  const [composer, setComposer] = useState(null);

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
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'Space' && !isEditableTarget(event.target)) {
        spacePressedRef.current = true;
        event.preventDefault();
      }
    };
    const onKeyUp = (event) => { if (event.code === 'Space') spacePressedRef.current = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => () => {
    const hold = zoomHoldRef.current;
    if (hold?.delay) window.clearTimeout(hold.delay);
    if (hold?.repeat) window.clearInterval(hold.repeat);
  }, []);

  const position = (event) => {
    const bounds = boardRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: (event.clientX - bounds.left - camera.x) / (Math.max(1, bounds.width) * camera.scale),
      y: (event.clientY - bounds.top - camera.y) / (Math.max(1, bounds.height) * camera.scale),
    };
  };

  const addItem = (item) => {
    const id = makeId();
    setItems((current) => ({ ...current, [id]: item }));
    setSelectedItemId(id);
    return id;
  };

  const startPan = (event) => {
    event.preventDefault();
    event.stopPropagation();
    panRef.current = { x: event.clientX, y: event.clientY, cameraX: camera.x, cameraY: camera.y };
    boardRef.current?.classList.add('panning');
    boardRef.current?.setPointerCapture?.(event.pointerId);
  };

  const startOnBoard = (event) => {
    const targetItem = event.target.closest?.('.tutorial-item');
    if (event.button === 1 || spacePressedRef.current) { startPan(event); return; }
    if (activeTool === 'select' && !targetItem) { startPan(event); return; }
    if (targetItem && activeTool !== 'pen') return;

    if (activeTool === 'pen') {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drawingRef.current = true;
      pointsRef.current = [position(event)];
      draftSetterRef.current?.({ points: pointsRef.current, color, strokeWidth });
      return;
    }

    const point = position(event);
    if (activeTool === 'table') {
      const width = tableConfig.width / 100;
      const height = tableConfig.height / 100;
      addItem({ kind: 'table', ...createTableData(tableConfig.rows, tableConfig.columns), x: point.x - width / 2, y: point.y - height / 2, width, height });
      setActiveTool('select');
      return;
    }
    if (['rectangle', 'ellipse', 'arrow'].includes(activeTool)) {
      addItem({
        kind: 'shape',
        shapeType: activeTool === 'arrow' ? 'arrow' : activeTool,
        x: point.x - 0.07,
        y: point.y - 0.06,
        width: 0.14,
        height: 0.12,
        color,
      });
      setActiveTool('select');
      return;
    }
    if (activeTool === 'text' || activeTool === 'code' || activeTool === 'note') {
      const id = addItem(activeTool === 'text'
        ? { kind: 'text', text: '', x: point.x - 0.11, y: point.y - 0.06, width: 0.22 }
        : activeTool === 'code'
          ? { kind: 'code', code: '', filename: 'idea.js', language: 'javascript', x: point.x - 0.16, y: point.y - 0.1, width: 0.32 }
          : { kind: 'note', text: '', x: point.x - 0.12, y: point.y - 0.08, width: 0.24, color: noteColor, rotation: Math.random() * 3 - 1.5 });
      setEditingId(id);
      setActiveTool('select');
      return id;
    }
    if (activeTool === 'math') {
      setComposer({ kind: 'math', x: point.x, y: point.y, value: 'f(x) = x^2 + 2x + 1' });
    }
  };

  const startItemInteraction = (event, id) => {
    if (event.button === 1 || spacePressedRef.current) return;
    if (activeTool === 'pen') {
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
        addItem({ kind: 'connector', from: connectionStartId, to: id, color: connectorColor, strokeWidth: connectorWidth });
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
    if (item.kind === 'connector') { focusConnectorTarget(item, id); return; }
    event.currentTarget.classList.add('object-dragging');
    dragRef.current = {
      id,
      offsetX: point.x - (Number(item.x) || 0),
      offsetY: point.y - (Number(item.y) || 0),
      startX: point.x,
      startY: point.y,
      element: event.currentTarget,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveOnBoard = (event) => {
    if (panRef.current) {
      const pan = panRef.current;
      setCamera((current) => ({ ...current, x: pan.cameraX + event.clientX - pan.x, y: pan.cameraY + event.clientY - pan.y }));
      return;
    }
    if (dragRef.current) {
      const point = position(event);
      const { id, offsetX, offsetY, startX, startY } = dragRef.current;
      setItems((current) => {
        const item = current[id];
        if (!item) return current;
        const next = item.kind === 'stroke'
          ? { ...item, points: item.points.map((part) => ({ ...part, x: part.x + point.x - startX, y: part.y + point.y - startY })) }
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
    if (dragRef.current) { dragRef.current.element?.classList.remove('object-dragging'); dragRef.current = null; return; }
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const points = pointsRef.current;
    pointsRef.current = [];
    draftSetterRef.current?.(null);
    if (points.length) addItem({ kind: 'stroke', points, color, strokeWidth });
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
      return {
        scale,
        x: targetX - bounds.left - worldX * bounds.width * scale,
        y: targetY - bounds.top - worldY * bounds.height * scale,
      };
    });
  };

  const stopZoomHold = () => {
    const hold = zoomHoldRef.current;
    if (hold?.delay) window.clearTimeout(hold.delay);
    if (hold?.repeat) window.clearInterval(hold.repeat);
    zoomHoldRef.current = null;
    window.setTimeout(() => { zoomPointerPressRef.current = false; }, 0);
  };
  const cancelZoomHold = () => { stopZoomHold(); zoomPointerPressRef.current = false; };
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
    if (zoomPointerPressRef.current) { zoomPointerPressRef.current = false; return; }
    zoomBy(factor);
  };

  const handleWheel = (event) => {
    if (event.target.closest?.('.tutorial-item, .tutorial-editor')) return;
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      zoomBy(Math.exp(-event.deltaY * 0.0015 * zoomSensitivity), event.clientX, event.clientY);
    } else {
      setCamera((current) => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
    }
  };

  const placeComposer = () => {
    if (!composer?.value.trim()) return;
    const id = addItem({ kind: 'math', formula: composer.value.trim(), x: composer.x - 0.1, y: composer.y - 0.05, width: 0.22 });
    setComposer(null);
    setActiveTool('select');
    setSelectedItemId(id);
  };

  const changeText = (id, value) => setItems((current) => ({ ...current, [id]: { ...current[id], text: value } }));
  const changeCode = (id, value) => setItems((current) => ({ ...current, [id]: { ...current[id], code: value } }));
  const changeMetadata = (id, field, value) => setItems((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  const changeTableItem = (id, update) => setItems((current) => {
    if (current[id]?.kind !== 'table') return current;
    const nextItem = typeof update === 'function' ? update(current[id]) : { ...current[id], ...update };
    return nextItem === current[id] ? current : { ...current, [id]: nextItem };
  });
  const changeTableCount = (field, event) => {
    if (event.target.value === '') return;
    const nextCount = normalizeTableCount(event.target.value, field === 'rows' ? MAX_TABLE_ROWS : MAX_TABLE_COLUMNS);
    if (activeTool === 'table') {
      setTableConfig((current) => ({ ...current, [field]: nextCount }));
      return;
    }
    if (!selectedTable) return;
    changeTableItem(selectedItemId, (current) => resizeTableData(
      current,
      field === 'rows' ? nextCount : current.rows?.length || 1,
      field === 'columns' ? nextCount : current.columns?.length || 1,
    ));
  };
  const changeTableSize = (field, event) => {
    if (event.target.value === '') return;
    const nextSize = Math.max(10, Math.min(100, Number(event.target.value) || 10));
    if (activeTool === 'table') setTableConfig((current) => ({ ...current, [field]: nextSize }));
    else if (selectedTable) changeTableItem(selectedItemId, { [field]: nextSize / 100 });
  };
  const deleteItem = (id) => {
    setItems((current) => {
      const next = { ...current };
      delete next[id];
      for (const [key, item] of Object.entries(next)) {
        if (item.kind === 'connector' && (item.from === id || item.to === id)) delete next[key];
      }
      return next;
    });
    if (selectedItemId === id) setSelectedItemId(null);
    if (editingId === id) setEditingId(null);
  };
  const clear = () => { setItems({}); setComposer(null); setSelectedItemId(null); setEditingId(null); setConnectionStartId(null); };
  const reset = () => {
    setItems({ ...demoItems });
    setComposer(null);
    setActiveTool('select');
    setSelectedItemId(null);
    setEditingId(null);
    setConnectionStartId(null);
    setCamera({ x: 0, y: 0, scale: 1 });
  };

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { window.alert('이미지 파일만 올려주세요.'); return; }
    if (file.size > 2 * 1024 * 1024) { window.alert('이미지는 2MB 이하로 올려주세요.'); return; }
    const src = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }).catch(() => null);
    if (!src) return;
    const x = (0.5 - camera.x / (Math.max(1, boardSize.width) * camera.scale)) - 0.15;
    const y = (0.5 - camera.y / (Math.max(1, boardSize.height) * camera.scale)) - 0.1;
    addItem({ kind: 'image', src, filename: file.name, x, y, width: 0.3, height: 0.2 });
  };

  const axisOriginX = boardSize.width * camera.scale / 2 + camera.x;
  const axisOriginY = boardSize.height * camera.scale / 2 + camera.y;
  const planeStyle = {
    '--axis-origin-x': `${axisOriginX}px`,
    '--axis-origin-y': `${axisOriginY}px`,
    '--axis-x-arrow-opacity': axisOriginX <= boardSize.width ? 1 : 0,
    '--axis-y-arrow-opacity': axisOriginY >= 0 ? 1 : 0,
  };
  const stageStyle = {
    '--grid-size': `${20 * camera.scale}px`,
    '--grid-position-x': `${camera.x}px`,
    '--grid-position-y': `${camera.y}px`,
  };
  const zoomStep = 1 + 0.15 * zoomSensitivity;
  const selectedTable = selectedItemId ? items[String(selectedItemId)]?.kind === 'table' ? items[String(selectedItemId)] : null : null;
  const selectedItem = selectedItemId ? items[String(selectedItemId)] : null;
  const selectedConnector = selectedItem?.kind === 'connector' ? selectedItem : null;
  const connectorToEdit = activeTool === 'connect' ? null : selectedConnector;
  const changeRotation = (value) => setItems((current) => current[selectedItemId] ? { ...current, [selectedItemId]: { ...current[selectedItemId], rotation: Math.max(-180, Math.min(180, Number(value) || 0)) } } : current);
  const updateConnectorAppearance = (field, value) => {
    if (!connectorToEdit) {
      if (field === 'color') setConnectorColor(value);
      else setConnectorWidth(Math.max(0.8, Math.min(4, Number(value) || 1.5)));
      return;
    }
    setItems((current) => current[selectedItemId]?.kind === 'connector'
      ? { ...current, [selectedItemId]: { ...current[selectedItemId], [field]: field === 'strokeWidth' ? Math.max(0.8, Math.min(4, Number(value) || 1.5)) : value } }
      : current);
  };
  const focusConnectorTarget = (connector, connectorId) => {
    const target = items[String(connector.to)];
    const board = boardRef.current?.getBoundingClientRect();
    if (!target || !board) return;
    const bounds = objectBounds(target, items, board.width, board.height);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    setActiveTool('select');
    setSelectedItemId(String(connectorId ?? connector.to));
    setCamera((current) => ({ ...current, x: board.width / 2 - centerX * board.width * current.scale, y: board.height / 2 - centerY * board.height * current.scale }));
  };

  return <div className="tutorial-page">
    <header className="tutorial-header">
      <Link className="brand-lockup" to="/"><span className="brand-mark"><i /><i /><i /><i /></span><span>agora<span className="brand-period">.</span></span></Link>
      <div><span className="tutorial-breadcrumb">튜토리얼 <Icon name="chevron" size={14} /> 캔버스 체험</span><span className="tutorial-local-badge"><i /> 브라우저에서만 작동</span></div>
      <Link className="button button-outline" to="/login">계정 만들기 <Icon name="arrow" size={15} /></Link>
    </header>
    <main className="tutorial-main">
      <section className="tutorial-intro">
        <div><span className="section-kicker">A SMALL SPACE TO TRY</span><h1>아고라 캔버스, 직접 만져보세요.</h1><p>실제 캔버스처럼 아이템을 놓고, 편집하고, 이동해보세요. 체험 데이터는 서버에 저장되지 않습니다.</p></div>
        <div className="tutorial-steps"><span><b>01</b> 도구 선택</span><Icon name="chevron" size={14} /><span><b>02</b> 캔버스 클릭</span><Icon name="chevron" size={14} /><span><b>03</b> 자유롭게 조합</span></div>
      </section>
      <section className="tutorial-workspace" aria-label="인터랙티브 캔버스 체험">
        <aside className="tutorial-tools" aria-label="캔버스 도구">
          {tools.map((tool) => <button key={tool.id} type="button" className={activeTool === tool.id ? 'active' : ''} aria-label={tool.label} title={tool.label} aria-pressed={activeTool === tool.id} onClick={() => { setActiveTool(tool.id); setComposer(null); }}><Icon name={tool.icon} size={18} /></button>)}
          <div className="tutorial-tool-divider" />
          <label className="tutorial-tool-upload" title="사진 올리기" aria-label="사진 올리기"><Icon name="image" size={18} /><input type="file" accept="image/*" onChange={uploadImage} /></label>
          <label className="tutorial-color" title={activeTool === 'note' ? '포스트잇 색상' : activeTool === 'connect' ? '연결 화살표 색상' : '선 색상'}><input type="color" aria-label={activeTool === 'note' ? '포스트잇 색상' : activeTool === 'connect' ? '연결 화살표 색상' : '선 색상'} value={activeTool === 'note' ? noteColor : activeTool === 'connect' ? connectorColor : color} onChange={(event) => activeTool === 'note' ? setNoteColor(event.target.value) : activeTool === 'connect' ? setConnectorColor(event.target.value) : setColor(event.target.value)} /><span style={{ background: activeTool === 'note' ? noteColor : activeTool === 'connect' ? connectorColor : color }} /></label>
        </aside>
        <div className="tutorial-board-column">
          <div className="tutorial-board-top">
            <span><i /> 로컬 캔버스 · 서버 연결 없음</span>
            <div className="tutorial-board-actions">
              {selectedItem && <label className="tutorial-range-control">{selectedConnector ? '곡선 방향' : '회전'} <input type="range" min="-180" max="180" step="1" value={Math.round(Number(selectedItem.rotation) || 0)} onChange={(event) => changeRotation(event.target.value)} aria-label={selectedConnector ? '선택한 화살표 곡선 방향' : '선택한 객체 회전'} /><b>{Math.round(Number(selectedItem.rotation) || 0)}°</b></label>}
              {(activeTool === 'connect' || selectedConnector) && <><label className="tutorial-connector-color-control">색상<input type="color" value={connectorToEdit?.color || connectorColor} onChange={(event) => updateConnectorAppearance('color', event.target.value)} aria-label="연결 화살표 색상" /></label><label className="tutorial-range-control">굵기 <input type="range" min="0.8" max="4" step="0.2" value={Number(connectorToEdit?.strokeWidth) || connectorWidth} onChange={(event) => updateConnectorAppearance('strokeWidth', event.target.value)} aria-label="연결 화살표 굵기" /><b>{Number(connectorToEdit?.strokeWidth) || connectorWidth}px</b></label></>}
              {activeTool === 'pen' && <label className="tutorial-range-control">굵기 <input type="range" min="1" max="20" step="1" value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} aria-label="드로잉 선 굵기" /><b>{strokeWidth}px</b></label>}
              <label className="tutorial-range-control">줌 감도 <input type="range" min="0.5" max="2" step="0.1" value={zoomSensitivity} onChange={(event) => setZoomSensitivity(Number(event.target.value))} aria-label="줌 감도" /><b>{Math.round(zoomSensitivity * 100)}%</b></label>
              <button className="tutorial-zoom-button" type="button" aria-label="축소" title="클릭: 한 단계 축소 · 길게 누르기: 계속 축소" onPointerDown={(event) => startZoomHold(event, 1 / zoomStep)} onPointerUp={stopZoomHold} onPointerCancel={cancelZoomHold} onLostPointerCapture={stopZoomHold} onClick={() => clickZoom(1 / zoomStep)}>−</button>
              <span className="tutorial-zoom-value">{Math.round(camera.scale * 100)}%</span>
              <button className="tutorial-zoom-button" type="button" aria-label="확대" title="클릭: 한 단계 확대 · 길게 누르기: 계속 확대" onPointerDown={(event) => startZoomHold(event, zoomStep)} onPointerUp={stopZoomHold} onPointerCancel={cancelZoomHold} onLostPointerCapture={stopZoomHold} onClick={() => clickZoom(zoomStep)}>+</button>
              <button type="button" onClick={() => setCamera({ x: 0, y: 0, scale: 1 })}>맞춤</button>
              <button type="button" onClick={() => setShowGrid((current) => !current)} aria-pressed={showGrid}><Icon name="grid" size={15} />격자 {showGrid ? '켜짐' : '꺼짐'}</button>
              <button type="button" onClick={clear}>비우기</button>
              <button type="button" onClick={reset}>예시 복원</button>
            </div>
          </div>
          {(activeTool === 'table' || selectedTable) && <div className="tutorial-table-settings" onPointerDown={(event) => event.stopPropagation()}><strong>{activeTool === 'table' ? '새 테이블 설정' : '테이블 설정'}</strong><label>행<input type="number" min="1" max={MAX_TABLE_ROWS} value={activeTool === 'table' ? tableConfig.rows : selectedTable.rows?.length || 1} onChange={(event) => changeTableCount('rows', event)} /></label><label>열<input type="number" min="1" max={MAX_TABLE_COLUMNS} value={activeTool === 'table' ? tableConfig.columns : selectedTable.columns?.length || 1} onChange={(event) => changeTableCount('columns', event)} /></label><label>너비 %<input type="number" min="10" max="100" value={activeTool === 'table' ? tableConfig.width : Math.round((selectedTable.width || 0.42) * 100)} onChange={(event) => changeTableSize('width', event)} /></label><label>높이 %<input type="number" min="10" max="100" value={activeTool === 'table' ? tableConfig.height : Math.round((selectedTable.height || 0.32) * 100)} onChange={(event) => changeTableSize('height', event)} /></label><small>{activeTool === 'table' ? '캔버스를 클릭해 놓으세요.' : '컬럼 이름과 셀을 두 번 클릭해 Markdown으로 편집하세요.'}</small></div>}
          <div
            className={`tutorial-stage${showGrid ? '' : ' no-grid'}${activeTool === 'pen' ? ' pen-active' : ''}`}
            ref={boardRef}
            style={stageStyle}
            onPointerDown={startOnBoard}
            onPointerMove={moveOnBoard}
            onPointerUp={finishInteraction}
            onPointerCancel={finishInteraction}
            onWheel={handleWheel}
          >
            <div className="tutorial-plane" style={planeStyle} aria-hidden="true"><span className="tutorial-coordinate x-axis" /><span className="tutorial-coordinate y-axis" /><span className="tutorial-origin">0</span><b className="tutorial-x-label">X</b><b className="tutorial-y-label">Y</b></div>
            <VectorLayer items={items} camera={camera} onReady={(setDraft) => { draftSetterRef.current = setDraft; }} />
            <div className="tutorial-scene" style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})` }}>
              {Object.entries(items).map(([id, item]) => {
                const selectedClass = selectedItemId === id || connectionStartId === id ? ' selected' : '';
                const commonHandlers = {
                  onPointerDown: (event) => startItemInteraction(event, id),
                  onDoubleClick: () => { if (['text', 'code', 'note'].includes(item.kind)) { setSelectedItemId(id); setEditingId(id); } },
                };
                const deleteButton = <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => deleteItem(id)} aria-label="아이템 삭제">×</button>;
                const style = {
                  left: `${(Number(item.x) || 0) * 100}%`,
                  top: `${(Number(item.y) || 0) * 100}%`,
                  '--tutorial-ink': item.color || color,
                  '--sticky-note-color': item.color || stickyNoteColors[0],
                  '--sticky-note-rotation': `${Number(item.rotation) || -1}deg`,
                  '--tutorial-item-rotation': `${Number(item.rotation) || 0}deg`,
                };
                if (item.kind === 'stroke' || item.kind === 'connector') {
                  const bounds = objectBounds(item, items, boardSize.width, boardSize.height);
                  const curve = item.kind === 'connector' ? connectorGeometry(item, items, boardSize.width, boardSize.height) : null;
                  const geometryWidth = Math.max(1, (bounds.maxX - bounds.minX) * boardSize.width);
                  const geometryHeight = Math.max(1, (bounds.maxY - bounds.minY) * boardSize.height);
                  const offsetX = bounds.minX * boardSize.width;
                  const offsetY = bounds.minY * boardSize.height;
                  const curvePath = curve?.points.map((point, index) => `${index ? 'L' : 'M'}${point.x - offsetX} ${point.y - offsetY}`).join(' ');
                  const arrowTip = curve?.points.at(-1);
                  return <div key={id} className={`tutorial-item tutorial-vector-hit${selectedClass}`} style={{ ...style, left: `${bounds.minX * 100}%`, top: `${bounds.minY * 100}%`, width: `${Math.max(0.01, bounds.maxX - bounds.minX) * 100}%`, height: `${Math.max(0.01, bounds.maxY - bounds.minY) * 100}%` }} {...commonHandlers}>{deleteButton}{curvePath && <svg className="tutorial-connector-hit-path" viewBox={`0 0 ${geometryWidth} ${geometryHeight}`} preserveAspectRatio="none" aria-hidden="true"><path d={curvePath} /><circle cx={arrowTip.x - offsetX} cy={arrowTip.y - offsetY} r="9" /></svg>}</div>;
                }
                if (item.kind === 'table') {
                  return <div key={id} className={`tutorial-item tutorial-table-item${selectedClass}`} style={{ ...style, width: `${(Number(item.width) || 0.42) * 100}%`, height: `${(Number(item.height) || 0.32) * 100}%` }} {...commonHandlers}><EditableTable item={item} onChange={(location, value) => changeTableItem(id, (current) => updateTableValue(current, location, value))} />{deleteButton}</div>;
                }
                if (item.kind === 'shape') {
                  return <div key={id} className={`tutorial-item tutorial-shape-hit tutorial-shape-${item.shapeType || 'rectangle'}${selectedClass}`} style={{ ...style, width: `${(Number(item.width) || 0.14) * 100}%`, height: `${(Number(item.height) || 0.12) * 100}%` }} {...commonHandlers}>{deleteButton}</div>;
                }
                if (item.kind === 'image') {
                  return <div key={id} className={`tutorial-item tutorial-image-item${selectedClass}`} style={{ ...style, width: `${(Number(item.width) || 0.3) * 100}%` }} {...commonHandlers}><img src={item.src} alt={item.filename || '튜토리얼 이미지'} /><div>{item.filename || '이미지'}{deleteButton}</div></div>;
                }
                if (item.kind === 'note') {
                  return <div key={id} className={`tutorial-item tutorial-sticky-note${selectedClass}`} style={{ ...style, width: `${(Number(item.width) || 0.24) * 100}%` }} {...commonHandlers} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setEditingId((current) => current === id ? null : current); }}>
                    <div className="tutorial-sticky-head"><span title="끌어서 포스트잇 이동"><Icon name="sticky" size={13} /> 포스트잇</span><input type="color" aria-label="포스트잇 색상" title="포스트잇 색상 변경" value={item.color || stickyNoteColors[0]} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => changeMetadata(id, 'color', event.target.value)} />{deleteButton}</div>
                    {editingId === id ? <textarea autoFocus aria-label="포스트잇 Markdown 편집" value={item.text || ''} placeholder={'# 메모 제목\n- 할 일\n**중요한 내용**'} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => changeText(id, event.target.value)} /> : <div className="tutorial-sticky-content" onDoubleClick={() => { setSelectedItemId(id); setEditingId(id); }} title="두 번 클릭해 Markdown 편집">{item.text ? <MarkdownText source={item.text} /> : <p className="tutorial-sticky-empty">두 번 클릭해 메모를 작성하세요.</p>}</div>}
                    <small>간단한 Markdown · 로컬 체험</small>
                  </div>;
                }
                if (item.kind === 'text') {
                  return <div key={id} className={`tutorial-item tutorial-text-item${selectedClass}`} style={{ ...style, width: `${(Number(item.width) || 0.22) * 100}%` }} {...commonHandlers}>
                    {editingId === id ? <><textarea autoFocus value={item.text || ''} placeholder="여기에 텍스트를 입력하세요." aria-label="텍스트 편집" onPointerDown={(event) => event.stopPropagation()} onChange={(event) => changeText(id, event.target.value)} onBlur={() => setEditingId((current) => current === id ? null : current)} />{deleteButton}</> : <><span title="두 번 클릭해 편집">{item.text || '두 번 클릭해 편집'}</span>{deleteButton}</>}
                  </div>;
                }
                if (item.kind === 'math') {
                  return <div key={id} className={`tutorial-item tutorial-math-item${selectedClass}`} style={{ ...style, width: `${(Number(item.width) || 0.22) * 100}%` }} {...commonHandlers}><MathFormula formula={item.formula} />{deleteButton}</div>;
                }
                if (item.kind === 'code') {
                  return <div key={id} className={`tutorial-item tutorial-code-item${selectedClass}`} style={{ ...style, width: `${(Number(item.width) || 0.32) * 100}%` }} {...commonHandlers} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setEditingId((current) => current === id ? null : current); }}>
                    <div className="tutorial-code-head"><Icon name="code" size={14} />{editingId === id ? <><input value={item.filename || ''} aria-label="파일 이름" maxLength={80} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => changeMetadata(id, 'filename', event.target.value)} /><select value={item.language || 'javascript'} aria-label="코드 언어" onPointerDown={(event) => event.stopPropagation()} onChange={(event) => changeMetadata(id, 'language', event.target.value)}><option>javascript</option><option>typescript</option><option>python</option><option>html</option><option>css</option><option>json</option><option>text</option></select></> : <><span>{item.filename || 'idea.js'}</span><small>{item.language || 'javascript'}</small></>}{deleteButton}</div>
                    {editingId === id ? <textarea autoFocus value={item.code || ''} placeholder="여기에 코드를 작성하세요." aria-label="코드 편집" onPointerDown={(event) => event.stopPropagation()} onChange={(event) => changeCode(id, event.target.value)} /> : <pre title="두 번 클릭해 편집">{item.code || '두 번 클릭해 편집'}</pre>}
                  </div>;
                }
                return null;
              })}
            </div>
            {composer && <form className="tutorial-editor" onPointerDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); placeComposer(); }}><div className="tutorial-editor-heading"><span>수식 작성</span><button type="button" onClick={() => setComposer(null)} aria-label="닫기"><Icon name="close" size={15} /></button></div><textarea autoFocus value={composer.value} onChange={(event) => setComposer((current) => ({ ...current, value: event.target.value }))} aria-label="수식 입력" /><button className="tutorial-place-button" type="submit">캔버스에 놓기 <Icon name="arrow" size={14} /></button></form>}
            <span className="tutorial-stage-hint">{activeTool === 'select' ? '오브젝트 드래그 이동 · 빈 곳 드래그 또는 Space + 드래그 이동' : `${tools.find((tool) => tool.id === activeTool)?.label} 도구 · 캔버스를 클릭`}</span>
          </div>
          <div className="tutorial-board-footer"><span>{Object.keys(items).length}개 오브젝트</span><span><i /> 이 탭에서만 유지 · 저장되지 않음</span></div>
        </div>
      </section>
      <aside className="tutorial-footnote"><Icon name="sparkle" size={17} /><p><strong>다음은 실제 캔버스에서.</strong> 이 화면은 서버 저장이나 공동 편집 없이 실제 캔버스의 배치, 편집, 이동 동작을 체험합니다.</p><Link to="/login">시작하기 <Icon name="arrow" size={14} /></Link></aside>
    </main>
  </div>;
}
