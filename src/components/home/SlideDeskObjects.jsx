import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { useState } from 'react';
import { useObjectFeedback } from '../../motion/useObjectFeedback.js';
import { DESK_OBJECTS } from '../../home/deskObjects.js';
import '../../home/desk-objects.css';

function DeskObject({ object }) {
  useUiLocale();

  const { trackPointer } = useObjectFeedback();
  const [active, setActive] = useState(false);
  return <button type="button" className="slide-desk-object object-feedback" aria-label={ui(object.label)}
    aria-pressed={active}
    onPointerMove={trackPointer}
    onClick={() => setActive((value) => !value)}>
    <span className="desk-object-icon" aria-hidden="true">{object.icon}</span>
    <span><b>{ui(object.label)}</b><small>{ui(object.states[active ? 1 : 0])}</small></span>
  </button>;
}

export default function SlideDeskObjects({ variant }) {
  useUiLocale();
  return <div className={`slide-desk slide-desk--${variant}`} role="group" aria-label={ui("이 장면의 도구")}>
    <span className="slide-desk-hint">{ui("집어서 끌어보세요 · 놓으면 돌아와요")}</span>
    <div className="slide-desk-objects">{DESK_OBJECTS[variant].map((object) => <DeskObject key={ui(object.label)} object={object} />)}</div>
  </div>;
}
