import Icon from '../../components/Icon.jsx';
import { useEffect, useRef, useId } from 'react';
import './resizable-panels.css';

const labels = { tools: '툴 패널', inspector: '설정 패널', chat: '채팅 패널' };
export default function ResizablePanel({ children, panel, mobile, value, limits, onChange, onFinish, onReset, collapsed, onToggle }) {
  const contentId = useId();
  const gesture = useRef(null), frame = useRef(0), latest = useRef(null);
  latest.current = { onChange, onFinish, value, mobile };
  const vertical = !mobile && panel !== 'chat';
  const direction = mobile || panel === 'tools' ? 1 : -1;
  const clear = () => { cancelAnimationFrame(frame.current); frame.current = 0; delete document.documentElement.dataset.panelResizing; };
  useEffect(() => () => { clear(); gesture.current = null; }, []);
  const update = (event, drag) => {
    const coordinate = drag.vertical ? event.clientX : event.clientY;
    drag.next = drag.value + (coordinate - drag.start) * drag.direction;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => { frame.current = 0; latest.current.onChange(drag.next); });
  };
  const finish = (event, cancel = false) => {
    const drag = gesture.current;
    if (!drag || (event.pointerId != null && drag.pointerId !== event.pointerId)) return;
    gesture.current = null; clear();
    if (drag.mobile === latest.current.mobile) latest.current.onChange(cancel ? drag.value : drag.next);
    latest.current.onFinish();
    if (drag.element.hasPointerCapture?.(drag.pointerId)) drag.element.releasePointerCapture(drag.pointerId);
  };
  const cancelDrag = useRef(null);
  cancelDrag.current = () => finish({}, true);
  useEffect(() => {
    const blur = () => cancelDrag.current();
    window.addEventListener('blur', blur);
    return () => window.removeEventListener('blur', blur);
  }, []);
  useEffect(() => { cancelDrag.current(); }, [mobile, collapsed]);
  return <div className={`canvas-panel-slot canvas-panel-slot-${panel}${collapsed ? ' is-collapsed' : ''}`}>
    <button className="canvas-panel-toggle" type="button" onClick={onToggle}
      aria-expanded={!collapsed} aria-controls={contentId} aria-label={`${labels[panel]} ${collapsed ? '펼치기' : '접기'}`}
      title={`${labels[panel]} ${collapsed ? '펼치기' : '접기'}`}>
      <Icon name={panel === 'chat' ? 'chat' : panel === 'tools' ? 'grid' : 'settings'} size={14} />
      <span>{labels[panel]}</span><span className="canvas-panel-toggle-mark" aria-hidden="true">{collapsed ? '+' : '−'}</span>
    </button>
    <div id={contentId} className="canvas-panel-content" hidden={collapsed}>{children}</div>
    {!collapsed && <div className={`canvas-panel-resize canvas-panel-resize-${panel}`} role="separator" tabIndex={0}
      aria-label={`${labels[panel]} ${vertical ? '너비' : '높이'} 조절`} aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-valuemin={Math.round(limits.min)} aria-valuemax={Math.round(limits.max)} aria-valuenow={Math.round(value)} aria-valuetext={`${Math.round(value)} 픽셀`}
      title="드래그해 크기 조절 · 두 번 클릭하면 기본 크기"
      onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); onReset(); }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current = { element: event.currentTarget, pointerId: event.pointerId, vertical, direction, mobile, start: vertical ? event.clientX : event.clientY, value, next: value };
        document.documentElement.dataset.panelResizing = vertical ? 'horizontal' : 'vertical';
      }}
      onPointerMove={event => { const drag = gesture.current; if (drag?.pointerId === event.pointerId) { event.preventDefault(); event.stopPropagation(); update(event, drag); } }}
      onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}
      onKeyDown={event => {
        if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); finish(event, true); return; }
        const step = event.shiftKey ? 50 : 10;
        const keys = vertical ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
        if (!keys.includes(event.key) && !['Home', 'End'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        onChange(event.key === 'Home' ? limits.min : event.key === 'End' ? limits.max : value + (event.key === keys[1] ? step : -step) * direction);
        onFinish();
      }}><span /></div>}
  </div>;
}
