export const PANEL_VISIBILITY_KEY = 'frelog_canvas_panel_visibility_v1';
export const COLLAPSED_PANEL_SIZE = 32;
export function readPanelVisibility() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(PANEL_VISIBILITY_KEY)); } catch { saved = null; }
  return Object.fromEntries(['tools', 'inspector', 'chat'].map(key => [key, saved?.[key] === true]));
}
export const PANEL_LAYOUT_KEY = 'frelog_canvas_panel_sizes_v1';
export const PANEL_DEFAULTS = { desktop: { tools: 112, inspector: 292, chat: 205 }, mobile: { tools: 88, inspector: 420, chat: 210 } };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function readPanelSizes() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(PANEL_LAYOUT_KEY)); } catch { saved = null; }
  return Object.fromEntries(Object.entries(PANEL_DEFAULTS).map(([mode, defaults]) => [mode, Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, Number.isFinite(saved?.[mode]?.[key]) ? clamp(saved[mode][key], 60, 900) : value]))]));
}
export function panelLimits(mode, key, bounds, sizes) {
  if (mode === 'mobile') return { min: key === 'tools' ? 72 : 150, max: key === 'tools' ? 320 : Math.max(300, Math.min(800, window.innerHeight * .8)) };
  if (key === 'tools') return { min: 104, max: Math.max(104, Math.min(320, bounds.width - sizes.inspector - 240)) };
  if (key === 'inspector') return { min: 220, max: Math.max(220, Math.min(600, bounds.width - sizes.tools - 240)) };
  const min = Math.min(140, bounds.height * .3);
  return { min, max: Math.max(min, Math.min(600, bounds.height - Math.min(220, bounds.height * .55))) };
}
export function fitPanelSizes(raw, mode, bounds, collapsed = {}) {
  if (mode === 'mobile') return Object.fromEntries(Object.entries(raw).map(([key, value]) => {
    if (collapsed[key]) return [key, COLLAPSED_PANEL_SIZE];
    const limits = panelLimits(mode, key, bounds, raw); return [key, clamp(value, limits.min, limits.max)];
  }));
  const tools = collapsed.tools ? COLLAPSED_PANEL_SIZE : clamp(raw.tools, 104, Math.max(104, Math.min(320, bounds.width - (collapsed.inspector ? COLLAPSED_PANEL_SIZE : 220) - 240)));
  const inspector = collapsed.inspector ? COLLAPSED_PANEL_SIZE : clamp(raw.inspector, 220, Math.max(220, Math.min(600, bounds.width - tools - 240)));
  const limits = panelLimits(mode, 'chat', bounds, { tools, inspector });
  return { tools, inspector, chat: collapsed.chat ? COLLAPSED_PANEL_SIZE : clamp(raw.chat, limits.min, limits.max) };
}
