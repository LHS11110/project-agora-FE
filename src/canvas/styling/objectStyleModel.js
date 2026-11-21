// Schema, parsing, persistence, and CSS synthesis for Figma-grade canvas styling.
// Extended metadata lives in BE-whitelisted string fields (`brush` on non-strokes,
// `format` on strokes) using the `style1:` JSON envelope alongside native fields.

export const STYLE_PREFIX = 'style1:';

export const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken',
  'lighten', 'color-dodge', 'color-burn', 'soft-light',
  'hard-light', 'difference',
];

export const FONT_FAMILIES = [
  { value: '', label: '기본 고딕 (Pretendard)' },
  { value: "'Noto Serif KR', Georgia, 'Times New Roman', serif", label: '세리프 (명조)' },
  { value: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace", label: '모노스페이스 (코드)' },
  { value: "'Inter', 'Pretendard', system-ui, sans-serif", label: '모던 산세리프 (Inter)' },
  { value: "'Georgia', 'Times New Roman', serif", label: '에디토리얼 (Georgia)' },
  { value: "cursive, 'Nanum Pen Script', sans-serif", label: '손글씨 스타일' },
];

export const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800, 900];

export const DEFAULT_FILTERS = Object.freeze({
  brightness: 100,
  contrast: 100,
  saturate: 100,
  grayscale: 0,
  sepia: 0,
  hueRotate: 0,
  invert: 0,
});

const clamp = (value, min, max, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(min, Math.min(max, num)) : fallback;
};

export const isHexColor = (value) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(value || '').trim());

export function normalizeHex6(value, fallback = '#617d68') {
  const raw = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  if (/^#[0-9a-f]{8}$/i.test(raw)) return raw.slice(0, 7).toLowerCase();
  return fallback;
}

export function hexToRgba(hex, alpha = 1) {
  const clean = normalizeHex6(hex, '#18222b');
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  const a = clamp(alpha, 0, 1, 1);
  return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
}

const ENVELOPE_CACHE_LIMIT = 512;
const ENVELOPE_CACHE = new Map();
const OBJECT_STYLE_CACHE = new WeakMap();

export function styleEnvelopeField(item) {
  return item?.kind === 'stroke' ? 'format' : 'brush';
}

export function parseRawStyleEnvelope(item) {
  if (!item || typeof item !== 'object') return {};
  const field = styleEnvelopeField(item);
  const raw = item[field];
  if (typeof raw !== 'string' || !raw.startsWith(STYLE_PREFIX)) return {};
  const cached = ENVELOPE_CACHE.get(raw);
  if (cached !== undefined) return cached;
  let parsedObj = {};
  try {
    const parsed = JSON.parse(raw.slice(STYLE_PREFIX.length));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) parsedObj = parsed;
  } catch {
    parsedObj = {};
  }
  if (ENVELOPE_CACHE.size >= ENVELOPE_CACHE_LIMIT) {
    ENVELOPE_CACHE.delete(ENVELOPE_CACHE.keys().next().value);
  }
  ENVELOPE_CACHE.set(raw, parsedObj);
  return parsedObj;
}

export function normalizeCornerRadius(raw, fallbackPx = 0) {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const v = clamp(raw, 0, 240, fallbackPx);
    return { linked: true, tl: v, tr: v, br: v, bl: v, explicit: true };
  }
  if (raw && typeof raw === 'object') {
    const tl = clamp(raw.tl ?? raw.topLeft, 0, 240, fallbackPx);
    const tr = clamp(raw.tr ?? raw.topRight, 0, 240, fallbackPx);
    const br = clamp(raw.br ?? raw.bottomRight, 0, 240, fallbackPx);
    const bl = clamp(raw.bl ?? raw.bottomLeft, 0, 240, fallbackPx);
    const linked = raw.linked !== undefined ? Boolean(raw.linked) : (tl === tr && tr === br && br === bl);
    return { linked, tl, tr, br, bl, explicit: true };
  }
  return { linked: true, tl: fallbackPx, tr: fallbackPx, br: fallbackPx, bl: fallbackPx, explicit: false };
}

