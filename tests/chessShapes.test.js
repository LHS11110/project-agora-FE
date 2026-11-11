import test from 'node:test';
import assert from 'node:assert/strict';
import { chessShapeCatalog, chessShapeGeometry, isChessShape } from '../src/canvas/chessShapes.js';
import { shapeCatalog, shapeCategories, shapeCreationSize } from '../src/canvas/shapeCatalog.js';
import { shapeOutlinePaths, shapeFillPaths } from '../src/canvas/shapeGeometry.js';
import { drawVectorItems } from '../src/canvas/drawVectorItems.js';
import { translate } from '../src/i18n/locale.js';

test('all chess shapes have unique IDs, valid category and English labels', () => {
  assert.equal(chessShapeCatalog.length, 6);
  assert.equal(new Set(chessShapeCatalog.map(s => s.id)).size, chessShapeCatalog.length);
  assert.equal(shapeCategories.chess, '체스');
  assert.equal(translate(shapeCategories.chess, 'en'), 'Chess');

  for (const s of chessShapeCatalog) {
    assert.equal(s.category, 'chess');
    assert.ok(isChessShape(s.id));
    const catalogItem = shapeCatalog.find(item => item.id === s.id);
    assert.ok(catalogItem, `Shape ${s.id} not found in shapeCatalog`);
    assert.ok(!/[가-힣]/.test(translate(s.label, 'en')), `Missing English translation for ${s.label}`);
  }
});

test('chess pieces have finite geometry, accurate bounds and closed fill silhouettes', () => {
  for (const s of chessShapeCatalog) {
    for (const [w, h] of [[320, 400], [40, 32], [800, 1000]]) {
      const g = chessShapeGeometry(s.id, w, h);
      assert.ok(g, s.id);
      assert.deepEqual(g.paths, shapeOutlinePaths(s.id, w, h));
      assert.deepEqual(g.fills, shapeFillPaths(s.id, w, h));

      const points = g.paths.flat();
      assert.ok(points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= -1e-6 && p.y >= -1e-6 && p.x <= w + 1e-6 && p.y <= h + 1e-6), s.id);

      assert.ok(g.fills.length >= 1, `Expected at least one fill for ${s.id}`);
      for (const fill of g.fills) {
        assert.ok(fill.length >= 4, `${s.id} fill too small`);
        assert.deepEqual(fill[0], fill.at(-1), `${s.id} fill is not closed`);
      }

      const size = shapeCreationSize(s.id, { width: 1600, height: 1000 });
      assert.ok(Math.abs(size.width * 1600 / (size.height * 1000) - s.aspect) < 1e-6);
    }
  }
});

test('drawVectorItems renders all chess shapes in standard and sketch visual styles', () => {
  const g = {};
  for (const key of ['clear', 'moveTo', 'lineTo', 'poly', 'circle', 'fill', 'stroke']) g[key] = () => g;

  for (const visualStyle of ['standard', 'sketch']) {
    const items = Object.fromEntries(chessShapeCatalog.map((s, i) => [
      `chess-${i}`,
      { kind: 'shape', shapeType: s.id, x: i * 0.15, y: 0.1, width: 0.12, height: 0.15, fill: '#f0d9b5', color: '#333333', visualStyle }
    ]));
    assert.doesNotThrow(() => drawVectorItems(g, items, 1600, 1000));
  }
});
