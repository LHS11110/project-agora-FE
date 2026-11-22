import { Children, isValidElement, useEffect, useRef, useState } from 'react';
import './canvas-select.css';

// A native <select> inside a canvas object forces a layout and an extra paint on
// every camera frame (Chrome lays out its internals whenever an ancestor transform
// changes, even when disabled or contained; a 60-frame pan with 10 selects ran 60
// layouts). Objects therefore show a static proxy and mount the real <select>
// only while the pointer or keyboard focus is on it.

function optionLabel(children, value) {
  let found = null, first = null;
  const visit = (nodes) => Children.forEach(nodes, (node) => {
    if (found !== null || !isValidElement(node)) return;
    if (node.type === 'option') {
      const optionValue = node.props.value ?? node.props.children;
      if (first === null) first = node.props.children;
      if (String(optionValue) === String(value)) found = node.props.children;
    } else if (node.props?.children) visit(node.props.children);
  });
  visit(children);
  return found ?? first ?? '';
}

export default function CanvasSelect({ id, name, value, onChange, onBlur, disabled, className = '', children, ...rest }) {
  const [live, setLive] = useState(false);
  const select = useRef(null);
  const pending = useRef(null); // 'focus' | 'open' once the native select mounts

  useEffect(() => {
    const node = select.current;
    if (!live || !node || !pending.current) return;
    const action = pending.current;
    pending.current = null;
    node.focus({ preventScroll: true });
    if (action === 'open') { try { node.showPicker?.(); } catch { /* Needs user activation in some browsers. */ } }
  }, [live]);

  if (live && !disabled) {
    return <select
      {...rest}
      ref={select}
      id={id}
      name={name}
      className={className}
      value={value}
      onChange={onChange}
      onBlur={(event) => { onBlur?.(event); setLive(false); }}
      onPointerLeave={(event) => { rest.onPointerLeave?.(event); if (document.activeElement !== event.currentTarget) setLive(false); }}
    >{children}</select>;
  }

  return <button
    type="button"
    className={`${className} canvas-select-proxy`.trim()}
    aria-label={rest['aria-label']}
    aria-haspopup="listbox"
    title={rest.title}
    disabled={disabled}
    onPointerEnter={() => setLive(true)}
    onFocus={() => { pending.current = 'focus'; setLive(true); }}
    // Touch has no hover: the first tap swaps in the native select and opens it.
    onClick={() => { pending.current = 'open'; setLive(true); }}
  >{optionLabel(children, value)}</button>;
}