export function normalizeFillLayer(layer, index = 0) {
  const id = String(layer?.id || `fill-${index}`);
  const visible = layer?.visible !== false;
  const type = ['solid', 'linear', 'radial', 'conic', 'image'].includes(layer?.type) ? layer.type : 'solid';
  const opacity = clamp(layer?.opacity, 0, 1, 1);
  const blendMode = BLEND_MODES.includes(layer?.blendMode) ? layer.blendMode : 'normal';
  if (type === 'solid') {
    return { id, visible, type, color: normalizeHex6(layer?.color, '#d8e8dc'), opacity, blendMode };
  }
  if (type === 'image') {
    const rawUrl = String(layer?.url || '').trim();
    const safeUrl = /^(https?:\/\/|data:image\/|\/api\/)/i.test(rawUrl) ? rawUrl : '';
    const size = ['cover', 'contain', 'tile'].includes(layer?.size) ? layer.size : 'cover';
    return { id, visible, type, url: safeUrl, size, opacity, blendMode };
  }
  const stopsRaw = Array.isArray(layer?.stops) && layer.stops.length >= 2 ? layer.stops : [
    { color: '#6366f1', pos: 0 },
    { color: '#ec4899', pos: 100 },
  ];
  const stops = stopsRaw.slice(0, 6).map((stop, idx) => ({
    color: normalizeHex6(stop?.color, idx === 0 ? '#6366f1' : '#ec4899'),
    pos: clamp(stop?.pos, 0, 100, idx === 0 ? 0 : 100),
  })).sort((a, b) => a.pos - b.pos);
  return {
    id,
    visible,
    type,
    angle: clamp(layer?.angle, 0, 360, 135),
    stops,
    opacity,
    blendMode,
  };
}

export function normalizeEffect(effect, index = 0) {
  const type = ['drop-shadow', 'inner-shadow', 'layer-blur', 'background-blur'].includes(effect?.type)
    ? effect.type
    : 'drop-shadow';
  return {
    id: String(effect?.id || `fx-${index}`),
    enabled: effect?.enabled !== false,
    type,
    color: normalizeHex6(effect?.color, type === 'inner-shadow' ? '#ffffff' : '#18222b'),
    opacity: clamp(effect?.opacity, 0, 1, type === 'inner-shadow' ? 0.35 : 0.18),
    x: clamp(effect?.x, -48, 48, 0),
    y: clamp(effect?.y, -48, 48, type === 'inner-shadow' ? 1 : 4),
    blur: clamp(effect?.blur, 0, 64, type.includes('blur') ? 10 : 12),
    spread: clamp(effect?.spread, -24, 32, 0),
  };
}

const SIDE_KEYS = ['top', 'right', 'bottom', 'left'];

export function normalizeStroke(raw, item = {}) {
  const enabled = raw?.enabled !== undefined ? Boolean(raw.enabled) : item.strokeEnabled !== false;
  const baseWidth = clamp(raw?.width ?? item.strokeWidth, 0.5, 64, item.kind === 'shape' ? 2.5 : (item.kind === 'connector' ? 1.5 : 1));
  const color = normalizeHex6(raw?.color ?? item.color, '#617d68');
  const align = ['inside', 'center', 'outside'].includes(raw?.align) ? raw.align : 'center';
  const dashPattern = ['solid', 'dashed', 'dotted', 'custom'].includes(raw?.dashPattern) ? raw.dashPattern : 'solid';
  const dash = clamp(raw?.dash, 1, 64, dashPattern === 'dotted' ? 2 : 8);
  const gap = clamp(raw?.gap, 0, 64, dashPattern === 'dotted' ? 4 : 6);
  const cap = ['butt', 'round', 'square'].includes(raw?.cap) ? raw.cap : 'round';
  const join = ['miter', 'round', 'bevel'].includes(raw?.join) ? raw.join : 'round';
  const rawSides = raw?.sides || {};
  const linked = rawSides.linked !== undefined ? Boolean(rawSides.linked) : true;
  const sides = {
    linked,
    top: clamp(rawSides.top, 0, 32, baseWidth),
    right: clamp(rawSides.right, 0, 32, baseWidth),
    bottom: clamp(rawSides.bottom, 0, 32, baseWidth),
    left: clamp(rawSides.left, 0, 32, baseWidth),
  };
  return {
    explicit: Boolean(raw),
    enabled,
    color,
    width: baseWidth,
    align,
    dashPattern,
    dash,
    gap,
    cap,
    join,
    sides,
  };
}

