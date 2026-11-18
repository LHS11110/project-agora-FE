import {useEffect, useId, useState} from 'react';
import {ui} from '../../i18n/locale.js';
import './timer.css';

export const initialTimer = {timerDuration: 300, timerRemaining: 300000, timerDeadline: 0};

export default function Timer({state, onChange}) {
  const id = useId();
  const {timerDuration, timerRemaining, timerDeadline} = state;
  const [now, setNow] = useState(Date.now);
  const [draft, setDraft] = useState(String(timerDuration));
  useEffect(() => setDraft(String(timerDuration)), [timerDuration]);
  useEffect(() => {
    if (!timerDeadline) return;
    let handle;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      const left = timerDeadline - current;
      if (left > 0) handle = setTimeout(tick, left % 1000 || 1000);
    };
    tick();
    return () => clearTimeout(handle);
  }, [timerDeadline]);
  const left = Math.max(0, timerDeadline ? Math.min(timerDuration * 1000, timerDeadline - now) : timerRemaining);
  const running = !!timerDeadline && left > 0;
  const seconds = Math.ceil(left / 1000);
  const duration = Number(draft);

  const toggle = () => {
    const current = Date.now();
    setNow(current);
    if (running) onChange({timerRemaining: Math.max(0, timerDeadline - current), timerDeadline: 0});
    else {
      const remaining = timerDeadline ? 0 : timerRemaining;
      onChange({timerDeadline: current + (remaining || timerDuration * 1000)});
    }
  };

  return <section className="canvas-timer"
    onPointerDown={event => {if (event.target.closest('button,input')) event.stopPropagation();}}
    onKeyDown={event => {if (event.target.closest('button,input')) event.stopPropagation();}}>
    <strong>{ui('타이머')}</strong>
    <output aria-live="off">{String(Math.floor(seconds / 60)).padStart(2,'0')}:{String(seconds % 60).padStart(2,'0')}</output>
    {seconds === 0 && <span role="status">{ui('시간 종료')}</span>}
    {onChange && <>
      <form data-object-action onSubmit={event => {
        event.preventDefault();
        if (Number.isInteger(duration) && duration >= 1 && duration <= 86400)
          onChange({timerDuration: duration, timerRemaining: duration * 1000, timerDeadline: 0});
      }}>
        <label htmlFor={id}>{ui('시간(초)')}</label>
        <input id={id} type="number" min="1" max="86400" required value={draft} onChange={event => setDraft(event.target.value)}/>
        <button type="submit">{ui('적용')}</button>
      </form>
      <div data-object-action>
        <button type="button" onClick={toggle}>{ui(running ? '일시정지' : '시작')}</button>
        <button type="button" onClick={() => onChange({timerRemaining: timerDuration * 1000, timerDeadline: 0})}>{ui('초기화')}</button>
      </div>
    </>}
  </section>;
}
