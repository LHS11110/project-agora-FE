import test from 'node:test';
import assert from 'node:assert/strict';
import SceneViewModel from '../src/canvas/SceneViewModel.js';
import { strokeSvgData } from '../src/canvas/inkStrokeRenderer.js';
import { defaultAnimation } from '../src/canvas/portfolio/portfolioModel.js';
import { itemSnapshot } from '../src/canvas/itemSnapshots.js';

const world = { width: 1600, height: 1000 };

test('completed strokes of any size route to vector inkItems instead of bitmap-capped vectors at every zoom', () => {
  const tinyStroke = {
    kind: 'stroke',
    brush: 'pen',
    strokeWidth: 2,
    complete: true,
    color: '#1e293b',
    points: [{ x: 0.1, y: 0.1 }, { x: 0.102, y: 0.102 }],
  };
  const hugeStroke = {
    kind: 'stroke',
    brush: 'ink',
    strokeWidth: 12,
    complete: true,
    color: '#0f172a',
    points: [{ x: -10, y: -8 }, { x: 15, y: 12 }, { x: 30, y: -4 }],
  };
  const animatedStroke = {
    kind: 'stroke',
    brush: 'pen',
    strokeWidth: 4,
    complete: true,
    color: '#2563eb',
    points: [{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.35 }],
    animation: { ...defaultAnimation(), effect: 'pulse', loop: true },
    animationPlayback: { action: 'play', startedAt: Date.now(), config: { duration: 1000, delay: 0, loop: true } },
  };
  const items = itemSnapshot({ tiny: tinyStroke, huge: hugeStroke, anim: animatedStroke });
  const entries = [
    { id: 'tiny', item: tinyStroke, bounds: { minX: 0.09, minY: 0.09, maxX: 0.11, maxY: 0.11 } },
    { id: 'huge', item: hugeStroke, bounds: { minX: -10, minY: -8, maxX: 30, maxY: 12 } },
    { id: 'anim', item: animatedStroke, bounds: { minX: 0.19, minY: 0.19, maxX: 0.41, maxY: 0.36 } },
  ];

  const scene = new SceneViewModel();
  for (const scale of [0.1, 1, 8, 16]) {
    scene.update(entries, items, world, scale, new Set(), new Set(['tiny']));
    const layer = scene.depthLayers[0];
    assert.equal(layer.vectors.tiny, undefined, `tiny stroke must not be bitmap-cached at scale ${scale}`);
    assert.equal(layer.vectors.huge, undefined, `huge stroke must not be bitmap-cached at scale ${scale}`);
    assert.equal(layer.vectors.anim, undefined, `animated stroke must not be bitmap-cached at scale ${scale}`);
    assert.equal(layer.inkItems.huge, hugeStroke, `huge stroke must render via vector ink surface at scale ${scale}`);
    assert.equal(layer.inkItems.tiny?.__selectionOutline, true, 'selected non-DOM ink stroke retains selection outline flag');
    assert.equal(layer.inkItems.anim, undefined, 'animated stroke must render exclusively through DOM AnimatedVector');
    assert.ok(layer.domObjects.some(([id]) => id === 'anim'), 'animated stroke must be mounted in DOM layer');
  }
});

test('strokeSvgData generates resolution-independent vector SVG curves for every brush and huge/tiny scales', () => {
  const brushes = ['pen', 'ink', 'highlighter', 'spray', undefined];
  for (const brush of brushes) {
    const huge = {
      kind: 'stroke',
      brush,
      strokeWidth: 8,
      color: '#111827',
      rotation: 15,
      points: [
        { x: 0, y: 0, pressure: 0.4 },
        { x: 12.5, y: 6.25, pressure: 0.8 },
        { x: 25, y: 18.75, pressure: 0.5 },
      ],
    };
    const svg = strokeSvgData(huge, world.width, world.height);
    assert.ok(svg && svg.d.length > 10, `expected vector path for brush=${brush}`);
    assert.ok(svg.width > 39000 && svg.height > 18000, `vector SVG preserves full unclipped world dimensions for brush=${brush}`);
    assert.equal(svg.rotation, 15);
    if (brush === 'pen' || brush === 'ink') {
      assert.match(svg.d, /Q/, `brush=${brush} outline should use smooth quadratic curves`);
      assert.equal(svg.isFilled, true);
    }
    if (brush === 'ink') {
      assert.equal(svg.isBrush, true);
      assert.ok(Array.isArray(svg.bristles) && svg.bristles.length === 3, 'ink brush should include 3 smooth bristle paths');
    }
    if (brush === 'highlighter') {
      assert.equal(svg.isFilled, true);
      assert.ok(svg.opacity < 0.5);
    }
    if (brush === 'spray') {
      assert.equal(svg.isFilled, true);
      assert.match(svg.d, /A/);
    }
    if (brush === undefined) {
      assert.equal(svg.isFilled, false);
    }
  }

  const tinyDot = { kind: 'stroke', brush: 'pen', strokeWidth: 2, color: '#000000', points: [{ x: 0.5, y: 0.5 }] };
  const dotSvg = strokeSvgData(tinyDot, world.width, world.height);
  assert.ok(dotSvg && dotSvg.d.length > 5 && dotSvg.isFilled);
});