export function normalizeAutoLayout(raw) {
  const enabled = Boolean(raw?.enabled);
  const paddingAll = raw?.paddingAll != null ? clamp(raw.paddingAll, 0, 120, 12) : 12;
  const paddingLinked = raw?.paddingLinked !== undefined ? Boolean(raw.paddingLinked) : true;
  return {
    enabled,
    direction: ['row', 'column', 'wrap'].includes(raw?.direction) ? raw.direction : 'column',
    paddingLinked,
    paddingTop: clamp(raw?.paddingTop, 0, 120, paddingAll),
    paddingRight: clamp(raw?.paddingRight, 0, 120, paddingAll),
    paddingBottom: clamp(raw?.paddingBottom, 0, 120, paddingAll),
    paddingLeft: clamp(raw?.paddingLeft, 0, 120, paddingAll),
    gap: clamp(raw?.gap, 0, 120, 10),
    alignItems: ['flex-start', 'center', 'flex-end', 'stretch'].includes(raw?.alignItems) ? raw.alignItems : 'stretch',
    justifyContent: ['flex-start', 'center', 'flex-end', 'space-between'].includes(raw?.justifyContent) ? raw.justifyContent : 'flex-start',
    widthMode: ['fixed', 'hug', 'fill'].includes(raw?.widthMode) ? raw.widthMode : 'fixed',
    heightMode: ['fixed', 'hug', 'fill'].includes(raw?.heightMode) ? raw.heightMode : 'fixed',
  };
}

export function normalizeTypography(raw, item = {}) {
  const fallbackFamily = '';
  return {
    explicit: Boolean(raw),
    fontFamily: typeof raw?.fontFamily === 'string' ? raw.fontFamily.slice(0, 120) : fallbackFamily,
    fontWeight: clamp(raw?.fontWeight, 100, 900, 400),
    lineHeight: clamp(raw?.lineHeight, 0.8, 3.0, 1.5),
    letterSpacing: clamp(raw?.letterSpacing, -4, 24, 0),
    paragraphSpacing: clamp(raw?.paragraphSpacing, 0, 64, 6),
    textAlign: ['left', 'center', 'right', 'justify'].includes(raw?.textAlign) ? raw.textAlign : 'left',
    overflowMode: ['visible', 'truncate', 'auto-fit'].includes(raw?.overflowMode) ? raw.overflowMode : 'visible',
    textColor: isHexColor(raw?.textColor) ? normalizeHex6(raw.textColor) : (item.kind === 'text' && isHexColor(item.color) ? normalizeHex6(item.color) : ''),
  };
}

export function normalizeFilters(raw) {
  return {
    brightness: clamp(raw?.brightness, 0, 200, DEFAULT_FILTERS.brightness),
    contrast: clamp(raw?.contrast, 0, 200, DEFAULT_FILTERS.contrast),
    saturate: clamp(raw?.saturate, 0, 200, DEFAULT_FILTERS.saturate),
    grayscale: clamp(raw?.grayscale, 0, 100, DEFAULT_FILTERS.grayscale),
    sepia: clamp(raw?.sepia, 0, 100, DEFAULT_FILTERS.sepia),
    hueRotate: clamp(raw?.hueRotate, -180, 180, DEFAULT_FILTERS.hueRotate),
    invert: clamp(raw?.invert, 0, 100, DEFAULT_FILTERS.invert),
  };
}

export function normalizeConnectorStyle(raw) {
  const labelStyle = raw?.labelStyle || {};
  return {
    routing: ['curved', 'straight', 'orthogonal'].includes(raw?.routing) ? raw.routing : 'curved',
    dashAnimation: ['none', 'forward', 'reverse'].includes(raw?.dashAnimation) ? raw.dashAnimation : 'none',
    animationSpeed: clamp(raw?.animationSpeed, 0.25, 4, 1),
    labelStyle: {
      background: isHexColor(labelStyle.background) ? normalizeHex6(labelStyle.background) : '',
      color: isHexColor(labelStyle.color) ? normalizeHex6(labelStyle.color) : '',
      borderColor: isHexColor(labelStyle.borderColor) ? normalizeHex6(labelStyle.borderColor) : '',
      pill: labelStyle.pill !== false,
    },
  };
}

