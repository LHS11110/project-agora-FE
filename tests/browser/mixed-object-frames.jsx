import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useCanvasCamera } from '../../src/canvas/useCanvasCamera.js';
import CanvasLayerObjects from '../../src/canvas/CanvasLayerObjects.jsx';
import DepthVectorLayer from '../../src/canvas/DepthVectorLayer.jsx';
import { createTableData } from '../../src/components/tableModel.js';
import { itemSnapshot } from '../../src/canvas/itemSnapshots.js';
import { CANVAS_SPACE } from '../../src/canvas/canvasSpace.js';
import '../../src/styles.css';
import '../../src/vector-editor.css';
import '../../src/canvas/canvas-studio.css';
import '../../src/canvas/styling/object-styling.css';

const mode = new URLSearchParams(location.search).get('type') || 'mixed';
const types = ['pdf', 'image', 'code', 'drawing', 'matrix', 'table', 'notebook', 'youtube'];
const sceneTypes = mode === 'mixed' ? types : mode === 'empty' ? [] : Array(4).fill(mode);
const source = Array.from({ length: 64 }, (_, i) => `value_${i} = max([math.sqrt(x) for x in range(${i + 1})])`).join('\n');
const image = document.createElement('canvas');
image.width = 1920;
image.height = 1080;
const ctx = image.getContext('2d');
for (let i = 0; i < 256; i++) {
  ctx.fillStyle = `hsl(${i * 113 % 360} 58% 57%)`;
  ctx.fillRect((i % 16) * 120, Math.floor(i / 16) * 68, 120, 68);
}
const imageSource = image.toDataURL('image/jpeg');
const entries = sceneTypes.map((type, i) => {
  const columns = mode === 'mixed' ? 4 : 2;
  const width = mode === 'mixed' ? 0.14 : 0.23;
  const height = 0.28;
  const x = 0.04 + (i % columns) * (width + 0.045);
  const y = 0.065 + Math.floor(i / columns) * 0.38;
  const payload = {
    pdf: { kind: 'pdf', src: '/api/canvases/1/pdfs/11111111-1111-4111-8111-111111111111', filename: 'vector.pdf' },
    image: { kind: 'image', src: imageSource },
    code: { kind: 'code', language: 'python', code: source },
    drawing: { kind: 'stroke', strokeWidth: 3, color: '#6d55aa', complete: true, points: Array.from({ length: 600 }, (_, j) => ({ x: x + j * width / 600, y: y + height * (0.5 + 0.45 * Math.sin(j / 30)), pressure: 0.5 })) },
    matrix: { kind: 'math', formula: '\\begin{bmatrix}' + Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => r * c).join('&')).join('\\\\') + '\\end{bmatrix}' },
    table: { kind: 'table', ...createTableData(24, 12) },
    notebook: { kind: 'shape', shapeType: 'rectangle', runtimeRole: 'notebook', notebookCells: Array.from({ length: 8 }, (_, j) => ({ id: `cell-${j}`, cellType: 'code', source })), notebookResults: {} },
    youtube: { kind: 'link', mediaType: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'YouTube' },
  }[type];
  const item = { x, y, width, height, ...payload };
  return [`${type}-${i}`, item, { minX: x, minY: y, maxX: x + width, maxY: y + height }];
});
const items = itemSnapshot(Object.fromEntries(entries));
const drawing = itemSnapshot(Object.fromEntries(entries.filter(([, item]) => item.kind === 'stroke')));
const objects = entries.filter(([, item]) => item.kind !== 'stroke');
const runtimeStore = { get: () => null, subscribe: () => () => {} };
const empty = new Set(), noEditors = new Map(), actions = { onQuestionChange() {}, onPointerDown() {} };

function App() {
  const stage = useRef(null), scene = useRef(null);
  const [camera, setCamera] = useCanvasCamera(stage, scene);
  window.mixedFrameFixture = { setCamera, camera, count: entries.length };
  return <main className="canvas-app-page">
    <div ref={stage} className="canvas-stage" data-grid-spacing-x="32" data-grid-spacing-y="40"
      style={{ position: 'relative', width: 1200, height: 760, overflow: 'hidden', flex: 'none' }}>
      <div className="canvas-grid-surface" aria-hidden="true" />
      <div ref={scene} className="canvas-scene">
        <div className="canvas-world-layer" style={{ position: 'absolute', width: 1600, height: 1000, transformOrigin: 'top left' }}>
          <CanvasLayerObjects objects={objects} allItems={items} world={CANVAS_SPACE} scale={camera.detailScale}
            runtimeStore={runtimeStore} selected={empty} activeTool="select" dirtyItems={empty} editorsByItem={noEditors} actions={actions} />
        </div>
      </div>
      <DepthVectorLayer items={drawing} referenceItems={items} worldSize={CANVAS_SPACE} camera={camera} graphicsQuality="high" />
    </div>
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
