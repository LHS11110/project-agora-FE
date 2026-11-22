import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { intlLocale, normalizeLocale, readLocale, translate, setLocale, getLocale, subscribeLocale, LOCALE_KEY } from '../src/i18n/locale.js';
import en from '../src/i18n/en.js';
import canvasMessages from '../src/i18n/canvasMessages.js';
import { canvasToolCategories } from '../src/canvas/canvasToolCatalog.js';
import { shapeCatalog, shapeCategories } from '../src/canvas/shapeCatalog.js';
import { ARROW_HEAD_OPTIONS } from '../src/components/arrowheads/headShapes.js';
import { STYLE_PRESETS, THEME_PALETTES } from '../src/canvas/styling/stylePresets.js';
import { FONT_FAMILIES } from '../src/canvas/styling/objectStyleModel.js';
import { PEN_STYLES } from '../src/canvas/penStyles.js';
import {
  INPUT_DATA_FORMATS,
  INPUT_TYPE_OPTIONS,
  ROUTING_MODES,
  JSON_RULE_OPERATORS,
  ROUTER_FALLBACK_POLICIES,
  OUTPUT_DISPLAY_MODES,
  ORCHESTRATION_MODES,
  EDGE_CHANNELS,
  EDGE_DELIVERY_MODES,
  AGENT_ROLE_PRESETS,
  MULTI_AGENT_TEMPLATES,
} from '../src/canvas/agents/agentCanvasModel.js';
import { richPreviewSignature } from '../src/canvas/richPreviewRaster.js';

test('locale preference wins over browser; unsupported languages and disabled storage are safe', () => {
  assert.equal(readLocale({getItem: key => key === LOCALE_KEY ? 'en' : null}, 'ko-KR'), 'en');
  assert.equal(readLocale({getItem: () => null}, 'en-US'), 'en');
  assert.equal(readLocale({getItem: () => 'invalid'}, 'ko-KR'), 'ko');
  assert.equal(readLocale({getItem: () => {throw new Error('blocked');}}, 'en-GB'), 'en');
  assert.equal(normalizeLocale('fr-CA'), 'fr');
  assert.equal(normalizeLocale('ja-JP'), 'ja');
  assert.equal(normalizeLocale('zh_Hans_CN'), 'zh');
  assert.equal(normalizeLocale('de-DE'), 'ko');
  assert.equal(readLocale({getItem: () => 'ja'}, 'fr-FR'), 'ja');
  assert.equal(readLocale(null, 'zh-CN'), 'zh');
  assert.equal(intlLocale('zh'), 'zh-Hans');
});
test('translations interpolate named values without changing unknown content', () => {
  assert.equal(translate('캔버스 {id}', 'en', {id: 42}), 'Canvas 42');
  assert.equal(translate('캔버스 {id}', 'ko', {id: 42}), '캔버스 42');
  assert.equal(translate('임의 사용자 메모 $x^2$ <tag>', 'en'), '임의 사용자 메모 $x^2$ <tag>');
  assert.equal(translate('캔버스 {id}', 'en'), 'Canvas {id}');
});
test('locale updates notify subscribers once and do not change persisted object catalogs', () => {
  const before=JSON.stringify({shapeCatalog,ARROW_HEAD_OPTIONS});
  let changes=0;const unsubscribe=subscribeLocale(()=>changes++);
  setLocale('en');setLocale('en');assert.equal(getLocale(),'en');assert.equal(changes,1);
  unsubscribe();setLocale('ko');assert.equal(changes,1);
  assert.equal(JSON.stringify({shapeCatalog,ARROW_HEAD_OPTIONS}),before);
});
test('every shape and arrowhead has an English display label', () => {
  for(const item of [...shapeCatalog,...ARROW_HEAD_OPTIONS]){
    assert.ok(!/[가-힣]/.test(translate(item.label,'en')),`Missing label: ${item.label}`);
  }
});


test('new canvas locales translate the tool catalog and preserve interpolation', () => {
  const locales = ['zh', 'ja', 'fr'];
  const params = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [source, values] of Object.entries(canvasMessages)) {
    assert.equal(values.length, locales.length, source);
    for (const value of values) assert.deepEqual(params(value), params(source), source);
  }
  for (const category of canvasToolCategories) {
    for (const key of [category.label, ...category.tools.flatMap(tool => [tool.label, tool.description])]) {
      if (key && /[가-힣]/.test(key)) assert.ok(Object.hasOwn(canvasMessages, key), key);
    }
  }
  const shapes = [...shapeCatalog, ...ARROW_HEAD_OPTIONS];
  for (const { label } of shapes) {
    if (/[가-힣]/.test(label)) assert.ok(Object.hasOwn(canvasMessages, label), label);
  }
  assert.equal(translate('캔버스 {id}', 'ja', { id: 42 }), 'キャンバス 42');
  assert.equal(translate('캔버스에 자료 {count}개를 추가했습니다.', 'zh', { count: 2 }), '已向画布添加 2 项内容。');
  assert.equal(translate('설정', 'fr'), 'Paramètres');
  assert.equal(translate('사용 약관', 'fr'), translate('사용 약관', 'en'));
  assert.equal(translate('임의 사용자 메모 $x^2$ <tag>', 'ja'), '임의 사용자 메모 $x^2$ <tag>');
  assert.equal(translate('constructor', 'zh'), 'constructor');
});

