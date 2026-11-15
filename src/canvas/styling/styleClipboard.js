// Portable Figma-style copy/paste bundle (`Alt + Ctrl + C` / `Alt + Ctrl + V`).

import { readObjectStyle, writeObjectStylePatch } from './objectStyleModel.js';
import { itemCapabilities } from './selectionIntersection.js';

const STYLE_CLIPBOARD_KEY = 'agora_copied_style_v1';

export function extractStyleBundle(item) {
  if (!item || typeof item !== 'object') return null;
  const style = readObjectStyle(item);
  return {
    version: 1,
    sourceKind: item.kind,
    cornerRadius: style.cornerRadius,
    opacity: style.opacity,
    blendMode: style.blendMode,
    explicitFills: style.explicitFills || style.fills.length > 0,
    fills: style.fills,
    stroke: style.stroke,
    explicitEffects: style.explicitEffects || style.effects.length > 0,
    effects: style.effects,
    typography: style.typography,
    fontSize: item.fontSize,
    filters: style.filters,
    customCss: style.customCss,
    visualStyle: item.visualStyle,
    nativeColor: item.color,
    nativeFill: item.fill,
    nativeFillOpacity: item.fillOpacity,
  };
}

export function applyStyleBundlePatch(targetItem, bundle) {
  if (!targetItem || !bundle) return null;
  const caps = itemCapabilities(targetItem);

  const patch = writeObjectStylePatch(targetItem, (current) => {
    const next = { ...current };
    if (caps.opacity && bundle.opacity != null) next.opacity = bundle.opacity;
    if (caps.blendMode && bundle.blendMode) next.blendMode = bundle.blendMode;
    if (caps.cornerRadius && bundle.cornerRadius?.explicit) {
      next.cornerRadius = { ...bundle.cornerRadius, explicit: true };
    }
    if (caps.fill && Array.isArray(bundle.fills)) {
      next.fills = bundle.fills;
      next.explicitFills = true;
    }
    if (caps.stroke && bundle.stroke) {
      next.stroke = { ...current.stroke, ...bundle.stroke, explicit: true };
    }
    if (caps.effects && Array.isArray(bundle.effects)) {
      next.effects = bundle.effects;
      next.explicitEffects = true;
    }
    if (caps.typography && bundle.typography?.explicit) {
      next.typography = { ...current.typography, ...bundle.typography, explicit: true };
    }
    if (caps.filters && bundle.filters) next.filters = bundle.filters;
    if (caps.customCss && bundle.customCss != null) next.customCss = bundle.customCss;
    return next;
  });

  if (!patch) return null;

  if (caps.typography && Number.isFinite(Number(bundle.fontSize)) && Number(bundle.fontSize) > 0) {
    patch.fontSize = Number(bundle.fontSize);
  }
  if (targetItem.kind === 'shape' && ['standard', 'sketch'].includes(bundle.visualStyle)) {
    patch.visualStyle = bundle.visualStyle;
  }
  if (caps.fill && targetItem.kind === 'note' && bundle.fills?.[0]?.type === 'solid') {
    patch.color = bundle.fills[0].color;
  } else if (targetItem.kind === 'text' && bundle.typography?.textColor) {
    patch.color = bundle.typography.textColor;
  }
  return patch;
}

export function saveCopiedStyle(bundle, storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : null) {
  try {
    if (!bundle) return false;
    storage?.setItem(STYLE_CLIPBOARD_KEY, JSON.stringify(bundle));
    return true;
  } catch {
    return false;
  }
}

export function loadCopiedStyle(storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : null) {
  try {
    const raw = storage?.getItem(STYLE_CLIPBOARD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}
