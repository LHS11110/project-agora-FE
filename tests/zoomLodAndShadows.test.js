import assert from 'node:assert/strict';
import test from 'node:test';
import { flatRectangleTint } from '../src/canvas/flatShapeTint.js';
import { graphicsRasterRatio } from '../src/canvas/graphicsQuality.js';
import { rasterDescriptor } from '../src/canvas/rasterObjectCache.js';
import { drawRichOverview, richPreviewSignature } from '../src/canvas/richPreviewRaster.js';
import { isOverviewProxy, overviewProxy } from '../src/canvas/sceneRepresentation.js';

const world = { width: 2000, height: 1200 };

function createRecordingContext() {
  const ops = [];
  const gradient = () => ({ addColorStop() {} });
  const ctx = {
    font: '12px sans-serif',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    textBaseline: 'alphabetic',
    textAlign: 'left',
    save() { ops.push('save'); },
    restore() { ops.push('restore'); },
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    rect() {},
    roundRect() {},
    clip() {},
    stroke() { ops.push('stroke'); },
    fill() { ops.push('fill'); },
    fillRect(x, y, w, h) { ops.push(['fillRect', Math.round(x), Math.round(y), Math.round(w), Math.round(h)]); },
    strokeRect() { ops.push('strokeRect'); },
    fillText(text) { ops.push(['fillText', String(text)]); },
    measureText(text) { return { width: String(text || '').length * 6 }; },
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    drawImage() { ops.push('drawImage'); },
  };
  return { ctx, ops };
}

test('zoom-out overviewProxy preserves non-box rich representation for every object kind', () => {
  const richItems = [
    { id: 'n1', kind: 'note', x: 0.1, y: 0.1, width: 0.2, height: 0.14, text: '회의 메모' },
    { id: 't1', kind: 'table', x: 0.1, y: 0.1, width: 0.22, height: 0.16, columns: ['A', 'B'], rows: [['1', '2'], ['3', '4']] },
    { id: 'c1', kind: 'chart', x: 0.1, y: 0.1, width: 0.24, height: 0.18, chartType: 'bar', chartTitle: '매출', columns: ['월', '값'], rows: [['1월', '10'], ['2월', '20']] },
    { id: 'l1', kind: 'link', x: 0.1, y: 0.1, width: 0.22, height: 0.16, title: '참고 링크', url: 'https://example.com' },
    { id: 'p1', kind: 'pdf', x: 0.1, y: 0.1, width: 0.2, height: 0.24, filename: 'spec.pdf', pdfPage: 2 },
    { id: 'q1', kind: 'question', x: 0.1, y: 0.1, width: 0.22, height: 0.16, questionType: 'choice', questionPrompt: '질문?', questionOptions: ['예', '아니오'] },
    { id: 'v1', kind: 'value', x: 0.1, y: 0.1, width: 0.16, height: 0.1, title: '온도', valueNumber: 42, valueMin: 0, valueMax: 100 },
    { id: 'pr1', kind: 'project', x: 0.1, y: 0.1, width: 0.28, height: 0.2, title: '로드맵', issues: [{ id: 'i1' }] },
    { id: 'ug1', kind: 'user-group', x: 0.1, y: 0.1, width: 0.2, height: 0.12, groupTitle: '디자인팀', members: [{ id: 'u1' }, { id: 'u2' }] },
    { id: 'rt1', kind: 'code', runtimeRole: 'terminal', x: 0.1, y: 0.1, width: 0.24, height: 0.16, text: '$ npm test' },
    { id: 'rn1', kind: 'frame', runtimeRole: 'notebook', x: 0.1, y: 0.1, width: 0.28, height: 0.22, title: '노트북' },
    { id: 're1', kind: 'code', runtimeRole: 'executor', x: 0.1, y: 0.1, width: 0.24, height: 0.16, code: 'print(1)' },
    { id: 'ro1', kind: 'note', runtimeRole: 'output', x: 0.1, y: 0.1, width: 0.22, height: 0.14, text: '42' },
  ];

  for (const item of richItems) {
    assert.equal(isOverviewProxy(item, world, 0.25), false, `${item.id} keeps crisp full representation at readable size`);
    assert.equal(isOverviewProxy(item, world, 0.03), true, `${item.id} only simplifies at sub-12px microscopic zoom`);
    const proxy = overviewProxy(item, world, 0.03);
    assert.ok(proxy.__overviewKind, `${item.id} exposes __overviewKind instead of blank box`);
    assert.ok(proxy.__previewKey, `${item.id} exposes __previewKey`);
    assert.equal(flatRectangleTint(proxy, world), null, `${item.id} skips flat monochrome rectangle tinting`);

    const { ctx, ops } = createRecordingContext();
    drawRichOverview(ctx, proxy, world, { font: 'sans-serif', codeFont: 'monospace' }, null);
    assert.ok(ops.some((op) => Array.isArray(op) && (op[0] === 'fillText' || (op[0] === 'fillRect' && op[1] > 0))), `${item.id} draws interior details`);
  }

  const textItem = { id: 'tx1', kind: 'text', x: 0.1, y: 0.1, width: 0.2, height: 0.1, text: '일반 텍스트', fontSize: 16 };
  assert.equal(overviewProxy(textItem, world, 0.03).kind, 'text');

  const codeItem = { id: 'cd1', kind: 'code', x: 0.1, y: 0.1, width: 0.22, height: 0.14, code: 'const x = 1;' };
  assert.equal(overviewProxy(codeItem, world, 0.03).kind, 'text');

  const mathItem = { id: 'm1', kind: 'math', x: 0.1, y: 0.1, width: 0.2, height: 0.12, formula: 'E = mc^2' };
  const mathProxy = overviewProxy(mathItem, world, 0.03);
  assert.equal(mathProxy.kind, 'text');
  assert.equal(mathProxy.text, 'E = mc^2');

  const imageItem = { id: 'im1', kind: 'image', x: 0.1, y: 0.1, width: 0.2, height: 0.14, src: '/api/media/a.png' };
  const imgProxy = overviewProxy(imageItem, world, 0.03);
  assert.equal(imgProxy.__imagePreview, '/api/media/a.png');
  assert.ok(overviewProxy(imageItem, world, 0.03).__imagePreview === '/api/media/a.png');
});

