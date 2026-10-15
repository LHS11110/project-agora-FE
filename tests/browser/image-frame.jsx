import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import CanvasObject from '../../src/canvas/CanvasObject.jsx';
import ImageFrameControls from '../../src/canvas/ImageFrameControls.jsx';
import '../../src/styles.css';
const src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><rect width="320" height="160" fill="#e37e7e"/></svg>');
const noop = () => {};
function Fixture() {
  const [item, setItem] = useState({ kind: 'image', x: .1, y: .2, width: .3, height: .2, filename: 'fixture.svg', src, shadowEnabled: false });
  return <div className="canvas-app-page">
    <ImageFrameControls item={item} onChange={imageFrameEnabled => setItem(current => ({ ...current, imageFrameEnabled }))} />
    <div className="canvas-stage" style={{ width: 1600, height: 1000, flex: 'none' }}>
      <CanvasObject id="image-fixture" item={item} viewSize={{ width: 1600, height: 1000 }} selected allowSingleSelectionControls activeTool="select" onPointerDown={noop} onResizeStart={noop} />
    </div>
  </div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