export function readObjectStyle(item = {}) {
  const isObjectItem = Boolean(item && typeof item === 'object');
  const cachedEntry = isObjectItem ? OBJECT_STYLE_CACHE.get(item) : null;
  if (
    cachedEntry
    && cachedEntry.kind === item.kind
    && cachedEntry.shapeType === item.shapeType
    && cachedEntry.brush === item.brush
    && cachedEntry.format === item.format
    && cachedEntry.cornerStyle === item.cornerStyle
    && cachedEntry.opacity === item.opacity
    && cachedEntry.fill === item.fill
    && cachedEntry.fillOpacity === item.fillOpacity
    && cachedEntry.color === item.color
    && cachedEntry.strokeEnabled === item.strokeEnabled
    && cachedEntry.strokeWidth === item.strokeWidth
    && cachedEntry.shadowEnabled === item.shadowEnabled
    && cachedEntry.shadowBlur === item.shadowBlur
    && cachedEntry.shadowOpacity === item.shadowOpacity
    && cachedEntry.shadowOffsetX === item.shadowOffsetX
    && cachedEntry.shadowOffsetY === item.shadowOffsetY
  ) {
    return cachedEntry.parsed;
  }
  const env = parseRawStyleEnvelope(item);
  const legacyRounded = item.cornerStyle === 'rounded' || (
    ['chart', 'pdf', 'table', 'text', 'code', 'link'].includes(item.kind) && item.cornerStyle !== 'sharp'
  );
  const defaultCornerPx = legacyRounded ? 24 : 0;
  const cornerRadius = normalizeCornerRadius(env.cornerRadius, defaultCornerPx);
  const opacity = clamp(item.opacity ?? env.opacity, 0, 1, 1);
  const blendMode = BLEND_MODES.includes(env.blendMode) ? env.blendMode : 'normal';

  let fills;
  if (Array.isArray(env.fills)) {
    fills = env.fills.map((layer, index) => normalizeFillLayer(layer, index));
  } else if (item.kind === 'shape' && item.shapeType !== 'arrow' && isHexColor(item.fill)) {
    fills = [normalizeFillLayer({
      id: 'base',
      visible: true,
      type: 'solid',
      color: item.fill,
      opacity: clamp(item.fillOpacity, 0, 1, 1),
      blendMode: 'normal',
    }, 0)];
  } else {
    fills = [];
  }

  let effects;
  if (Array.isArray(env.effects)) {
    effects = env.effects.map((fx, index) => normalizeEffect(fx, index));
  } else if (item.shadowEnabled !== false && (item.shadowBlur != null || item.shadowOpacity != null || item.shadowOffsetX != null || item.shadowOffsetY != null)) {
    effects = [normalizeEffect({
      id: 'legacy-shadow',
      enabled: item.shadowEnabled !== false,
      type: 'drop-shadow',
      color: '#18222b',
      opacity: clamp(item.shadowOpacity, 0, 1, 0.15),
      x: clamp(item.shadowOffsetX, -24, 24, 0),
      y: clamp(item.shadowOffsetY, -24, 24, 2),
      blur: clamp(item.shadowBlur, 0, 24, 6),
      spread: 0,
    }, 0)];
  } else {
    effects = [];
  }

  const parsed = {
    cornerRadius,
    autoLayout: normalizeAutoLayout(env.autoLayout),
    opacity,
    blendMode,
    fills,
    explicitFills: Array.isArray(env.fills),
    stroke: normalizeStroke(env.stroke, item),
    effects,
    explicitEffects: Array.isArray(env.effects),
    typography: normalizeTypography(env.typography, item),
    filters: normalizeFilters(env.filters),
    connector: normalizeConnectorStyle(env.connector),
    customCss: typeof env.customCss === 'string' ? env.customCss.slice(0, 1000) : '',
    tokenIds: Array.isArray(env.tokenIds) ? env.tokenIds.filter((id) => typeof id === 'string').slice(0, 8) : [],
    hidden: Boolean(env.hidden),
    revealAfterAnimation: Boolean(env.revealAfterAnimation),
  };
  if (isObjectItem) {
    OBJECT_STYLE_CACHE.set(item, {
      kind: item.kind,
      shapeType: item.shapeType,
      brush: item.brush,
      format: item.format,
      cornerStyle: item.cornerStyle,
      opacity: item.opacity,
      fill: item.fill,
      fillOpacity: item.fillOpacity,
      color: item.color,
      strokeEnabled: item.strokeEnabled,
      strokeWidth: item.strokeWidth,
      shadowEnabled: item.shadowEnabled,
      shadowBlur: item.shadowBlur,
      shadowOpacity: item.shadowOpacity,
      shadowOffsetX: item.shadowOffsetX,
      shadowOffsetY: item.shadowOffsetY,
      parsed,
    });
  }
  return parsed;
}