test('graphicsRasterRatio maintains full native DPR resolution across zoom levels', () => {
  assert.equal(graphicsRasterRatio('high', 1, 1), 1);
  assert.equal(graphicsRasterRatio('high', 1, 2), 2);
  assert.equal(graphicsRasterRatio('high', 0.4, 2), 2);
  assert.equal(graphicsRasterRatio('high', 0.2, 1), 1);
  assert.equal(graphicsRasterRatio('high', 2, 1.5), 3);
});

test('rasterDescriptor preserves shadows consistently across rich overviews and styled shapes', () => {
  const note = { id: 'n1', kind: 'note', x: 0.1, y: 0.1, width: 0.2, height: 0.14, text: 'hello' };
  const noteProxy = overviewProxy(note, world, 0.25);
  assert.notEqual(noteProxy.shadowEnabled, false);
  const noteDesc = rasterDescriptor('n1', noteProxy, world, {}, '', { lowQuality: true });
  assert.equal(noteDesc.shadow.enabled, true);

  const styledCard = { id: 's1', kind: 'shape', shape: 'rectangle', x: 0.2, y: 0.2, width: 0.2, height: 0.14, brush: '{"effects":{"shadows":[{"enabled":true}]}}' };
  const styledDesc = rasterDescriptor('s1', styledCard, world, {}, '', { lowQuality: true });
  assert.equal(styledDesc.shadow.enabled, true);

  const hiddenShadowCard = { id: 'n2', kind: 'note', x: 0.1, y: 0.1, width: 0.2, height: 0.14, text: 'no shadow', shadowEnabled: false };
  const hiddenProxy = overviewProxy(hiddenShadowCard, world, 0.25);
  const hiddenDesc = rasterDescriptor('n2', hiddenProxy, world, {}, '', { lowQuality: false });
  assert.equal(hiddenDesc.shadow.enabled, false);

  assert.notEqual(richPreviewSignature(note), richPreviewSignature({ ...note, text: 'changed' }));

  const htmlItem = { id: 'h1', kind: 'code', language: 'html', code: '<h1>Live</h1>', x: 0.1, y: 0.1, width: 0.25, height: 0.2 };
  const notebookWithOutput = {
    id: 'nb1', kind: 'shape', shapeType: 'rectangle', runtimeRole: 'notebook',
    x: 0.1, y: 0.1, width: 0.3, height: 0.22,
    notebookResults: { cell1: { exitCode: 0, outputs: [{ output_type: 'display_data', data: { 'text/html': '<p>Result</p>' } }] } },
  };
  const cellWithOutput = {
    id: 'nbc1', kind: 'shape', shapeType: 'rectangle', runtimeRole: 'notebook-cell',
    x: 0.1, y: 0.4, width: 0.3, height: 0.2,
    notebookResult: { exitCode: 0, outputs: [{ output_type: 'display_data', data: { 'image/svg+xml': '<svg></svg>' } }] },
  };
  assert.equal(isOverviewProxy(htmlItem, world, 0.08, 'high'), false);
  assert.equal(isOverviewProxy(notebookWithOutput, world, 0.08, 'high'), false);
  assert.equal(isOverviewProxy(cellWithOutput, world, 0.08, 'high'), false);
});
