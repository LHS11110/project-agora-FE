import React, { useCallback, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import useCanvasKeyboardNudge from '../../src/canvas/useCanvasKeyboardNudge.js';
import { translateItem } from '../../src/canvas/host/hostOperations.js';
const initial = { box: { kind: 'shape', x: .1, y: .1 }, ink: { kind: 'stroke', points: [{ x: .2, y: .3, pressure: .5 }, { x: .4, y: .5, pressure: .8 }] }, connector: { kind: 'connector', from: 'box', to: 'ink' } };
function Fixture() {
  const [items, setItems] = useState(initial), itemsRef = useRef(items);
  const sessionRef = useRef({ editable: true }), dragRef = useRef(null), stats = useRef({ moves: [], flushes: 0 });
  const [options, setOptions] = useState({ activeTool: 'select', editingId: null, selectedIds: ['box', 'ink', 'connector'] });
  const moveItems = useCallback((ids, dx, dy) => {
    stats.current.moves.push({ ids, dx, dy });
    const next = { ...itemsRef.current };
    for (const id of ids) next[id] = translateItem(next[id], dx, dy);
    itemsRef.current = next; setItems(next); return true;
  }, []);
  const flushMoves = useCallback(() => { stats.current.flushes++; }, []);
  useCanvasKeyboardNudge({ ...options, itemsRef, sessionRef, dragRef, moveItems, flushMoves });
  window.nudgeFixture = { items, stats: stats.current, options, setOptions, setEditable: value => { sessionRef.current.editable = value; }, setDragging: value => { dragRef.current = value; } };
  return <div><div id="board" tabIndex={0}>Canvas</div><input aria-label="Numeric setting" type="number" defaultValue="5" /><input aria-label="Range setting" type="range" /><textarea aria-label="Text editor" /><div contentEditable suppressContentEditableWarning role="textbox" aria-label="Rich editor">text</div><div role="dialog"><div id="dialog-content" tabIndex={0}>Modal content</div></div></div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