export function filtersEqualDefault(filters) {
  return Object.entries(DEFAULT_FILTERS).every(([k, def]) => Number(filters?.[k] ?? def) === def);
}

export function buildEnvelopePayload(style) {
  const payload = {};
  if (style.cornerRadius?.explicit) {
    const c = style.cornerRadius;
    payload.cornerRadius = { linked: Boolean(c.linked), tl: c.tl, tr: c.tr, br: c.br, bl: c.bl };
  }
  if (style.autoLayout?.enabled || style.autoLayout?.widthMode !== 'fixed' || style.autoLayout?.heightMode !== 'fixed') {
    payload.autoLayout = style.autoLayout;
  }
  if (style.blendMode && style.blendMode !== 'normal') payload.blendMode = style.blendMode;
  if (style.explicitFills || (Array.isArray(style.fills) && style.fills.some((f) => f.type !== 'solid' || f.blendMode !== 'normal' || style.fills.length > 1))) {
    payload.fills = style.fills;
  }
  if (style.stroke?.explicit) {
    payload.stroke = { ...style.stroke };
    delete payload.stroke.explicit;
  }
  if (style.explicitEffects) {
    payload.effects = style.effects;
  }
  if (style.typography?.explicit) {
    payload.typography = { ...style.typography };
    delete payload.typography.explicit;
  }
  if (style.filters && !filtersEqualDefault(style.filters)) {
    payload.filters = style.filters;
  }
  if (style.connector && (
    style.connector.routing !== 'curved'
    || style.connector.dashAnimation !== 'none'
    || style.connector.labelStyle?.background
    || style.connector.labelStyle?.color
    || style.connector.labelStyle?.borderColor
    || style.connector.labelStyle?.pill === false
  )) {
    payload.connector = style.connector;
  }
  if (style.customCss && style.customCss.trim()) payload.customCss = style.customCss.trim().slice(0, 1000);
  if (Array.isArray(style.tokenIds) && style.tokenIds.length) payload.tokenIds = style.tokenIds;
  if (style.hidden) payload.hidden = true;
  if (style.revealAfterAnimation) payload.revealAfterAnimation = true;
  return payload;
}

export function writeObjectStylePatch(item, nextStyleOrUpdater) {
  const current = readObjectStyle(item);
  const nextStyle = typeof nextStyleOrUpdater === 'function'
    ? nextStyleOrUpdater(current, item)
    : { ...current, ...nextStyleOrUpdater };
  if (!nextStyle) return null;

  const patch = {};
  const opacity = clamp(nextStyle.opacity, 0, 1, 1);
  patch.opacity = opacity;

  if (nextStyle.cornerRadius?.explicit) {
    const maxR = Math.max(nextStyle.cornerRadius.tl, nextStyle.cornerRadius.tr, nextStyle.cornerRadius.br, nextStyle.cornerRadius.bl);
    patch.cornerStyle = maxR > 0 ? 'rounded' : 'sharp';
  }

  // Sync first visible solid fill into native fill/fillOpacity for shape compatibility.
  if (item.kind === 'shape' && item.shapeType !== 'arrow' && Array.isArray(nextStyle.fills)) {
    const visibleFills = nextStyle.fills.filter((layer) => layer.visible !== false);
    if (!visibleFills.length) {
      patch.fill = '';
      patch.fillOpacity = 0;
    } else if (visibleFills[0].type === 'solid') {
      patch.fill = visibleFills[0].color;
      patch.fillOpacity = clamp(visibleFills[0].opacity, 0, 1, 1);
    } else if (visibleFills[0].stops?.length) {
      patch.fill = visibleFills[0].stops[0].color;
      patch.fillOpacity = clamp(visibleFills[0].opacity, 0, 1, 1);
    }
  }

  // Sync primary stroke fields into native color/strokeWidth/strokeEnabled when present.
  if (nextStyle.stroke?.explicit) {
    patch.strokeEnabled = Boolean(nextStyle.stroke.enabled);
    if (['shape', 'connector'].includes(item.kind)) {
      patch.color = nextStyle.stroke.color;
      patch.strokeWidth = clamp(nextStyle.stroke.width, item.kind === 'shape' ? 0.5 : 0.8, 64, 1.5);
    }
  }

  // Sync first enabled drop-shadow with legacy shadow* fields so standard renderers stay in sync.
  if (Array.isArray(nextStyle.effects)) {
    const drop = nextStyle.effects.find((fx) => fx.enabled !== false && fx.type === 'drop-shadow');
    if (drop) {
      patch.shadowEnabled = true;
      patch.shadowBlur = clamp(drop.blur, 0, 24, 6);
      patch.shadowOpacity = clamp(drop.opacity, 0, 1, 0.15);
      patch.shadowOffsetX = clamp(drop.x, -24, 24, 0);
      patch.shadowOffsetY = clamp(drop.y, -24, 24, 2);
    } else if (nextStyle.explicitEffects) {
      patch.shadowEnabled = false;
    }
  }

  if (nextStyle.typography?.explicit && item.kind === 'text' && nextStyle.typography.textColor !== undefined) {
    if (nextStyle.typography.textColor) patch.color = nextStyle.typography.textColor;
  }

  const envelope = buildEnvelopePayload(nextStyle);
  const field = styleEnvelopeField(item);
  if (Object.keys(envelope).length > 0) {
    patch[field] = `${STYLE_PREFIX}${JSON.stringify(envelope)}`;
  } else if (typeof item[field] === 'string' && item[field].startsWith(STYLE_PREFIX)) {
    patch[field] = '';
  }

  return patch;
}

