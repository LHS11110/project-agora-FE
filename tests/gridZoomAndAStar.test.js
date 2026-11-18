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
import { writeObjectVisibilityPatch } from '../src/canvas/styling/objectStyleModel.js';
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

test('connector collision avoidance handles adjacent obstacles, tight gaps, wide detour chains, fixed logic ports, and stale-cache moves', () => {
  const box = (x, y, w = 0.08, h = 0.1, extra = {}) => ({
    kind: 'shape',
    shapeType: 'rectangle',
    x,
    y,
    width: w,
    height: h,
    ...extra,
  });

  // 1) Adjacent obstacle 1px right of `from` must NOT be skipped as overlapping `from`
  const adjItems = {
    a: box(0.1, 0.4, 0.1, 0.1), // x: 160..320, y: 400..500
    adj: box(321 / 1600, 0.36, 0.08, 0.18), // x: 321..449 (1px gap from `a`!)
    b: box(0.5, 0.4, 0.1, 0.1), // x: 800..960
    edge: { kind: 'connector', from: 'a', to: 'b' },
  };
  const adjGeo = connectorGeometry(adjItems.edge, adjItems, 1600, 1000);
  assert.ok(adjGeo && adjGeo.routed, 'adjacent obstacle 1px away must trigger detour');
  const adjCore = rectCoreBounds({ centerX: 321 + 64, centerY: 450, halfWidth: 64, halfHeight: 90 }, 0);
  assert.equal(pathIntersectsBoxes(adjGeo.curvePoints, [adjCore]), false, 'connector must not cut through adjacent obstacle');

  // 2) Tight corridor (< 2 * detourPad = 28px) between two obstacles around endpoint
  const tightItems = {
    a: box(0.1, 0.4, 0.08, 0.08), // x: 160..288, y: 400..480
    b: box(0.45, 0.4, 0.08, 0.08),
    topWall: box(0.22, 0.05, 0.08, 0.385), // y: 50..435
    botWall: box(0.22, 0.445, 0.08, 0.42), // y: 445..865 (10px gap between 435 and 445!)
    edge: { kind: 'connector', from: 'a', to: 'b' },
  };
  const tightGeo = connectorGeometry(tightItems.edge, tightItems, 1600, 1000);
  assert.ok(tightGeo && tightGeo.routed, 'tight-gap obstacles must still route cleanly');
  const topCore = rectCoreBounds({ centerX: 0.26 * 1600, centerY: 242.5, halfWidth: 64, halfHeight: 192.5 }, 0);
  const botCore = rectCoreBounds({ centerX: 0.26 * 1600, centerY: 655, halfWidth: 64, halfHeight: 210 }, 0);
  assert.equal(pathIntersectsBoxes(tightGeo.curvePoints, [topCore, botCore]), false, 'connector must avoid tight-gap walls');

  // 3) Tall primary wall forcing detour into secondary obstacles outside initial padPx
  const chainItems = itemSnapshot({
    a: box(0.2, 0.45, 0.05, 0.05), // x: 320..400, y: 450..500
    b: box(0.35, 0.45, 0.05, 0.05), // x: 560..640, y: 450..500 (close endpoints -> small initial pad)
    tallWall: box(0.285, 0.12, 0.03, 0.7), // x: 456..504, y: 120..820
    topCap: box(0.22, 0.02, 0.18, 0.08), // x: 352..640, y: 20..100 (sits right on upper detour!)
    botCap: box(0.22, 0.84, 0.18, 0.08), // x: 352..640, y: 840..920 (sits right on lower detour!)
    edge: { kind: 'connector', from: 'a', to: 'b' },
  });
  const chainIndex = new CanvasSpatialBTree(chainItems, world);
  const chainGeo = connectorGeometry(chainItems.edge, chainItems, 1600, 1000, chainIndex);
  assert.ok(chainGeo && chainGeo.routed, 'detour chain must route around wall and cap obstacles');
  const chainCores = [
    rectCoreBounds({ centerX: 480, centerY: 470, halfWidth: 24, halfHeight: 350 }, 0),
    rectCoreBounds({ centerX: 496, centerY: 60, halfWidth: 144, halfHeight: 40 }, 0),
    rectCoreBounds({ centerX: 496, centerY: 880, halfWidth: 144, halfHeight: 40 }, 0),
  ];
  assert.equal(pathIntersectsBoxes(chainGeo.curvePoints, chainCores), false, 'dynamic corridor expansion must avoid secondary detour obstacles');

  // 4) Logic gate with obstacle right in front of fixed output port must not cut through gate body
  const gateItems = {
    g1: { kind: 'shape', shapeType: 'logic-and', x: 0.1, y: 0.4, width: 0.1, height: 0.1 },
    g2: { kind: 'shape', shapeType: 'logic-or', x: 0.5, y: 0.4, width: 0.1, height: 0.1 },
    blocker: box(0.21, 0.36, 0.08, 0.18), // 16px right of g1 output port
    wire: { kind: 'connector', from: 'g1', to: 'g2' },
  };
  const gateGeo = connectorGeometry(gateItems.wire, gateItems, 1600, 1000);
  assert.ok(gateGeo && gateGeo.routed);
  const g1Core = rectCoreBounds({ centerX: 240, centerY: 450, halfWidth: 78, halfHeight: 48 }, 0);
  const blockerCore = rectCoreBounds({ centerX: 0.25 * 1600, centerY: 450, halfWidth: 64, halfHeight: 90 }, 0);
  assert.equal(pathIntersectsBoxes(gateGeo.curvePoints, [blockerCore]), false, 'logic wire must avoid blocker');
  assert.equal(pathIntersectsBoxes(gateGeo.curvePoints.slice(1, -1), [g1Core]), false, 'logic wire must not cut back through source gate');

  // 5) Moving an obstacle after connectorGeometry was cached must immediately re-route with no stale hit
  const moveStart = itemSnapshot({
    a: box(0.05, 0.4, 0.08, 0.08),
    b: box(0.45, 0.4, 0.08, 0.08),
    mover: box(0.7, 0.1, 0.08, 0.16),
    link: { kind: 'connector', from: 'a', to: 'b' },
  });
  const moveIndex = new CanvasSpatialBTree(moveStart, world);
  const beforeMove = connectorGeometry(moveStart.link, moveStart, 1600, 1000, moveIndex);
  assert.equal(beforeMove.routed, false);
  const movedIntoPath = changeItems(moveStart, { mover: box(0.25, 0.35, 0.08, 0.18) });
  // Simulate a pre-update read before spatial index updates
  connectorGeometry(movedIntoPath.link, movedIntoPath, 1600, 1000, moveIndex);
  moveIndex.update(movedIntoPath, world, 1, ['mover']);
  const afterMove = connectorGeometry(movedIntoPath.link, movedIntoPath, 1600, 1000, moveIndex);
  assert.equal(afterMove.routed, true, 'moving obstacle into path must invalidate cached straight route');
  const moverCore = rectCoreBounds({ centerX: 0.29 * 1600, centerY: 0.44 * 1000, halfWidth: 64, halfHeight: 90 }, 0);
  assert.equal(pathIntersectsBoxes(afterMove.curvePoints, [moverCore]), false);

  // 6) Hidden obstacle is ignored while hidden, and re-routed immediately when revealed
  const baseWall = box(0.25, 0.35, 0.08, 0.18);
  const hiddenBlocker = { ...baseWall, ...writeObjectVisibilityPatch(baseWall, { hidden: true }) };
  const hiddenItems = itemSnapshot({
    a: box(0.05, 0.4, 0.08, 0.08),
    b: box(0.45, 0.4, 0.08, 0.08),
    wall: hiddenBlocker,
    link: { kind: 'connector', from: 'a', to: 'b' },
  });
  const visIndex = new CanvasSpatialBTree(hiddenItems, world);
  assert.equal(connectorGeometry(hiddenItems.link, hiddenItems, 1600, 1000, visIndex).routed, false);
  const revealed = changeItems(hiddenItems, { wall: box(0.25, 0.35, 0.08, 0.18) });
  visIndex.update(revealed, world);
  const revealedGeo = connectorGeometry(revealed.link, revealed, 1600, 1000, visIndex);
  assert.equal(revealedGeo.routed, true, 'revealing a hidden obstacle must immediately detour the connector');
  assert.equal(pathIntersectsBoxes(revealedGeo.curvePoints, [moverCore]), false);
});
