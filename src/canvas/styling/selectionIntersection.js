// Multi-selection capability intersection & selection color extractor/batch-replacer.

import { readObjectStyle, writeObjectStylePatch, normalizeHex6, isHexColor } from './objectStyleModel.js';
import { supportsAnyCorners } from '../objectCorners.js';
import { supportsObjectFontSize } from '../objectSize.js';

const FILL_KINDS = new Set([
  'shape', 'text', 'note', 'frame', 'code', 'math', 'table', 'chart', 'link', 'value', 'question', 'project', 'user-group',
]);

const STROKE_KINDS = new Set([
  'shape', 'connector', 'frame', 'text', 'note', 'image', 'table', 'chart', 'link', 'code', 'value', 'question', 'project', 'stroke',
]);

const TYPO_KINDS = new Set([
  'text', 'note', 'code', 'math', 'table', 'value', 'question', 'connector', 'shape', 'chart', 'project',
]);

export function itemCapabilities(item) {
  if (!item || item.kind === 'host-tombstone') return {};
  return {
    opacity: true,
    blendMode: item.kind !== 'stroke',
    depth: true,
    cornerRadius: Boolean(supportsAnyCorners(item) || item.kind === 'note'),
    autoLayout: !['connector', 'stroke'].includes(item.kind),
    fill: FILL_KINDS.has(item.kind) && item.shapeType !== 'arrow',
    stroke: STROKE_KINDS.has(item.kind),
    effects: item.kind !== 'stroke',
    filters: !['stroke'].includes(item.kind),
    customCss: !['stroke', 'connector'].includes(item.kind),
    typography: TYPO_KINDS.has(item.kind) || Boolean(supportsObjectFontSize(item)),
    connector: item.kind === 'connector',
  };
}

export function analyzeSelectionIntersection(items = {}, ids = []) {
  const selectedEntries = ids
    .map((id) => [String(id), items[String(id)]])
    .filter(([, item]) => Boolean(item) && item.kind !== 'host-tombstone');

  if (!selectedEntries.length) {
    return { count: 0, capabilities: {}, mixed: {}, styles: [] };
  }

  const capList = selectedEntries.map(([, item]) => itemCapabilities(item));
  const capabilities = Object.keys(capList[0]).reduce((acc, key) => {
    acc[key] = capList.every((cap) => Boolean(cap[key]));
    return acc;
  }, {});

  const styles = selectedEntries.map(([id, item]) => ({ id, item, style: readObjectStyle(item) }));
  const uniqueOpacities = new Set(styles.map((s) => Math.round((s.style.opacity ?? 1) * 100)));
  const uniqueColors = new Set(styles.map((s) => normalizeHex6(s.style.stroke.color, '')));
  const uniqueCorner = new Set(styles.map((s) => `${s.style.cornerRadius.tl},${s.style.cornerRadius.tr},${s.style.cornerRadius.br},${s.style.cornerRadius.bl}`));
  const uniqueBlend = new Set(styles.map((s) => s.style.blendMode));

  return {
    count: selectedEntries.length,
    isMulti: selectedEntries.length > 1,
    kinds: [...new Set(selectedEntries.map(([, item]) => item.kind))],
    capabilities,
    primary: styles[0],
    styles,
    mixed: {
      opacity: uniqueOpacities.size > 1,
      strokeColor: uniqueColors.size > 1,
      cornerRadius: uniqueCorner.size > 1,
      blendMode: uniqueBlend.size > 1,
    },
  };
}

export function extractSelectionColors(items = {}, ids = []) {
  const counts = new Map();
  const touch = (rawColor) => {
    if (!isHexColor(rawColor)) return;
    const hex = normalizeHex6(rawColor);
    counts.set(hex, (counts.get(hex) || 0) + 1);
  };

  for (const id of ids) {
    const item = items[String(id)];
    if (!item) continue;
    const style = readObjectStyle(item);
    touch(item.fill);
    touch(item.color);
    for (const layer of style.fills) {
      if (layer.type === 'solid') touch(layer.color);
      for (const stop of layer.stops || []) touch(stop.color);
    }
    if (style.stroke?.color) touch(style.stroke.color);
    if (style.typography?.textColor) touch(style.typography.textColor);
    for (const fx of style.effects) touch(fx.color);
    if (style.connector?.labelStyle?.background) touch(style.connector.labelStyle.background);
    if (style.connector?.labelStyle?.color) touch(style.connector.labelStyle.color);
    if (style.connector?.labelStyle?.borderColor) touch(style.connector.labelStyle.borderColor);
  }

  return [...counts.entries()]
    .map(([color, count]) => ({ color, count }))
    .sort((a, b) => b.count - a.count);
}

export function replaceSelectionColorPatch(item, fromColor, toColor) {
  if (!item || !isHexColor(fromColor) || !isHexColor(toColor)) return null;
  const fromHex = normalizeHex6(fromColor);
  const toHex = normalizeHex6(toColor);
  if (fromHex === toHex) return null;

  let changed = false;
  const stylePatch = writeObjectStylePatch(item, (current) => {
    const next = { ...current };
    const nextFills = current.fills.map((layer) => {
      if (layer.type === 'solid' && normalizeHex6(layer.color, '') === fromHex) {
        changed = true;
        return { ...layer, color: toHex };
      }
      if (Array.isArray(layer.stops) && layer.stops.some((s) => normalizeHex6(s.color, '') === fromHex)) {
        changed = true;
        return {
          ...layer,
          stops: layer.stops.map((s) => (normalizeHex6(s.color, '') === fromHex ? { ...s, color: toHex } : s)),
        };
      }
      return layer;
    });
    if (nextFills !== current.fills && changed) {
      next.fills = nextFills;
      if (current.explicitFills || nextFills.some((l) => l.type !== 'solid')) next.explicitFills = true;
    }

    if (normalizeHex6(current.stroke?.color, '') === fromHex) {
      changed = true;
      next.stroke = { ...current.stroke, explicit: current.stroke.explicit, color: toHex };
    }

    if (normalizeHex6(current.typography?.textColor, '') === fromHex) {
      changed = true;
      next.typography = { ...current.typography, explicit: true, textColor: toHex };
    }

    const nextEffects = current.effects.map((fx) => {
      if (normalizeHex6(fx.color, '') === fromHex) {
        changed = true;
        return { ...fx, color: toHex };
      }
      return fx;
    });
    if (changed && current.explicitEffects) next.effects = nextEffects;

    if (next.connector?.labelStyle) {
      const ls = { ...next.connector.labelStyle };
      let labelChanged = false;
      for (const k of ['background', 'color', 'borderColor']) {
        if (normalizeHex6(ls[k], '') === fromHex) {
          ls[k] = toHex;
          labelChanged = true;
          changed = true;
        }
      }
      if (labelChanged) next.connector = { ...next.connector, labelStyle: ls };
    }

    return changed ? next : current;
  });

  const direct = {};
  if (normalizeHex6(item.fill, '') === fromHex) {
    direct.fill = toHex;
    changed = true;
  }
  if (normalizeHex6(item.color, '') === fromHex) {
    direct.color = toHex;
    changed = true;
  }
  return changed ? { ...(stylePatch || {}), ...direct } : null;
}