export function hasAdvancedStyle(item) {
  if (!item || typeof item !== 'object') return false;
  const field = styleEnvelopeField(item);
  if (typeof item[field] === 'string' && item[field].startsWith(STYLE_PREFIX)) {
    const env = parseRawStyleEnvelope(item);
    if (Object.keys(env).some((k) => k !== 'hidden' && k !== 'revealAfterAnimation')) return true;
  }
  if (item.opacity != null && Number(item.opacity) !== 1) return true;
  return false;
}

/**
 * Return true when an item can be hidden/revealed on the canvas.
 */
export function isHideableObject(item) {
  return Boolean(item && typeof item === 'object' && item.kind && item.kind !== 'portfolio' && item.kind !== 'channel' && item.type !== 'chat_room');
}

/**
 * Read persisted visibility flags (`hidden`, `revealAfterAnimation`) from the style envelope.
 */
export function readObjectVisibility(item) {
  if (!item || typeof item !== 'object') return { hidden: false, revealAfterAnimation: false };
  const env = parseRawStyleEnvelope(item);
  return {
    hidden: Boolean(env.hidden),
    revealAfterAnimation: Boolean(env.revealAfterAnimation),
  };
}

export function isObjectHidden(item) {
  return readObjectVisibility(item).hidden;
}

/**
 * Build a minimal BE-safe item patch updating visibility flags in the style envelope.
 */
export function writeObjectVisibilityPatch(item, patch) {
  if (!isHideableObject(item)) return null;
  const nextPatch = {};
  if (patch && Object.hasOwn(patch, 'hidden')) nextPatch.hidden = Boolean(patch.hidden);
  if (patch && Object.hasOwn(patch, 'revealAfterAnimation')) {
    nextPatch.revealAfterAnimation = Boolean(patch.revealAfterAnimation);
  }
  const fullPatch = writeObjectStylePatch(item, (cur) => ({ ...cur, ...nextPatch }));
  if (!fullPatch) return null;
  const field = styleEnvelopeField(item);
  const envelopeOnlyPatch = {};
  if (Object.hasOwn(fullPatch, field)) envelopeOnlyPatch[field] = fullPatch[field];
  return envelopeOnlyPatch;
}

export function fillLayerToCss(layer) {
  if (!layer || layer.visible === false) return 'transparent';
  if (layer.type === 'solid') return layer.color;
  if (layer.type === 'linear') {
    const stops = layer.stops.map((s) => `${s.color} ${s.pos}%`).join(', ');
    return `linear-gradient(${layer.angle}deg, ${stops})`;
  }
  if (layer.type === 'radial') {
    const stops = layer.stops.map((s) => `${s.color} ${s.pos}%`).join(', ');
    return `radial-gradient(circle at center, ${stops})`;
  }
  if (layer.type === 'conic') {
    const stops = layer.stops.map((s) => `${s.color} ${s.pos}%`).join(', ');
    return `conic-gradient(from ${layer.angle}deg at 50% 50%, ${stops})`;
  }
  if (layer.type === 'image' && layer.url) {
    return `url("${layer.url.replace(/"/g, '%22')}")`;
  }
  return 'transparent';
}

