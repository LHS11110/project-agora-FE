import { useLayoutEffect, useState } from 'react';
import { groupLayout } from '../canvas/groupGeometry.js';
import './rotation-handles.css';

export default function GroupRotationHandles({ sceneRef, ids, items, viewSize, onPointerDown, onPointerMove, onPointerUp }) {
  const [layout, setLayout] = useState(null);
  const idsKey = ids.join('|');
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return undefined;
    const measure = () => setLayout(groupLayout(scene, ids, items, viewSize));
    measure();
    const observer = new ResizeObserver(measure);
    scene.querySelectorAll('[data-item-id]').forEach(element => { if (ids.includes(element.dataset.itemId)) observer.observe(element); });
    return () => observer.disconnect();
  }, [sceneRef, idsKey, items, viewSize.width, viewSize.height]);
  if (!layout) return null;
  const { left, top, width, height } = layout;
  return <div className="object-rotation-frame group-rotation-frame" style={{ left, top, width, height }}>
    <span className="group-rotation-label">그룹 · {ids.length}개</span>
    {['nw', 'ne', 'se', 'sw'].map(corner => <span key={corner} className={`object-rotation-handle rotate-${corner}`} title="그룹 전체 회전"
      onPointerDown={event => { if (event.button === 0) onPointerDown(event, ids, layout); }}
      onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />)}
  </div>;
}
