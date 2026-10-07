import { useState } from 'react';
import { useObjectFeedback } from '../../motion/useObjectFeedback.js';
import { DESK_OBJECTS } from '../../home/deskObjects.js';
import '../../home/desk-objects.css';

function DeskObject({ object }) {
  const { trackPointer, playFeedback } = useObjectFeedback();
  const [active, setActive] = useState(false);
  return <button type="button" className="slide-desk-object object-feedback" aria-label={object.label}
    aria-pressed={active} data-feedback-motion={object.motion}
    onPointerMove={trackPointer}
    onClick={(event) => {
      playFeedback(event);
      setActive((value) => !value);
    }}>
    <span data-feedback-pulse aria-hidden="true" />
    <span className="desk-object-icon" aria-hidden="true">{object.icon}</span>
    <span><b>{object.label}</b><small key={String(active)}>{object.states[active ? 1 : 0]}</small></span>
  </button>;
}

export default function SlideDeskObjects({ variant }) {
  return <div className={`slide-desk slide-desk--${variant}`} role="group" aria-label="이 장면의 도구">
    <span className="slide-desk-hint">집어서 끌어보세요 · 놓으면 돌아와요</span>
    <div className="slide-desk-objects">{DESK_OBJECTS[variant].map((object) => <DeskObject key={object.label} object={object} />)}</div>
  </div>;
}
