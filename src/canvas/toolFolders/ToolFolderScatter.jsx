import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ToolLabel } from './FolderTool.jsx';
import { toolsById } from './folderModel.js';

export default function ToolFolderScatter({ flights, panelRef, onFinish }) {
  const host = useRef(null);
  useLayoutEffect(() => {
    if (!flights.length) return undefined;
    let canceled = false;
    const animations = [];
    for (const [index, flight] of flights.entries()) {
      const ghost = host.current?.children[index];
      const destination = panelRef.current?.querySelector(`[data-folder-tool-id="${flight.toolId}"]`);
      const target = destination?.getBoundingClientRect();
      if (!ghost || !target) continue;
      const dx = target.left - flight.x, dy = target.top - flight.y;
      const spread = (index % 2 ? 1 : -1) * (36 + index * 9);
      animations.push(ghost.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx * .35 + spread}px,${dy * .25 - 30}px) rotate(${index % 2 ? 16 : -16}deg)`, opacity: .95, offset: .4 },
        { transform: `translate(${dx}px,${dy}px) rotate(0deg)`, opacity: 0 },
      ], { duration: 650 + index * 35, easing: 'cubic-bezier(.22,.68,.2,1)', fill: 'forwards' }));
    }
    const finish = () => { if (!canceled) onFinish(); };
    const timer = setTimeout(finish, 1200);
    Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(finish);
    return () => { canceled = true; clearTimeout(timer); animations.forEach(animation => animation.cancel()); };
  }, [flights]);
  if (!flights.length) return null;
  return createPortal(<div ref={host} className="tool-folder-scatter-layer" aria-hidden="true">{flights.map(flight => <div key={flight.toolId} className="tool-folder-scatter-chip" style={{ left: flight.x, top: flight.y, width: flight.width, '--scatter-color': flight.color }}><ToolLabel tool={toolsById[flight.toolId]} /></div>)}</div>, document.body);
}
