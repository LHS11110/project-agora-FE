import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CanvasObject from '../../src/canvas/CanvasObject.jsx';
import '../../src/styles.css';

const noop = () => {};
function Fixture() {
  const [item, setItem] = useState({ kind: 'text', x: .1, y: .1, width: .3, text: '# Heading\nBody\n> Quote', renderMode: 'markdown', color: '#c23456' });
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    window.patchTextFixture = patch => setItem(current => ({ ...current, ...patch }));
    window.editTextFixture = setEditing;
    return () => { delete window.patchTextFixture; delete window.editTextFixture; };
  }, []);
  return <div className="canvas-app-page"><div className="canvas-stage" style={{ width: 1600, height: 1000 }}>
    <CanvasObject id="text-fixture" item={item} viewSize={{ width: 1600, height: 1000 }} selected editing={editing} activeTool="select"
      onTextChange={noop} onPointerDown={noop} onResizeStart={noop} onStopEditing={noop} onSave={noop} />
  </div></div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
