import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import DepthVectorLayer from '../../src/canvas/DepthVectorLayer.jsx';
import SceneViewModel from '../../src/canvas/SceneViewModel.js';
import CanvasSpatialBTree from '../../src/components/CanvasSpatialBTree.js';
import { itemSnapshot, changeItems } from '../../src/canvas/itemSnapshots.js';

const world = { width: 1600, height: 1000 }, camera = { x: 0, y: 0, scale: 1 };
const initial = {};
for (let i = 0; i < 36; i++) {
  const x = 40 + i % 9 * 120, y = 40 + Math.floor(i / 9) * 100;
  const base = { x: x / 1600, y: y / 1000, width: 80 / 1600, height: 60 / 1000, shadowEnabled: false };
  initial['item' + i] = i % 3 === 0
    ? { ...base, kind: 'shape', shapeType: 'rectangle', fill: '#ff0000', color: '#ff0000', strokeEnabled: true }
    : i % 3 === 1
      ? { kind: 'stroke', color: '#ff0000', strokeWidth: 8, brush: 'pen', shadowEnabled: false, points: [{ x: (x + 5) / 1600, y: (y + 15) / 1000 }, { x: (x + 65) / 1600, y: (y + 45) / 1000 }] }
      : { ...base, kind: 'text', renderMode: 'plain', text: 'TEST', fontSize: 16 };
}
const index = new CanvasSpatialBTree(), scene = new SceneViewModel();
function Fixture() {
  const [items, setItems] = useState(() => itemSnapshot(initial));
  index.update(items, world);
  const layers = scene.update(index.query({ minX: -1, minY: -1, maxX: 2, maxY: 2 }), items, world, 1, new Set(), new Set(), index.stats.boundsCalculated, index).depthLayers;
  window.depthFixture = {
    patch: changes => setItems(current => changeItems(current, Object.fromEntries(Object.entries(changes).map(([id, patch]) => [id, { ...current[id], ...patch }])))),
    items,
    regions: Object.entries(initial).map(([id, item], i) => ({ id, x: 40 + i % 9 * 120, y: 40 + Math.floor(i / 9) * 100, red: item.kind !== 'text' })),
  };
  return <div className="canvas-stage" style={{ position: 'relative', width: 1200, height: 500 }}>
    {layers.map((layer, i) => <div key={layer.depth} className="canvas-depth-layer" data-depth={layer.depth} style={{ position: 'absolute', inset: 0, zIndex: i + 1 }}>
      <DepthVectorLayer items={layer.vectors} referenceItems={items} inkItems={layer.inkItems} worldSize={world} camera={camera} graphicsQuality="low" />
    </div>)}
  </div>;
}
const style = document.createElement('style');
style.textContent = 'body{margin:0;background:#fff}';
document.head.appendChild(style);
createRoot(document.getElementById('root')).render(<Fixture />);