test('canvasMessages aligns with en, avoids non-canvas keys, and preserves placeholders cleanly', () => {
  const params = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  assert.equal(Object.hasOwn(canvasMessages, '사용 약관'), false);
  for (const [source, values] of Object.entries(canvasMessages)) {
    assert.ok(Object.hasOwn(en, source), `Missing English entry for canvasMessage key: ${source}`);
    const english = en[source];
    assert.equal(typeof english, 'string');
    assert.ok(english.trim().length > 0, `Empty English entry: ${source}`);
    assert.ok(!/[가-힣]/.test(english), `Hangul leaked into English entry: ${source} -> ${english}`);
    assert.deepEqual(params(english), params(source), `Placeholder mismatch in en for: ${source}`);
    assert.equal(values.length, 3, `Expected [zh, ja, fr] tuple for: ${source}`);
    for (const [idx, value] of values.entries()) {
      assert.equal(typeof value, 'string', `Non-string entry[${idx}] for: ${source}`);
      assert.ok(value.trim().length > 0, `Empty entry[${idx}] for: ${source}`);
      assert.ok(!/[가-힣]/.test(value), `Hangul leaked into entry[${idx}] for: ${source} -> ${value}`);
      assert.deepEqual(params(value), params(source), `Placeholder mismatch in entry[${idx}] for: ${source}`);
    }
  }
});

test('every canvas catalog label and description translates across all 5 locales', () => {
  const keys = new Set();
  const collect = value => {
    if (typeof value === 'string' && /[가-힣]/.test(value)) keys.add(value);
  };
  for (const label of Object.values(shapeCategories)) collect(label);
  for (const category of canvasToolCategories) {
    collect(category.label);
    for (const tool of category.tools) {
      collect(tool.label);
      collect(tool.description);
    }
  }
  for (const item of [...shapeCatalog, ...ARROW_HEAD_OPTIONS, ...STYLE_PRESETS, ...THEME_PALETTES, ...PEN_STYLES]) {
    collect(item.label);
    collect(item.description);
    collect(item.name);
  }
  for (const item of FONT_FAMILIES) collect(item.label);
  for (const list of [
    INPUT_DATA_FORMATS,
    INPUT_TYPE_OPTIONS,
    ROUTING_MODES,
    JSON_RULE_OPERATORS,
    ROUTER_FALLBACK_POLICIES,
    OUTPUT_DISPLAY_MODES,
    ORCHESTRATION_MODES,
    EDGE_CHANNELS,
    EDGE_DELIVERY_MODES,
    AGENT_ROLE_PRESETS,
    MULTI_AGENT_TEMPLATES,
  ]) {
    for (const item of list) {
      collect(item.label);
      collect(item.description);
    }
  }
  for (const key of keys) {
    assert.ok(Object.hasOwn(en, key), `Catalog key missing in en.js: ${key}`);
    assert.ok(Object.hasOwn(canvasMessages, key), `Catalog key missing in canvasMessages.js: ${key}`);
    for (const locale of ['en', 'zh', 'ja', 'fr']) {
      const out = translate(key, locale);
      assert.ok(out && !/[가-힣]/.test(out), `Untranslated catalog key "${key}" for locale ${locale}: "${out}"`);
    }
  }
});

test('every static Hangul literal passed to ui() across canvas UI files translates cleanly', () => {
  const walk = (dir, out = []) => {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (/\.(js|jsx|mjs)$/.test(entry.name)) out.push(full);
    }
    return out;
  };
  const files = [
    'src/pages/CanvasPage.jsx',
    ...walk('src/canvas'),
    ...walk('src/components/canvas'),
    'src/components/CanvasAgentPanel.jsx',
    'src/components/CanvasAgentLauncher.jsx',
    'src/components/AgentSessionPicker.jsx',
    'src/components/EditableTable.jsx',
    'src/components/ArrowHeadControls.jsx',
    'src/components/ShareComposer.jsx',
    'src/components/SharedMediaContent.jsx',
    'src/components/LinkPreview.jsx',
    'src/components/ResizeHandles.jsx',
    'src/components/RotationHandles.jsx',
    'src/components/GroupRotationHandles.jsx',
  ];
  const literalKeys = new Set();
  const re = /\bui\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\$]|\\.)*`)/g;
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = re.exec(src))) {
      let value;
      try {
        value = vm.runInNewContext(match[1]);
      } catch {
        continue;
      }
      if (typeof value === 'string' && /[가-힣]/.test(value)) literalKeys.add(value);
    }
  }
  assert.ok(literalKeys.size > 1000, `Expected >1000 extracted canvas ui() keys, got ${literalKeys.size}`);
  for (const key of literalKeys) {
    assert.ok(Object.hasOwn(en, key), `Missing en entry for canvas ui() literal: ${key}`);
    assert.ok(Object.hasOwn(canvasMessages, key), `Missing canvasMessages entry for canvas ui() literal: ${key}`);
    for (const locale of ['en', 'zh', 'ja', 'fr']) {
      const out = translate(key, locale);
      assert.ok(out && !/[가-힣]/.test(out), `Untranslated canvas ui() literal "${key}" for ${locale}: "${out}"`);
    }
  }
});

test('richPreviewSignature changes when locale changes and restores cleanly', () => {
  const prev = getLocale();
  try {
    setLocale('ko');
    const koSig = richPreviewSignature({ id: 'n1', kind: 'note', text: 'hello' });
    setLocale('ja');
    const jaSig = richPreviewSignature({ id: 'n1', kind: 'note', text: 'hello' });
    assert.notEqual(koSig, jaSig);
  } finally {
    setLocale(prev || 'ko');
  }
});