export function buildCornerRadiusCss(style, item = {}) {
  const c = style?.cornerRadius;
  if (!c) return undefined;
  if (!c.explicit) {
    return item.cornerStyle === 'rounded' || ['chart', 'pdf', 'table', 'text', 'code', 'link'].includes(item.kind) && item.cornerStyle !== 'sharp'
      ? 'var(--object-corner-radius, 24px)'
      : 'var(--object-corner-radius, 0px)';
  }
  if (c.tl === c.tr && c.tr === c.br && c.br === c.bl) return `${c.tl}px`;
  return `${c.tl}px ${c.tr}px ${c.br}px ${c.bl}px`;
}

export function buildCssFilterString(style, legacyShadowFilter = 'none', options = {}) {
  const includeDropShadow = options?.includeDropShadow !== false;
  const parts = [];
  const f = style?.filters || DEFAULT_FILTERS;
  if (f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
  if (f.saturate !== 100) parts.push(`saturate(${f.saturate}%)`);
  if (f.grayscale > 0) parts.push(`grayscale(${f.grayscale}%)`);
  if (f.sepia > 0) parts.push(`sepia(${f.sepia}%)`);
  if (f.hueRotate !== 0) parts.push(`hue-rotate(${f.hueRotate}deg)`);
  if (f.invert > 0) parts.push(`invert(${f.invert}%)`);
  const blurEffects = (style?.effects || []).filter((fx) => fx.enabled !== false && fx.type === 'layer-blur' && fx.blur > 0);
  for (const blurFx of blurEffects) parts.push(`blur(${blurFx.blur}px)`);
  if (includeDropShadow && style?.explicitEffects) {
    const drops = style.effects.filter((fx) => fx.enabled !== false && fx.type === 'drop-shadow');
    for (const drop of drops) {
      parts.push(`drop-shadow(${drop.x}px ${drop.y}px ${drop.blur}px ${hexToRgba(drop.color, drop.opacity)})`);
    }
  } else if (includeDropShadow && legacyShadowFilter && legacyShadowFilter !== 'none') {
    parts.push(legacyShadowFilter);
  }
  return parts.length ? parts.join(' ') : undefined;
}

export function buildBoxShadowString(style) {
  if (!style?.explicitEffects) return undefined;
  const shadows = [];
  for (const fx of style.effects) {
    if (fx.enabled === false) continue;
    if (fx.type === 'drop-shadow') {
      shadows.push(`${fx.x}px ${fx.y}px ${fx.blur * 1.6}px ${fx.spread}px ${hexToRgba(fx.color, fx.opacity)}`);
    } else if (fx.type === 'inner-shadow') {
      shadows.push(`inset ${fx.x}px ${fx.y}px ${fx.blur}px ${fx.spread}px ${hexToRgba(fx.color, fx.opacity)}`);
    }
  }
  return shadows.length ? shadows.join(', ') : 'none';
}

export function buildBackdropFilterString(style) {
  const blurs = (style?.effects || []).filter((fx) => fx.enabled !== false && fx.type === 'background-blur' && fx.blur > 0);
  if (!blurs.length) return undefined;
  return `blur(${blurs[0].blur}px)`;
}

export function buildStrokeDashArray(stroke) {
  if (!stroke || !stroke.enabled) return undefined;
  if (stroke.dashPattern === 'dashed') return `${stroke.dash} ${stroke.gap}`;
  if (stroke.dashPattern === 'dotted') return `${Math.max(1, Math.round(stroke.width))} ${Math.max(2, stroke.gap)}`;
  if (stroke.dashPattern === 'custom') return `${stroke.dash} ${stroke.gap}`;
  return undefined;
}

const ALLOWED_CSS_PROPS = new Set([
  'background', 'background-color', 'background-image', 'border', 'border-color', 'border-style', 'border-width',
  'border-radius', 'box-shadow', 'color', 'filter', 'backdrop-filter', 'letter-spacing', 'line-height',
  'text-shadow', 'text-transform', 'text-decoration', 'font-style', 'font-weight', 'font-family',
  'opacity', 'mix-blend-mode', 'outline', 'outline-offset', 'transform', 'clip-path', 'padding', 'gap',
]);

const cssPropToCamel = (prop) => prop.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());

