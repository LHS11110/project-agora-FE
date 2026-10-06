import { useRef, useState } from 'react';
import { DESK_OBJECTS } from '../../home/deskObjects.js';
import '../../home/desk-objects.css';

function DeskObject({ object }) {
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  return <button type="button" className="slide-desk-object" aria-label={object.label}
    aria-pressed={active} style={{ '--desk-x': `${position.x}px`, '--desk-y': `${position.y}px` }}
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      suppressClick.current = false;
      gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, position };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      const drag = gesture.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) suppressClick.current = true;
      setPosition({ x: Math.max(-12, Math.min(12, drag.position.x + dx)), y: Math.max(-8, Math.min(8, drag.position.y + dy)) });
    }}
    onPointerUp={() => { gesture.current = null; }}
    onPointerCancel={() => { gesture.current = null; suppressClick.current = true; }}
    onLostPointerCapture={() => { gesture.current = null; }}
    onClick={(event) => {
      if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; return; }
      setActive((value) => !value);
    }}>
    <span className="desk-object-icon" aria-hidden="true">{object.icon}</span>
    <span><b>{object.label}</b><small>{object.states[active ? 1 : 0]}</small></span>
  </button>;
}

export default function SlideDeskObjects({ variant }) {
  return <div className={`slide-desk slide-desk--${variant}`} role="group" aria-label="이 장면의 도구">
    <span className="slide-desk-hint">눌러보거나 살짝 끌어보세요</span>
    <div className="slide-desk-objects">{DESK_OBJECTS[variant].map((object) => <DeskObject key={object.label} object={object} />)}</div>
  </div>;
}
