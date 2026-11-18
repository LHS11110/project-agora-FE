import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANVAS_SPACE,
  MIN_CANVAS_SCALE,
  MAX_CANVAS_SCALE,
  clampCanvasScale,
  zoomCanvasCamera,
  fitCanvasCamera,
} from '../src/canvas/canvasSpace.js';
import { fitWatchCamera } from '../src/canvas/canvasWatch.js';
import { pinchCamera } from '../src/canvas/touchNavigation.js';
import {
  BASE_GRID_INTERVAL,
  DEFAULT_GRID_INTERVAL,
  gridInterval,
  activeGridInterval,
  snapPosition,
  snapNewItem,
  snappedTranslation,
  strokeGridAnchor,
} from '../src/canvas/gridPlacement.js';
import { resizeItemAtPointer, captureResize } from '../src/components/objectResize.js';
import { itemSnapshot, changeItems } from '../src/canvas/itemSnapshots.js';
import { connectorGeometry } from '../src/components/connectorGeometry.js';
import { logicConnectorGeometry } from '../src/canvas/connectors/logicConnectorGeometry.js';
import { routeConnectorAStar, pathIntersectsBoxes, rectCoreBounds } from '../src/canvas/connectors/aStarRoute.js';
import CanvasSpatialBTree from '../src/components/CanvasSpatialBTree.js';

const world = { width: 1600, height: 1000 };

test('canvas zoom enforces upper and lower bounds consistently', () => {
  assert.equal(MIN_CANVAS_SCALE, 0.1);
  assert.equal(MAX_CANVAS_SCALE, 16);
  assert.equal(clampCanvasScale(0.01), MIN_CANVAS_SCALE);
  assert.equal(clampCanvasScale(999), MAX_CANVAS_SCALE);
  assert.equal(clampCanvasScale(1.5), 1.5);

  const originCam = { x: 100, y: 50, scale: 1 };
  const vp = { width: 800, height: 600 };
  const zoomedOut = zoomCanvasCamera(originCam, 0.01, { x: 400, y: 300 }, vp);
  assert.equal(zoomedOut.scale, MIN_CANVAS_SCALE);
  assert.equal(zoomedOut.x, 400 - (400 - 100) * MIN_CANVAS_SCALE);
  assert.equal(zoomedOut.y, 300 - (300 - 50) * MIN_CANVAS_SCALE);

  const zoomedIn = zoomCanvasCamera(originCam, 100, { x: 400, y: 300 }, vp);
  assert.equal(zoomedIn.scale, MAX_CANVAS_SCALE);
  assert.equal(zoomedIn.x, 400 - (400 - 100) * MAX_CANVAS_SCALE);
  assert.equal(zoomedIn.y, 300 - (300 - 50) * MAX_CANVAS_SCALE);

  assert.equal(fitCanvasCamera({ width: 40, height: 30 }).scale, MIN_CANVAS_SCALE);
  assert.equal(fitCanvasCamera({ width: 100000, height: 100000 }).scale, 1);

  const watchTiny = fitWatchCamera({ cx: 100, cy: 100, width: 10, height: 10 }, { width: 1600, height: 1000 });
  assert.equal(watchTiny.scale, MAX_CANVAS_SCALE);
  const watchHuge = fitWatchCamera({ cx: 100, cy: 100, width: 50000, height: 50000 }, { width: 800, height: 600 });
  assert.equal(watchHuge.scale, MIN_CANVAS_SCALE);

  const maxPinch = pinchCamera(
    { x: 0, y: 0, scale: 16 },
    { x: 300, y: 200, distance: 100 },
    { x: 325, y: 215, distance: 150 },
    { left: 0, top: 0, width: 800, height: 600 }
  );
  assert.equal(maxPinch.scale, MAX_CANVAS_SCALE);
  assert.equal(maxPinch.x, 25);
  assert.equal(maxPinch.y, 15);
});

