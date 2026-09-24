import { useRef, useState } from 'react';
import { Link } from '../routing.jsx';
import Icon from '../components/Icon.jsx';
import MathFormula from '../components/MathFormula.jsx';
import VectorLayer from '../components/VectorLayer.jsx';
import '../tutorial.css';

const demoItems = {
  'demo-rectangle': { kind: 'shape', shapeType: 'rectangle', x: 0.11, y: 0.19, width: 0.24, height: 0.15, color: '#d58165' },
  'demo-ellipse': { kind: 'shape', shapeType: 'ellipse', x: 0.6, y: 0.22, width: 0.17, height: 0.13, color: '#6c8d77' },
  'demo-connector': { kind: 'connector', from: 'demo-note', to: 'demo-math', color: '#6c8d77' },
  'demo-note': { kind: 'text', text: '생각을 그려봐요', x: 0.15, y: 0.25, width: 0.18 },
  'demo-math': { kind: 'math', formula: 'x^2 + y^2 = r^2', x: 0.58, y: 0.28, width: 0.22 },
};

const tools = [
  { id: 'select', label: '선택', icon: 'select' },
  { id: 'pen', label: '펜', icon: 'pen' },
  { id: 'rectangle', label: '사각형', icon: 'rectangle' },
  { id: 'ellipse', label: '타원', icon: 'ellipse' },
  { id: 'arrow', label: '화살표', icon: 'connect' },
  { id: 'text', label: '텍스트', icon: 'text' },
  { id: 'math', label: '수식', icon: 'math' },
  { id: 'code', label: '코드', icon: 'code' },
];

