import { useEffect, useRef, useState } from 'react';
import { fitPanelSizes, PANEL_DEFAULTS, PANEL_LAYOUT_KEY, panelLimits, readPanelSizes, readPanelVisibility, PANEL_VISIBILITY_KEY } from './panelLayout.js';

export function usePanelLayout() {
  const [node, setNode] = useState(null), [raw, setRaw] = useState(readPanelSizes);
  const [collapsed, setCollapsed] = useState(readPanelVisibility);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width:650px)').matches);
  const [bounds, setBounds] = useState({ width: window.innerWidth, height: Math.max(360, window.innerHeight - 91) });
  const mode = mobile ? 'mobile' : 'desktop';
  const sizes = fitPanelSizes(raw[mode], mode, bounds, collapsed);
  const latest = useRef(null); latest.current = { raw, mode, sizes, bounds, collapsed };
  useEffect(() => {
    const media = window.matchMedia('(max-width:650px)');
    const change = () => setMobile(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!node) return undefined;
    const measure = () => setBounds(current => {
      const next = { width: node.clientWidth, height: node.clientHeight };
      return current.width === next.width && current.height === next.height ? current : next;
    });
    measure();
    const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  const persist = () => { try { localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(latest.current.raw)); } catch {} };
  const change = (key, value) => {
    const c = latest.current, limits = panelLimits(c.mode, key, c.bounds, c.sizes);
    const next = { ...c.raw, [c.mode]: { ...c.raw[c.mode], ...Object.fromEntries(Object.entries(c.sizes).filter(([panel]) => !c.collapsed[panel])), [key]: Math.round(Math.max(limits.min, Math.min(limits.max, value))) } };
    latest.current = { ...c, raw: next, sizes: fitPanelSizes(next[c.mode], c.mode, c.bounds, c.collapsed) };
    setRaw(next);
  };
  const toggle = key => {
    const next = { ...latest.current.collapsed, [key]: !latest.current.collapsed[key] };
    latest.current.collapsed = next;
    setCollapsed(next);
    try { localStorage.setItem(PANEL_VISIBILITY_KEY, JSON.stringify(next)); } catch {}
  };
  const reset = key => { change(key, PANEL_DEFAULTS[latest.current.mode][key]); persist(); };
  return {
    ref: setNode, mobile,
    style: { '--tools-width': `${sizes.tools}px`, '--inspector-width': `${sizes.inspector}px`, '--chat-height': `${sizes.chat}px`, '--tools-height': `${sizes.tools}px`, '--inspector-height': `${sizes.inspector}px` },
    handle: key => ({ panel: key, collapsed: collapsed[key], onToggle: () => toggle(key), mobile, value: sizes[key], limits: panelLimits(mode, key, bounds, sizes), onChange: value => change(key, value), onFinish: persist, onReset: () => reset(key) }),
  };
}