test('1px grid preserves floating-point drawing while snapping completed stroke moves back to grid', () => {
  assert.equal(BASE_GRID_INTERVAL, 1);
  assert.equal(DEFAULT_GRID_INTERVAL, 1);
  assert.equal(gridInterval(undefined), 20);
  assert.equal(gridInterval(0), 20);
  assert.equal(gridInterval(1), 1);
  assert.deepEqual(activeGridInterval(false, 20), { x: 1, y: 1 });
  assert.deepEqual(activeGridInterval(true, 20), { x: 20, y: 20 });

  const snapped = snapPosition({ x: 100.4 / world.width, y: 200.6 / world.height }, 1, world);
  assert.ok(Math.abs(snapped.x * world.width - 100) < 1e-9);
  assert.ok(Math.abs(snapped.y * world.height - 201) < 1e-9);

  const createdBox = snapNewItem(
    { kind: 'shape', shapeType: 'rectangle', x: 12.7 / 1600, y: 24.3 / 1000, width: 120.4 / 1600, height: 80.6 / 1000 },
    1,
    world
  );
  assert.ok(Math.abs(createdBox.x * 1600 - 13) < 1e-9);
  assert.ok(Math.abs(createdBox.y * 1000 - 24) < 1e-9);
  assert.ok(Math.abs(createdBox.width * 1600 - 120) < 1e-9);
  assert.ok(Math.abs(createdBox.height * 1000 - 81) < 1e-9);

  const floatStroke = {
    kind: 'stroke',
    points: [
      { x: 10.345 / 1600, y: 20.678 / 1000, pressure: 0.42 },
      { x: 55.891 / 1600, y: 77.123 / 1000, pressure: 0.65 },
    ],
  };
  const keptStroke = snapNewItem(floatStroke, 1, world);
  assert.deepEqual(keptStroke, floatStroke);

  const anchor = strokeGridAnchor(floatStroke);
  assert.ok(Math.abs(anchor.x - 10.345 / 1600) < 1e-12);
  assert.ok(Math.abs(anchor.y - 20.678 / 1000) < 1e-12);

  const moveDelta = snappedTranslation(anchor, 18.2 / 1600, 9.7 / 1000, 1, world);
  const movedX = (anchor.x + moveDelta.dx) * 1600;
  const movedY = (anchor.y + moveDelta.dy) * 1000;
  assert.ok(Math.abs(movedX - Math.round(movedX)) < 1e-9);
  assert.ok(Math.abs(movedY - Math.round(movedY)) < 1e-9);

  const rectItem = { kind: 'shape', x: 0.1, y: 0.1, width: 0.2, height: 0.2 };
  const resize = captureResize(rectItem, 'se', { x: 0.3, y: 0.3 }, { offsetWidth: 320, offsetHeight: 200 }, world);
  const resized = resizeItemAtPointer(
    rectItem,
    resize,
    { x: 0.1 + 145.6 / 1600, y: 0.1 + 91.3 / 1000 },
    world
  );
  assert.ok(Math.abs(resized.width * 1600 - 146) < 1e-9);
  assert.ok(Math.abs(resized.height * 1000 - 91) < 1e-9);
});

test('A* routing detours around concave and staggered obstacles cleanly with smooth curves', () => {
  const from = { id: 'a', centerX: 100, centerY: 300, halfWidth: 50, halfHeight: 40, rotation: 0 };
  const to = { id: 'b', centerX: 700, centerY: 300, halfWidth: 50, halfHeight: 40, rotation: 0 };
  // U-shaped wall opening to the right, blocking a straight path from a -> b
  const obstacles = [
    { id: 'wallTop', centerX: 350, centerY: 180, halfWidth: 110, halfHeight: 25, rotation: 0 },
    { id: 'wallMid', centerX: 435, centerY: 300, halfWidth: 25, halfHeight: 145, rotation: 0 },
    { id: 'wallBot', centerX: 350, centerY: 420, halfWidth: 110, halfHeight: 25, rotation: 0 },
  ];
  const anchorAt = (rect, dir) => {
    const rx = Math.abs(dir.x) > 1e-8 ? rect.halfWidth / Math.abs(dir.x) : Infinity;
    const ry = Math.abs(dir.y) > 1e-8 ? rect.halfHeight / Math.abs(dir.y) : Infinity;
    const d = Math.min(rx, ry) + 2;
    return { x: rect.centerX + dir.x * d, y: rect.centerY + dir.y * d };
  };
  const result = routeConnectorAStar({
    from,
    to,
    preferredPoints: [{ x: 152, y: 300 }, { x: 648, y: 300 }],
    obstacles,
    clearance: 14,
    anchorFn: anchorAt,
    keepOrthogonal: false,
  });
  assert.equal(result.routed, true);
  assert.ok(result.points.length >= 6);
  const coreBoxes = obstacles.map((obs) => rectCoreBounds(obs, 0));
  assert.equal(pathIntersectsBoxes(result.points, coreBoxes), false);
});

