import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as Automerge from '@automerge/automerge/slim';
import wasmUrl from '@automerge/automerge/automerge.wasm?url';
import CanvasObject from '../../src/canvas/CanvasObject.jsx';
import { encodeBase64, makeCollaborativeItem } from '../../src/canvas/collaborativeSync.js';
import { loadItemDoc } from '../../src/canvas/host/hostOperations.js';
import { applyTextColor } from '../../src/canvas/content/textColors.js';
import '../../src/styles.css';

await Automerge.initializeWasm(wasmUrl);
const noop = () => {};
function Fixture() {
  const [item, setItem] = useState(() => makeCollaborativeItem({ kind:'text', x:.1, y:.1, width:.3, text:'# Heading\nHello world', renderMode:'markdown' }));
  const [editing, setEditing] = useState(true);
  useEffect(() => { window.patchTextFixture = patch => setItem(current => ({...current,...patch})); window.editTextFixture = setEditing; return () => { delete window.patchTextFixture; delete window.editTextFixture; }; }, []);
  const color = (_id, start, end, value) => setItem(current => {
    const doc = applyTextColor(loadItemDoc(current),start,end,value);
    return {...current,automerge_snapshot:encodeBase64(Automerge.save(doc)),automerge_changes:[]};
  });
  return <div className="canvas-app-page"><div className="canvas-stage" style={{width:1600,height:1000}}>
    <CanvasObject id="range-fixture" item={item} viewSize={{width:1600,height:1000}} selected editing={editing} activeTool="select"
      onTextChange={noop} onTextColorChange={color} onPointerDown={noop} onResizeStart={noop} onStopEditing={() => setEditing(false)} onSave={noop} />
  </div></div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
