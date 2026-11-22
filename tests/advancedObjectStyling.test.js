import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readObjectStyle,
  writeObjectStylePatch,
  hasAdvancedStyle,
  fillLayerToCss,
  buildCornerRadiusCss,
  buildCssFilterString,
  buildDomSurfaceStyle,
  sanitizeCustomCss,
} from '../src/canvas/styling/objectStyleModel.js';
import {
  STYLE_PRESETS,
  THEME_PALETTES,
  applyPresetToItem,
  applyThemePaletteToItem,
} from '../src/canvas/styling/stylePresets.js';
import {
  createTokenFromItem,
  applyTokenToItem,
  persistStyleTokens,
  loadStyleTokens,
} from '../src/canvas/styling/styleTokens.js';
import {
  analyzeSelectionIntersection,
  itemCapabilities,
  extractSelectionColors,
  replaceSelectionColorPatch,
} from '../src/canvas/styling/selectionIntersection.js';
import {
  extractStyleBundle,
  applyStyleBundlePatch,
} from '../src/canvas/styling/styleClipboard.js';
import { computeAutoLayoutPatches } from '../src/canvas/styling/autoLayout.js';
import { objectCornerRadius, objectCornerRadii } from '../src/canvas/objectCorners.js';
import { connectorGeometry } from '../src/components/connectorGeometry.js';

const BE_ALLOWED_FIELDS = new Set([
  'frameId', 'animationPriority', 'frameOrder', 'frameLinkPriority', 'portfolioCursor',
  'animation', 'animationPlayback', 'portfolioPages', 'portfolioDescription',
  'kind', 'text', 'code', 'formula', 'format', 'filename', 'language',
  'shapeType', 'visualStyle', 'volumeStyle', 'chartType', 'color', 'fill',
  'permission', 'groupId', 'src', 'url', 'title', 'mediaType',
  'from', 'to', 'fromPort', 'toPort', 'startHead', 'endHead', 'brush',
  'embedUrl', 'videoId', 'renderMode', 'label', 'labelMode', 'groupTitle',
  'thumbnail', 'cornerStyle', 'runtimeRole', 'shadowBlur', 'shadowOpacity',
  'shadowOffsetX', 'shadowOffsetY', 'depth', 'x', 'y', 'width', 'height',
  'rotation', 'fontSize', 'strokeWidth', 'bend', 'opacity',
  'fillOpacity', 'sketchFillOpacity', 'points', 'rows', 'columns',
  'simulatePressure', 'complete', 'strokeEnabled', 'shadowEnabled',
  'locked', 'imageFrameEnabled', 'bendPoints', 'members',
]);

function assertOnlyAllowedKeys(patch) {
  for (const key of Object.keys(patch || {})) {
    assert.ok(BE_ALLOWED_FIELDS.has(key), `Unexpected non-whitelisted BE field: ${key}`);
  }
}