test('connectorGeometry and logicConnectorGeometry dodge obstacles smoothly across modes', () => {
  const box = (x, y, w = 0.08, h = 0.1, extra = {}) => ({
    kind: 'shape',
    shapeType: 'rectangle',
    x,
    y,
    width: w,
    height: h,
    ...extra,
  });
  const a = box(0.05, 0.25, 0.1, 0.1);
  const b = box(0.55, 0.25, 0.1, 0.1);
  const wall = box(0.3, 0.18, 0.08, 0.24);
  const wallCore = rectCoreBounds({ centerX: 0.34 * 1600, centerY: 0.3 * 1000, halfWidth: 0.04 * 1600, halfHeight: 0.12 * 1000 }, 0);

  for (const mode of ['curved', 'straight', 'orthogonal']) {
    const item = {
      kind: 'connector',
      from: 'a',
      to: 'b',
      format: JSON.stringify({ connector: { routing: mode } }),
    };
    const geo = connectorGeometry(item, { a, b, wall }, 1600, 1000);
    assert.ok(geo, `expected geometry for ${mode}`);
    assert.equal(geo.routed, true, `expected routed=true for ${mode}`);
    assert.equal(pathIntersectsBoxes(geo.curvePoints, [wallCore]), false, `${mode} path must not intersect obstacle`);
    if (mode !== 'straight') assert.ok(geo.curvePoints.length > 4);
  }

  const andGate = { kind: 'shape', shapeType: 'logic-and', x: 0.05, y: 0.25, width: 0.1, height: 0.1 };
  const orGate = { kind: 'shape', shapeType: 'logic-or', x: 0.55, y: 0.25, width: 0.1, height: 0.1 };
  const gateFrom = { id: 'g1', centerX: 0.1 * 1600, centerY: 0.3 * 1000, halfWidth: 0.05 * 1600, halfHeight: 0.05 * 1000, rotation: 0 };
  const gateTo = { id: 'g2', centerX: 0.6 * 1600, centerY: 0.3 * 1000, halfWidth: 0.05 * 1600, halfHeight: 0.05 * 1000, rotation: 0 };
  const logicObstacles = [{ id: 'wall', centerX: 0.34 * 1600, centerY: 0.3 * 1000, halfWidth: 0.04 * 1600, halfHeight: 0.12 * 1000, rotation: 0 }];
  const logicGeo = logicConnectorGeometry(
    { kind: 'connector', from: 'g1', to: 'g2' },
    andGate,
    orGate,
    gateFrom,
    gateTo,
    world,
    (rect, dx, dy) => {
      const rx = Math.abs(dx) > 1e-8 ? rect.halfWidth / Math.abs(dx) : Infinity;
      const ry = Math.abs(dy) > 1e-8 ? rect.halfHeight / Math.abs(dy) : Infinity;
      return Math.min(rx, ry);
    },
    logicObstacles
  );
  assert.ok(logicGeo);
  assert.equal(logicGeo.routed, true);
  assert.equal(pathIntersectsBoxes(logicGeo.curvePoints, [wallCore]), false);
});

test('CanvasSpatialBTree selectively invalidates only connectors whose corridor hits moved obstacles', () => {
  const box = (x, y, w = 0.08, h = 0.08) => ({ kind: 'shape', shapeType: 'rectangle', x, y, width: w, height: h });
  const initial = itemSnapshot({
    a1: box(0.05, 0.05),
    b1: box(0.35, 0.05),
    link1: { kind: 'connector', from: 'a1', to: 'b1' },
    a2: box(0.05, 0.75),
    b2: box(0.35, 0.75),
    link2: { kind: 'connector', from: 'a2', to: 'b2' },
    mover: box(0.6, 0.75),
  });
  const index = new CanvasSpatialBTree(initial, world);
  const link1EntryBefore = index.entries.get('link1');
  const link2EntryBefore = index.entries.get('link2');
  const boundsBefore = index.stats.boundsCalculated;
  assert.ok(link1EntryBefore?.corridor && link2EntryBefore?.corridor);

  // Move `mover` into `link1`'s horizontal corridor at y=0.05 without touching `link2` at y=0.75
  const updated = changeItems(initial, { mover: box(0.2, 0.03, 0.08, 0.12) });
  index.update(updated, world);
  assert.notEqual(index.entries.get('link1'), link1EntryBefore);
  assert.equal(index.entries.get('link2'), link2EntryBefore);
  assert.equal(index.stats.boundsCalculated - boundsBefore, 2);
});
