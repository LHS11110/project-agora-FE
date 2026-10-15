import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import DepthVectorLayer from '../../src/canvas/DepthVectorLayer.jsx';
import ShapeBorderControls from '../../src/canvas/ShapeBorderControls.jsx';
import ShapeGeometryControls from '../../src/canvas/ShapeGeometryControls.jsx';
import ShapeFillControls from '../../src/canvas/ShapeFillControls.jsx';
import VectorStyleControls from '../../src/canvas/VectorStyleControls.jsx';
import { drawVectorItems } from '../../src/canvas/drawVectorItems.js';
import { canvasGraphics } from '../../src/canvas/canvasGraphics.js';
import { shapeOutlinePaths } from '../../src/canvas/shapeGeometry.js';
import { sketchHatchPaths } from '../../src/canvas/vectorStyle.js';
import '../../src/styles.css';
function Fixture() {
  const [item, setItem] = useState({ kind: 'shape', shadowEnabled: false, shapeType: 'polygon', vertexCount: 6, width: .5, height: .6, x: .1, y: .1, color: '#123456', fill: '#dd4422', visualStyle: 'standard' });
  const canvas = useRef();
  const change = (field, value) => setItem(current => ({ ...current, [field]: value }));
  useEffect(() => {
    const context = canvas.current.getContext('2d');
    context.clearRect(0, 0, 800, 600); drawVectorItems(canvasGraphics(context), { a: item }, 800, 600);
    window.patchShape = patch => setItem(current => ({ ...current, ...patch }));
    window.shapeState = { ...item, contourPoints: shapeOutlinePaths(item.shapeType, 400, 360, item)[0].length, hatchCount: sketchHatchPaths(shapeOutlinePaths(item.shapeType, 400, 360, item)[0], 'a', undefined, item.fillOpacity ?? 1, item.sketchFillOpacity ?? .8).length };
  }, [item]);
  return <div className="canvas-app-page"><aside className="canvas-inspector" style={{ width: 300 }}>
    <ShapeGeometryControls item={item} onChange={change} />
    <ShapeBorderControls width={item.strokeWidth} enabled={item.strokeEnabled !== false} color={item.color} onWidthChange={value => change('strokeWidth', value)} onEnabledChange={value => change('strokeEnabled', value)} onColorChange={value => change('color', value)} favoriteColors={[]} />
    <VectorStyleControls value={item.visualStyle} onChange={value => change('visualStyle', value)} />
    <ShapeFillControls inkOpacity={item.sketchFillOpacity} onInkOpacityChange={value => change('sketchFillOpacity', value)} value={item.fill} opacity={item.fillOpacity} visualStyle={item.visualStyle} onChange={value => change('fill', value)} onOpacityChange={value => change('fillOpacity', value)} favoriteColors={[]} />
    </aside><canvas id="direct-paint" ref={canvas} width="800" height="600" /><div id="renderer-stage" style={{ position: 'relative', width: 800, height: 600, flexShrink: 0, background: '#fff' }}><DepthVectorLayer items={{ a: item }} referenceItems={{ a: item }} worldSize={{ width: 800, height: 600 }} camera={{ x: 0, y: 0, scale: 1 }} graphicsQuality="low" /></div></div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
