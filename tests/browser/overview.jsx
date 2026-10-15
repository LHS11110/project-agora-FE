import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import DepthVectorLayer from '../../src/canvas/DepthVectorLayer.jsx';
import SceneViewModel from '../../src/canvas/SceneViewModel.js';
import { itemSnapshot } from '../../src/canvas/itemSnapshots.js';
import { overviewScale } from '../../src/canvas/sceneRepresentation.js';
const world = { width: 1600, height: 1000 }, count = 10000;
const sources = Array.from({ length: 200 }, (_, i) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#e64a4a"/><rect x="100" width="100" height="120" fill="#2459dc"/><desc>${i}</desc></svg>`));
const raw = Object.fromEntries(Array.from({ length: count }, (_, i) => ['o' + i, {
  kind: i % 2 ? 'text' : 'image', x: (20 + i % 100 * 240) / 1600, y: (20 + Math.floor(i / 100) * 160) / 1000,
  width: 200 / 1600, height: 120 / 1000, renderMode: 'markdown', text: 'Label ' + i,
  fontSize: 24, src: sources[Math.floor(i / 2) % sources.length], imageFrameEnabled: false, shadowEnabled: false,
}]));
const items = itemSnapshot(raw), scene = new SceneViewModel();
const entries = Object.entries(raw).map(([id, item]) => ({ id, item, bounds: { minX: item.x, minY: item.y, maxX: item.x + item.width, maxY: item.y + item.height } }));
function Fixture() {
  const [mode, setMode] = useState('boxes');
  const [token, setToken] = useState('account-a');
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: .05 });
  const scale = overviewScale(camera.scale);
  const vectors = useMemo(() => mode === 'boxes'
    ? itemSnapshot(Object.fromEntries(entries.map(({ id, item }) => [id, { kind: 'shape', shapeType: 'rectangle', x: item.x, y: item.y, width: item.width, height: item.height, fill: item.kind === 'image' ? '#eaded4' : '#e1e9e2', strokeEnabled: false, shadowEnabled: false }])))
    : scene.update(entries, items, world, scale, new Set(), new Set()).depthLayers[0].vectors, [mode, scale]);
  window.overviewFixture = { setMode, setCamera, setToken, count };
  return <div className="canvas-stage" style={{ position: 'relative', width: 1200, height: 800 }}>
    <DepthVectorLayer token={token} items={vectors} referenceItems={items} worldSize={world} camera={camera} graphicsQuality="low" />
  </div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