export function sanitizeCustomCss(rawCss) {
  if (typeof rawCss !== 'string' || !rawCss.trim()) return {};
  const result = {};
  for (const statement of rawCss.split(';')) {
    const colon = statement.indexOf(':');
    if (colon <= 0) continue;
    const prop = statement.slice(0, colon).trim().toLowerCase();
    const val = statement.slice(colon + 1).trim();
    if (!ALLOWED_CSS_PROPS.has(prop) || !val) continue;
    if (/expression\(|javascript:|@import|behavior\s*:/i.test(val)) continue;
    result[cssPropToCamel(prop)] = val;
  }
  return result;
}

export function buildDomSurfaceStyle(item = {}) {
  const style = readObjectStyle(item);
  const inline = {};
  if (item.opacity != null && Number(item.opacity) !== 1) inline.opacity = style.opacity;
  if (style.blendMode && style.blendMode !== 'normal') inline.mixBlendMode = style.blendMode;
  if (style.cornerRadius?.explicit) {
    const radius = buildCornerRadiusCss(style, item);
    inline.borderRadius = radius;
    inline['--object-corner-radius'] = radius;
  }
  if (style.typography?.explicit) {
    const t = style.typography;
    if (t.fontFamily) inline.fontFamily = t.fontFamily;
    if (t.fontWeight && t.fontWeight !== 400) inline.fontWeight = t.fontWeight;
    if (t.lineHeight) inline['--typo-line-height'] = String(t.lineHeight);
    if (t.letterSpacing) inline.letterSpacing = `${t.letterSpacing}px`;
    inline['--typo-paragraph-spacing'] = `${t.paragraphSpacing}px`;
    if (t.textAlign) inline.textAlign = t.textAlign;
    if (t.textColor) {
      inline.color = t.textColor;
      inline['--text-color'] = t.textColor;
    }
  }
  if (style.explicitEffects || !filtersEqualDefault(style.filters)) {
    const isDomCard = !(item.kind === 'shape' && !item.runtimeRole) && !['connector', 'stroke'].includes(item.kind);
    const isNotchedNote = item.kind === 'note' && !style.explicitFills && !style.cornerRadius?.explicit;
    const useBackdropBoxShadowOnly = isDomCard && style.explicitEffects && !isNotchedNote;
    const filterStr = buildCssFilterString(style, null, { includeDropShadow: !useBackdropBoxShadowOnly });
    if (filterStr) {
      inline['--styled-filter'] = filterStr;
    }
    if (useBackdropBoxShadowOnly) {
      // ObjectStyleBackdrop renders box-shadow directly; suppress duplicate card/content shadows & expensive drop-shadow filters.
      inline['--object-shadow-box'] = 'none';
      inline['--object-shadow-filter'] = 'none';
    } else {
      if (filterStr) inline['--object-shadow-filter'] = filterStr;
      const shadowBox = buildBoxShadowString(style);
      if (shadowBox !== undefined) inline['--object-shadow-box'] = shadowBox;
    }
    if (!useBackdropBoxShadowOnly) {
      const backdrop = buildBackdropFilterString(style);
      if (backdrop) {
        inline.backdropFilter = backdrop;
        inline.WebkitBackdropFilter = backdrop;
      }
    }
  }
  if (style.autoLayout?.enabled) {
    const al = style.autoLayout;
    inline['--al-direction'] = al.direction === 'wrap' ? 'row' : al.direction;
    inline['--al-wrap'] = al.direction === 'wrap' ? 'wrap' : 'nowrap';
    inline['--al-gap'] = `${al.gap}px`;
    inline['--al-padding'] = `${al.paddingTop}px ${al.paddingRight}px ${al.paddingBottom}px ${al.paddingLeft}px`;
    inline['--al-align'] = al.alignItems;
    inline['--al-justify'] = al.justifyContent;
  }
  if (style.customCss) {
    Object.assign(inline, sanitizeCustomCss(style.customCss));
  }
  return { parsed: style, inline };
}

export { SIDE_KEYS };
