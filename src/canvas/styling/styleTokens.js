// Reusable Style Tokens (color, typography, effect, complete style variables)
// persisted per canvas with global starter tokens and batch token syncing.

import { readObjectStyle, writeObjectStylePatch, normalizeHex6 } from './objectStyleModel.js';

const storageKey = (canvasId) => `agora_style_tokens_${canvasId || 'global'}`;

export const DEFAULT_STYLE_TOKENS = [
  {
    id: 'tok-brand-primary',
    name: 'Brand Accent Card',
    category: 'complete',
    swatch: '#4f46e5',
    payload: {
      cornerRadius: { linked: true, tl: 16, tr: 16, br: 16, bl: 16, explicit: true },
      fills: [{ id: 't1', visible: true, type: 'linear', angle: 135, stops: [{ color: '#4f46e5', pos: 0 }, { color: '#7c3aed', pos: 100 }], opacity: 1, blendMode: 'normal' }],
      stroke: { explicit: true, enabled: true, color: '#a5b4fc', width: 1.5, align: 'inside', dashPattern: 'solid', dash: 8, gap: 6, cap: 'round', join: 'round', sides: { linked: true, top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 } },
      effects: [{ id: 'te1', enabled: true, type: 'drop-shadow', color: '#4338ca', opacity: 0.28, x: 0, y: 8, blur: 18, spread: 0 }],
      typography: { explicit: true, textColor: '#ffffff', fontWeight: 600 },
    },
  },
  {
    id: 'tok-sage-surface',
    name: 'Soft Sage Surface',
    category: 'color',
    swatch: '#d8e8dc',
    payload: {
      fills: [{ id: 't2', visible: true, type: 'solid', color: '#eaf3ec', opacity: 1, blendMode: 'normal' }],
      stroke: { explicit: true, enabled: true, color: '#7ea289', width: 1.5, align: 'inside', dashPattern: 'solid', dash: 8, gap: 6, cap: 'round', join: 'round', sides: { linked: true, top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 } },
    },
  },
  {
    id: 'tok-display-heading',
    name: 'Editorial Display',
    category: 'typography',
    swatch: '#1f2937',
    payload: {
      typography: {
        explicit: true,
        fontFamily: "'Noto Serif KR', Georgia, 'Times New Roman', serif",
        fontWeight: 700,
        lineHeight: 1.35,
        letterSpacing: -0.5,
        paragraphSpacing: 8,
        textColor: '#111827',
      },
    },
  },
  {
    id: 'tok-soft-float',
    name: 'Floating Elevation',
    category: 'effect',
    swatch: '#18222b',
    payload: {
      effects: [
        { id: 't-fx-1', enabled: true, type: 'drop-shadow', color: '#0f172a', opacity: 0.14, x: 0, y: 12, blur: 24, spread: 0 },
        { id: 't-fx-2', enabled: true, type: 'drop-shadow', color: '#0f172a', opacity: 0.06, x: 0, y: 2, blur: 6, spread: 0 },
      ],
    },
  },
];

export function loadStyleTokens(canvasId, storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : null) {
  try {
    const raw = storage?.getItem(storageKey(canvasId));
    if (!raw) return [...DEFAULT_STYLE_TOKENS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return [...DEFAULT_STYLE_TOKENS];
    return parsed.filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string' && t.payload);
  } catch {
    return [...DEFAULT_STYLE_TOKENS];
  }
}

export function persistStyleTokens(canvasId, tokens, storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : null) {
  try {
    storage?.setItem(storageKey(canvasId), JSON.stringify(tokens.slice(0, 40)));
    return true;
  } catch {
    return false;
  }
}

export function createTokenFromItem(item, name, category = 'complete') {
  const style = readObjectStyle(item);
  const label = String(name || '').trim() || '커스텀 스타일';
  const swatch = normalizeHex6(
    style.fills?.[0]?.type === 'solid' ? style.fills[0].color : style.fills?.[0]?.stops?.[0]?.color || style.stroke?.color || item.color || '#617d68'
  );
  const payload = {};
  if (category === 'color' || category === 'complete') {
    payload.fills = style.fills;
    payload.stroke = style.stroke;
  }
  if (category === 'effect' || category === 'complete') {
    payload.effects = style.effects;
    payload.filters = style.filters;
  }
  if (category === 'typography' || category === 'complete') {
    payload.typography = { ...style.typography, explicit: true };
  }
  if (category === 'complete') {
    payload.cornerRadius = style.cornerRadius;
    payload.opacity = style.opacity;
    payload.blendMode = style.blendMode;
  }
  return {
    id: `tok-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: label.slice(0, 48),
    category,
    swatch,
    payload,
  };
}

export function applyTokenToItem(item, token) {
  if (!item || !token?.payload) return null;
  const p = token.payload;
  return writeObjectStylePatch(item, (current) => ({
    ...current,
    ...(p.cornerRadius ? { cornerRadius: { ...p.cornerRadius, explicit: true } } : {}),
    ...(p.opacity != null ? { opacity: p.opacity } : {}),
    ...(p.blendMode ? { blendMode: p.blendMode } : {}),
    ...(p.fills ? { explicitFills: true, fills: p.fills } : {}),
    ...(p.stroke ? { stroke: { ...current.stroke, ...p.stroke, explicit: true } } : {}),
    ...(p.effects ? { explicitEffects: true, effects: p.effects } : {}),
    ...(p.filters ? { filters: p.filters } : {}),
    ...(p.typography ? { typography: { ...current.typography, ...p.typography, explicit: true } } : {}),
    tokenIds: [token.id, ...(current.tokenIds || []).filter((id) => id !== token.id)].slice(0, 8),
  }));
}
