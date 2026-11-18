import { useEffect, useId, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { ui } from '../i18n/locale.js';

export const initialTimer = { timerDuration: 300, timerRemaining: 300000, timerDeadline: 0 };
const PRESET_MINUTES = [1, 3, 5, 10, 15, 30];

export default function Timer({ state, onChange }) {
  const id = useId();
  const { timerDuration, timerRemaining, timerDeadline } = state;
  const [now, setNow] = useState(Date.now);
  const [draft, setDraft] = useState(String(timerDuration));

  useEffect(() => {
    setDraft(String(timerDuration));
  }, [timerDuration]);

  useEffect(() => {
    if (!timerDeadline) return undefined;
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

  const totalMs = Math.max(1000, (Number(timerDuration) || 1) * 1000);
  const left = Math.max(0, timerDeadline ? Math.min(totalMs, timerDeadline - now) : timerRemaining);
  const running = !!timerDeadline && left > 0;
  const paused = !running && !timerDeadline && left > 0 && left < totalMs;
  const seconds = Math.ceil(left / 1000);
  const duration = Number(draft);
  const progress = Math.max(0, Math.min(1, left / totalMs));
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const displayTime = hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const statusKey = seconds === 0 ? '시간 종료' : running ? '실행 중' : paused ? '일시정지됨' : '대기';
  const statusClass = seconds === 0 ? 'expired' : running ? 'running' : paused ? 'paused' : 'ready';

  const toggle = () => {
    const current = Date.now();
    setNow(current);
    if (running) {
      onChange({ timerRemaining: Math.max(0, timerDeadline - current), timerDeadline: 0 });
    } else {
      const remaining = timerDeadline ? 0 : timerRemaining;
      onChange({ timerDeadline: current + (remaining || timerDuration * 1000) });
    }
  };

  return (
    <section
      className={`canvas-timer ${statusClass}`}
      onPointerDown={(event) => {
        if (event.target.closest('button,input')) event.stopPropagation();
      }}
      onKeyDown={(event) => {
        if (event.target.closest('button,input')) event.stopPropagation();
      }}
    >
      <div className="canvas-timer-head">
        <strong>
          <Icon name="timer" size={14} />
          <span>{ui('타이머')}</span>
        </strong>
        <span className={`canvas-timer-badge ${statusClass}`} role={seconds === 0 ? 'status' : undefined}>
          {ui(statusKey)}
        </span>
      </div>

      <output className="canvas-timer-readout" aria-live="off">
        {displayTime}
      </output>

      <div className="canvas-timer-track" aria-hidden="true">
        <i style={{ transform: `scaleX(${progress.toFixed(4)})` }} />
      </div>

      {onChange && (
        <>
          <div className="canvas-timer-actions" data-object-action>
            <button type="button" className="canvas-timer-primary" onClick={toggle}>
              {ui(running ? '일시정지' : '시작')}
            </button>
            <button
              type="button"
              className="canvas-timer-secondary"
              onClick={() => onChange({ timerRemaining: timerDuration * 1000, timerDeadline: 0 })}
            >
              {ui('초기화')}
            </button>
          </div>

          <div className="canvas-timer-presets" role="group" aria-label={ui('빠른 시간 선택')} data-object-action>
            {PRESET_MINUTES.map((minutes) => {
              const targetSeconds = minutes * 60;
              const active = timerDuration === targetSeconds;
              return (
                <button
                  key={minutes}
                  type="button"
                  className={active ? 'active' : ''}
                  aria-pressed={active}
                  onClick={() =>
                    onChange({ timerDuration: targetSeconds, timerRemaining: targetSeconds * 1000, timerDeadline: 0 })
                  }
                >
                  {ui('{v0}분', { v0: minutes })}
                </button>
              );
            })}
          </div>

          <form
            className="canvas-timer-form"
            data-object-action
            onSubmit={(event) => {
              event.preventDefault();
              if (Number.isInteger(duration) && duration >= 1 && duration <= 86400) {
                onChange({ timerDuration: duration, timerRemaining: duration * 1000, timerDeadline: 0 });
              }
            }}
          >
            <label htmlFor={id}>{ui('시간(초)')}</label>
            <div className="canvas-timer-input-row">
              <input
                id={id}
                name="timer-duration"
                type="number"
                min="1"
                max="86400"
                required
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button type="submit">{ui('적용')}</button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