test('objectStyleModel roundtrips corners, multi-layer fills, stroke sides, effects, typography, filters & custom CSS using only BE-allowed keys', () => {
  const item = { kind: 'shape', shapeType: 'rectangle', x: 0.1, y: 0.1, width: 0.2, height: 0.15, fill: '#ff0000', color: '#111111' };
  const patch = writeObjectStylePatch(item, (cur) => ({
    ...cur,
    opacity: 0.72,
    blendMode: 'multiply',
    cornerRadius: { linked: false, tl: 20, tr: 4, br: 16, bl: 8, explicit: true },
    explicitFills: true,
    fills: [
      { id: 'f1', visible: true, type: 'linear', angle: 90, stops: [{ color: '#112233', pos: 0 }, { color: '#445566', pos: 100 }], opacity: 0.85, blendMode: 'normal' },
      { id: 'f2', visible: true, type: 'conic', angle: 45, stops: [{ color: '#ff00aa', pos: 0 }, { color: '#00ccff', pos: 100 }], opacity: 0.5, blendMode: 'overlay' },
    ],
    stroke: {
      explicit: true,
      enabled: true,
      color: '#22aa88',
      width: 3,
      align: 'inside',
      dashPattern: 'custom',
      dash: 10,
      gap: 4,
      cap: 'square',
      join: 'bevel',
      sides: { linked: false, top: 1, right: 2, bottom: 5, left: 2 },
    },
    explicitEffects: true,
    effects: [
      { id: 'e1', enabled: true, type: 'drop-shadow', color: '#0f172a', opacity: 0.4, x: 2, y: 8, blur: 16, spread: 0 },
      { id: 'e2', enabled: true, type: 'background-blur', color: '#ffffff', opacity: 1, x: 0, y: 0, blur: 14, spread: 0 },
    ],
    typography: { ...cur.typography, explicit: true, fontWeight: 700, lineHeight: 1.8, letterSpacing: 2, paragraphSpacing: 12, textAlign: 'center', overflowMode: 'truncate', textColor: '#ffffff' },
    filters: { ...cur.filters, brightness: 115, grayscale: 25 },
    customCss: 'border-style: dashed; position: fixed; left: 0px;',
  }));

  assertOnlyAllowedKeys(patch);
  const updated = { ...item, ...patch };
  assert.equal(hasAdvancedStyle(updated), true);
  assert.equal(updated.opacity, 0.72);
  assert.equal(updated.cornerStyle, 'rounded');
  assert.equal(objectCornerRadius(updated, 400, 300), 20);
  assert.deepEqual(objectCornerRadii(updated, 400, 300), { tl: 20, tr: 4, br: 16, bl: 8 });

  const parsed = readObjectStyle(updated);
  assert.equal(parsed.blendMode, 'multiply');
  assert.equal(parsed.fills.length, 2);
  assert.match(fillLayerToCss(parsed.fills[0]), /^linear-gradient\(90deg/);
  assert.match(fillLayerToCss(parsed.fills[1]), /^conic-gradient\(from 45deg/);
  assert.equal(buildCornerRadiusCss(parsed, updated), '20px 4px 16px 8px');
  assert.equal(parsed.stroke.align, 'inside');
  assert.equal(parsed.stroke.sides.bottom, 5);
  assert.equal(parsed.typography.fontWeight, 700);
  assert.equal(parsed.typography.overflowMode, 'truncate');

  const css = buildDomSurfaceStyle(updated).inline;
  assert.equal(css.borderStyle, 'dashed');
  assert.equal(css.position, undefined);
  assert.equal(css.left, undefined);
  assert.match(buildCssFilterString(parsed), /brightness\(115%\)/);
  assert.match(buildCssFilterString(parsed), /grayscale\(25%\)/);
  assert.deepEqual(sanitizeCustomCss('color: red; background: url(javascript:alert(1))'), { color: 'red' });
});

test('strokes keep stroke.brush untouched by storing style envelope in format', () => {
  const strokeItem = { kind: 'stroke', brush: 'ink', opacity: 1, points: [{ x: 0.1, y: 0.1 }] };
  const patch = writeObjectStylePatch(strokeItem, (cur) => ({
    ...cur,
    opacity: 0.5,
    filters: { ...cur.filters, contrast: 130 },
  }));
  assertOnlyAllowedKeys(patch);
  assert.equal(patch.brush, undefined);
  assert.ok(String(patch.format).startsWith('style1:'));
  const updated = { ...strokeItem, ...patch };
  assert.equal(readObjectStyle(updated).opacity, 0.5);
  assert.equal(readObjectStyle(updated).filters.contrast, 130);
});

test('presets, theme palettes, and tokens generate safe patches and persist cleanly', () => {
  const textItem = { kind: 'text', text: 'Hero', x: 0.1, y: 0.1, width: 0.2, height: 0.1 };
  for (const preset of STYLE_PRESETS) {
    const patch = applyPresetToItem(textItem, preset.id);
    assertOnlyAllowedKeys(patch);
    const updated = { ...textItem, ...patch };
    assert.equal(hasAdvancedStyle(updated), true);
  }
  for (const palette of THEME_PALETTES) {
    const patch = applyThemePaletteToItem(textItem, palette.id);
    assertOnlyAllowedKeys(patch);
  }

  const styled = { ...textItem, ...applyPresetToItem(textItem, 'neon-glow') };
  const tok = createTokenFromItem(styled, 'Neon Card', 'complete');
  const store = new Map();
  const mockStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
  };
  assert.equal(persistStyleTokens('2132', [tok], mockStorage), true);
  const loaded = loadStyleTokens('2132', mockStorage);
  assert.equal(loaded[0].name, 'Neon Card');

  const target = { kind: 'note', text: 'Note', x: 0.2, y: 0.2, width: 0.2, height: 0.15 };
  const tokPatch = applyTokenToItem(target, loaded[0]);
  assertOnlyAllowedKeys(tokPatch);
  assert.match(tokPatch.brush, new RegExp(tok.id));
});

test('heterogeneous multi-selection intersection, selection colors batch swap, and style copy/paste work safely', () => {
  const items = {
    s1: { kind: 'shape', shapeType: 'rectangle', x: 0.1, y: 0.1, width: 0.14, height: 0.12, fill: '#aa2244', color: '#112233', opacity: 0.8 },
    t1: { kind: 'text', text: 'Title', x: 0.3, y: 0.1, width: 0.2, height: 0.1, color: '#aa2244', opacity: 0.5 },
    img1: { kind: 'image', src: 'https://example.invalid/a.jpg', x: 0.5, y: 0.1, width: 0.2, height: 0.15, opacity: 0.8 },
  };
  const intersection = analyzeSelectionIntersection(items, ['s1', 't1', 'img1']);
  assert.equal(intersection.count, 3);
  assert.equal(intersection.capabilities.opacity, true);
  assert.equal(intersection.capabilities.stroke, true);
  assert.equal(intersection.capabilities.cornerRadius, true);
  assert.equal(intersection.capabilities.fill, false); // image does not support fill
  assert.equal(itemCapabilities({ kind: 'stroke', points: [] }).stroke, false); // drawings use pen controls
  assert.equal(intersection.mixed.opacity, true);

  const colors = extractSelectionColors(items, ['s1', 't1', 'img1']);
  assert.ok(colors.some((c) => c.color === '#aa2244' && c.count >= 2));

  const swappedShape = { ...items.s1, ...replaceSelectionColorPatch(items.s1, '#aa2244', '#00ff88') };
  const swappedText = { ...items.t1, ...replaceSelectionColorPatch(items.t1, '#aa2244', '#00ff88') };
  assert.equal(swappedShape.fill, '#00ff88');
  assert.equal(swappedText.color, '#00ff88');

  const source = { ...items.s1, ...applyPresetToItem(items.s1, 'button-3d'), fontSize: 22 };
  const bundle = extractStyleBundle(source);
  const pastedPatch = applyStyleBundlePatch(items.t1, bundle);
  assertOnlyAllowedKeys(pastedPatch);
  assert.equal(pastedPatch.fontSize, 22);
  assert.equal(pastedPatch.x, undefined);
  assert.equal(pastedPatch.text, undefined);
});

test('Auto Layout computes row/column child coordinates and parent hug dimensions cleanly', () => {
  const boardSize = { width: 1000, height: 1000 };
  const container = {
    kind: 'frame',
    title: 'Row Container',
    x: 0.1,
    y: 0.1,
    width: 0.5,
    height: 0.3,
    ...writeObjectStylePatch({ kind: 'frame' }, (cur) => ({
      ...cur,
      autoLayout: {
        ...cur.autoLayout,
        enabled: true,
        direction: 'row',
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 15,
        paddingBottom: 15,
        gap: 10,
        widthMode: 'hug',
        heightMode: 'hug',
      },
    })),
  };
  const items = {
    f1: container,
    c1: { kind: 'text', text: 'A', frameId: 'f1', x: 0.12, y: 0.15, width: 0.1, height: 0.08 },
    c2: { kind: 'text', text: 'B', frameId: 'f1', x: 0.35, y: 0.2, width: 0.12, height: 0.1 },
  };
  const patches = computeAutoLayoutPatches('f1', container, items, boardSize);
  assert.equal(Math.round(patches.c1.x * 1000), 120); // frame x (100) + padLeft (20)
  assert.equal(Math.round(patches.c2.x * 1000), 230); // 120 + 100 + gap (10)
  assert.equal(Math.round(patches.c1.y * 1000), 115);
  assert.equal(Math.round(patches.f1.width * 1000), 270); // 20 + 100 + 10 + 120 + 20
  assert.equal(Math.round(patches.f1.height * 1000), 130); // 15 + 100 + 15
});

test('connectorGeometry supports straight and orthogonal routing alongside curved', () => {
  const items = {
    a: { kind: 'shape', shapeType: 'rectangle', x: 0.1, y: 0.1, width: 0.1, height: 0.1 },
    b: { kind: 'shape', shapeType: 'rectangle', x: 0.5, y: 0.3, width: 0.1, height: 0.1 },
  };
  const straightItem = {
    kind: 'connector',
    from: 'a',
    to: 'b',
    ...writeObjectStylePatch({ kind: 'connector' }, (cur) => ({
      ...cur,
      connector: { ...cur.connector, routing: 'straight', dashAnimation: 'forward' },
    })),
  };
  const orthoItem = {
    kind: 'connector',
    from: 'a',
    to: 'b',
    ...writeObjectStylePatch({ kind: 'connector' }, (cur) => ({
      ...cur,
      connector: { ...cur.connector, routing: 'orthogonal' },
    })),
  };
  const straightGeom = connectorGeometry(straightItem, items, 1600, 1000);
  const orthoGeom = connectorGeometry(orthoItem, items, 1600, 1000);
  assert.equal(straightGeom.points.length, 2);
  assert.equal(orthoGeom.points.length, 4);
  // Orthogonal middle segment shares exact X coordinate
  assert.equal(Math.round(orthoGeom.points[1].x), Math.round(orthoGeom.points[2].x));
});

test('vector shape hosts never carry an unbudgeted backdrop blur', () => {
  const brush = 'style1:' + JSON.stringify({ effects: [{ type: 'background-blur', blur: 12 }] });
  assert.equal(buildDomSurfaceStyle({ kind: 'shape', shapeType: 'triangle', brush }).inline.backdropFilter, undefined);
  assert.equal(buildDomSurfaceStyle({ kind: 'note', text: 'memo', brush }).inline.backdropFilter, 'blur(12px)');
});
