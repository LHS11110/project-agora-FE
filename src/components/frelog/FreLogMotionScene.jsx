import { useObjectFeedback } from '../../motion/useObjectFeedback.js';
import { useRef, useState } from 'react';
import '../../frelog-scene.css';
import '../../scene-desk.css';

const SCENE_OBJECTS = [
  { id: 'question', className: 'scene-note scene-note--question', label: '질문 메모', detail: '한 걸음 다르게 보면?', type: 'note' },
  { id: 'formula', className: 'scene-formula', label: '생각의 수식', detail: '관점 + 연결 = 발견', type: 'formula' },
  { id: 'culture', className: 'scene-culture', label: '문화의 조각', detail: 'διαλογος · 함께 건너는 말', type: 'culture' },
  { id: 'code', className: 'scene-code', label: '공유 메모', detail: 'ideas.map(connect)', type: 'code' },
];

export default function FreLogMotionScene({ compact = false, variant = 'home' }) {
  const { trackPointer, playFeedback } = useObjectFeedback();
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const [positions, setPositions] = useState({});
  const [focusedObject, setFocusedObject] = useState(null);
  const [connectionsOn, setConnectionsOn] = useState(true);

  const moveObject = (id, event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id || !rootRef.current) return;
    const bounds = rootRef.current.getBoundingClientRect();
    setPositions((current) => ({
      ...current,
      [id]: {
        x: Math.max(-bounds.width * 0.12, Math.min(bounds.width * 0.12, drag.x + event.clientX - drag.pointerX)),
        y: Math.max(-bounds.height * 0.12, Math.min(bounds.height * 0.12, drag.y + event.clientY - drag.pointerY)),
      },
    }));
  };

  const beginDrag = (id, event) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: positions[id]?.x || 0,
      y: positions[id]?.y || 0,
    };
  };

  const nudgeObject = (id, event) => {
    const direction = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[event.key];
    if (!direction) return;
    event.preventDefault();
    setPositions((current) => ({
      ...current,
      [id]: { x: (current[id]?.x || 0) + direction[0], y: (current[id]?.y || 0) + direction[1] },
    }));
  };

  const sceneClass = `frelog-scene frelog-scene--${variant}${compact ? ' frelog-scene--compact' : ''}`;

  return <section ref={rootRef} className={sceneClass} aria-label="움직이고 연결할 수 있는 FreLog 협업 캔버스">
    <div className="scene-grain" aria-hidden="true" />
    <div className="scene-toolbar">
      <span className="scene-brand"><i>F</i> FreLog <small>OPEN CANVAS</small></span>
      <span className="scene-presence"><i /> 4명 함께 보는 중</span>
    </div>
    <svg className={`scene-connections${connectionsOn ? '' : ' scene-connections--quiet'}`} viewBox="0 0 700 430" preserveAspectRatio="none" aria-hidden="true">
      <path d="M150 132 C248 82 292 125 356 190 S473 278 571 219" />
      <path d="M188 327 C248 290 296 245 356 190 S467 112 557 142" />
      <circle cx="356" cy="190" r="4" /><circle cx="150" cy="132" r="3" /><circle cx="571" cy="219" r="3" />
    </svg>


    {SCENE_OBJECTS.map((object) => {
      const position = positions[object.id] || { x: 0, y: 0 };
      const style = { '--drag-x': `${position.x}px`, '--drag-y': `${position.y}px` };
      return <button
        key={object.id}
        type="button"
        className={`scene-object object-feedback ${object.className}${focusedObject === object.id ? ' is-focused' : ''}`}
        style={style}
        aria-label={`${object.label}. 방향키로 움직이고 선택해 강조하세요.`}
        aria-pressed={focusedObject === object.id}
        data-feedback-motion={{ note: 'lift', formula: 'stamp', culture: 'sway', code: 'glide' }[object.type]}
        onPointerDown={(event) => beginDrag(object.id, event)}
        onPointerMove={(event) => { trackPointer(event); moveObject(object.id, event); }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
        onKeyDown={(event) => nudgeObject(object.id, event)}
        onClick={(event) => { setFocusedObject(object.id); playFeedback(event); }}
      >
        <span data-feedback-pulse aria-hidden="true" />
        {object.type === 'note' && <><span className="scene-object-index">A QUESTION</span><strong>{object.detail}</strong><small>민지 · 방금 전</small></>}
        {object.type === 'formula' && <><span className="scene-object-index">A SMALL EQUATION</span><strong><b>관점</b><i>+</i>연결 <em>=</em> 발견</strong><small>생각이 이어지는 방식</small></>}
        {object.type === 'culture' && <><span className="scene-object-index">CULTURE / 02</span><strong>{object.detail}</strong><small>서로 다른 언어, 하나의 자리</small></>}
        {object.type === 'code' && <><span className="scene-code-dots"><i /><i /><i /></span><strong><em>ideas</em>.map(connect)</strong><small>한 줄씩 함께 편집 중 <i className="scene-caret" /></small></>}
      </button>;
    })}

    <button className="scene-connect-toggle" type="button" onClick={() => setConnectionsOn((value) => !value)} aria-pressed={connectionsOn}>
      <i className={connectionsOn ? 'is-on' : ''} /> {connectionsOn ? '연결 보기' : '연결 숨김'}
    </button>
    <div className="scene-caption"><span>OUR SHARED DESK</span><b>질문을 옮기고 · 연결을 눌러보세요</b></div>
  </section>;
}
