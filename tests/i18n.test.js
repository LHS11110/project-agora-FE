import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLocale, readLocale, translate, setLocale, getLocale, subscribeLocale, LOCALE_KEY } from '../src/i18n/locale.js';
import { shapeCatalog } from '../src/canvas/shapeCatalog.js';
import { ARROW_HEAD_OPTIONS } from '../src/components/arrowheads/headShapes.js';

test('locale preference wins over browser; unsupported languages and disabled storage are safe', () => {
  assert.equal(readLocale({getItem: key => key === LOCALE_KEY ? 'en' : null}, 'ko-KR'), 'en');
  assert.equal(readLocale({getItem: () => null}, 'en-US'), 'en');
  assert.equal(readLocale({getItem: () => 'invalid'}, 'ko-KR'), 'ko');
  assert.equal(readLocale({getItem: () => {throw new Error('blocked');}}, 'en-GB'), 'en');
  assert.equal(normalizeLocale('fr-FR'), 'ko');
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