const makeId = () => globalThis.crypto?.randomUUID?.() || `tutorial-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function TutorialPage() {
  const boardRef = useRef(null);
  const draftSetterRef = useRef(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef([]);
  const [items, setItems] = useState(demoItems);
  const [activeTool, setActiveTool] = useState('select');
  const [color, setColor] = useState('#d58165');
  const [showGrid, setShowGrid] = useState(true);
  const [composer, setComposer] = useState(null);

  const position = (event) => {
    const bounds = boardRef.current.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) };
  };

  const startOnBoard = (event) => {
    if (event.target.closest?.('.tutorial-item')) return;
    const point = position(event);
    if (activeTool === 'pen') {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drawingRef.current = true;
      pointsRef.current = [point];
      return;
    }
    if (['rectangle', 'ellipse', 'arrow'].includes(activeTool)) {
      const shapeType = activeTool === 'rectangle' ? 'rectangle' : activeTool;
      const x = Math.max(0, Math.min(0.86, point.x - 0.07));
      const y = Math.max(0, Math.min(0.82, point.y - 0.06));
      setItems((current) => ({ ...current, [makeId()]: { kind: 'shape', shapeType, x, y, width: 0.14, height: 0.12, color } }));
      setActiveTool('select');
      return;
    }
    if (['text', 'math', 'code'].includes(activeTool)) {
      const initial = activeTool === 'code' ? 'const idea = "together";' : activeTool === 'math' ? 'f(x) = x^2 + 2x + 1' : '새로운 생각을 적어보세요';
      setComposer({ kind: activeTool, x: point.x, y: point.y, value: initial });
    }
  };

  const moveOnBoard = (event) => {
    if (!drawingRef.current) return;
    pointsRef.current.push(position(event));
    draftSetterRef.current?.({ points: pointsRef.current, color, strokeWidth: 4 });
  };

  const finishDrawing = (event) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const points = pointsRef.current;
    pointsRef.current = [];
    draftSetterRef.current?.(null);
    if (points.length) setItems((current) => ({ ...current, [makeId()]: { kind: 'stroke', points, color, strokeWidth: 4 } }));
  };

  const saveComposer = () => {
    const entry = composer;
    if (!entry?.value.trim()) return;
    const item = entry.kind === 'math'
      ? { kind: 'math', formula: entry.value.trim(), x: entry.x, y: entry.y, width: 0.25 }
      : entry.kind === 'code'
        ? { kind: 'code', filename: 'idea.js', language: 'javascript', code: entry.value, x: entry.x, y: entry.y, width: 0.3 }
        : { kind: 'text', text: entry.value.trim(), x: entry.x, y: entry.y, width: 0.24 };
    setItems((current) => ({ ...current, [makeId()]: item }));
    setComposer(null);
    setActiveTool('select');
  };

  const clear = () => { setItems({}); setComposer(null); };
  const reset = () => { setItems(demoItems); setComposer(null); setActiveTool('select'); };

  return <div className="tutorial-page">
    <header className="tutorial-header"><Link className="brand-lockup" to="/"><span className="brand-mark"><i /><i /><i /><i /></span><span>agora<span className="brand-period">.</span></span></Link><div><span className="tutorial-breadcrumb">튜토리얼 <Icon name="chevron" size={14} /> 캔버스 체험</span><span className="tutorial-local-badge"><i /> 브라우저에서만 작동</span></div><Link className="button button-outline" to="/login">계정 만들기 <Icon name="arrow" size={15} /></Link></header>
    <main className="tutorial-main">
      <section className="tutorial-intro"><div><span className="section-kicker">A SMALL SPACE TO TRY</span><h1>아고라 캔버스, 직접 만져보세요.</h1><p>아래 도구를 고르고 캔버스에 놓아보세요. 이 체험은 서버에 저장되지 않아요.</p></div><div className="tutorial-steps"><span><b>01</b> 도구 선택</span><Icon name="chevron" size={14} /><span><b>02</b> 캔버스 클릭</span><Icon name="chevron" size={14} /><span><b>03</b> 자유롭게 조합</span></div></section>
      <section className="tutorial-workspace" aria-label="인터랙티브 캔버스 체험">
        <aside className="tutorial-tools" aria-label="캔버스 도구">{tools.map((tool) => <button key={tool.id} className={activeTool === tool.id ? 'active' : ''} aria-label={tool.label} title={tool.label} onClick={() => setActiveTool(tool.id)}><Icon name={tool.icon} size={18} /></button>)}<div className="tutorial-tool-divider" /><label className="tutorial-color" title="선 색상"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><span style={{ background: color }} /></label></aside>
        <div className="tutorial-board-column"><div className="tutorial-board-top"><span><i /> 캔버스 체험 · 실시간 렌더링</span><div><button onClick={() => setShowGrid((current) => !current)} aria-pressed={showGrid}><Icon name="grid" size={15} />격자 {showGrid ? '켜짐' : '꺼짐'}</button><button onClick={clear}>비우기</button><button onClick={reset}>예시 복원</button></div></div>
          <div className={`tutorial-stage${showGrid ? '' : ' no-grid'}${activeTool === 'pen' ? ' pen-active' : ''}`} ref={boardRef} onPointerDown={startOnBoard} onPointerMove={moveOnBoard} onPointerUp={finishDrawing} onPointerCancel={finishDrawing}>
            <span className="tutorial-coordinate x-axis" /><span className="tutorial-coordinate y-axis" /><span className="tutorial-origin">0</span>
            <VectorLayer items={items} onReady={(setDraft) => { draftSetterRef.current = setDraft; }} />
            {Object.entries(items).map(([id, item]) => {
              if (!['text', 'math', 'code'].includes(item.kind)) return null;
              const style = { left: `${item.x * 100}%`, top: `${item.y * 100}%`, '--tutorial-ink': item.color || color };
              if (item.kind === 'text') return <div key={id} className="tutorial-item tutorial-text-item" style={style}><span>{item.text}</span><button onClick={() => setItems((current) => { const next = { ...current }; delete next[id]; return next; })} aria-label="텍스트 삭제">×</button></div>;
              if (item.kind === 'math') return <div key={id} className="tutorial-item tutorial-math-item" style={style}><MathFormula formula={item.formula} /><button onClick={() => setItems((current) => { const next = { ...current }; delete next[id]; return next; })} aria-label="수식 삭제">×</button></div>;
              return <div key={id} className="tutorial-item tutorial-code-item" style={style}><div><Icon name="code" size={14} />{item.filename}</div><pre>{item.code}</pre><button onClick={() => setItems((current) => { const next = { ...current }; delete next[id]; return next; })} aria-label="코드 삭제">×</button></div>;
            })}
            {composer && <form className="tutorial-editor" style={{ left: `${Math.max(38, Math.min(62, composer.x * 100))}%`, top: `${Math.max(38, Math.min(62, composer.y * 100))}%` }} onPointerDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); saveComposer(); }}><div className="tutorial-editor-heading"><span>{composer.kind === 'math' ? '수식 작성' : composer.kind === 'code' ? '코드 메모' : '텍스트 메모'}</span><button type="button" onClick={() => setComposer(null)} aria-label="닫기"><Icon name="close" size={15} /></button></div><textarea autoFocus value={composer.value} onChange={(event) => setComposer((current) => ({ ...current, value: event.target.value }))} aria-label="체험 콘텐츠" /><button className="tutorial-place-button" type="submit">캔버스에 놓기 <Icon name="arrow" size={14} /></button></form>}
            <span className="tutorial-stage-hint">{activeTool === 'select' ? '도구를 선택한 다음 클릭해보세요' : `${tools.find((tool) => tool.id === activeTool)?.label} 도구 · 캔버스를 클릭`}</span>
          </div>
          <div className="tutorial-board-footer"><span>{Object.keys(items).length}개 오브젝트</span><span><i /> 로컬 체험 · 저장되지 않음</span></div>
        </div>
      </section>
      <aside className="tutorial-footnote"><Icon name="sparkle" size={17} /><p><strong>다음은 실제 캔버스에서.</strong> 회원가입 후에는 만든 아이디어를 저장하고 팀원과 실시간으로 함께 편집할 수 있어요.</p><Link to="/login">시작하기 <Icon name="arrow" size={14} /></Link></aside>
    </main>
  </div>;
}
