import { useLayoutEffect, useState } from 'react';
import { rotationAtPointer } from './objectRotation.js';
import './rotation-handles.css';

const corners = ['nw', 'ne', 'se', 'sw'];

function findObjectElement(scene, id) {
  return [...scene.querySelectorAll('[data-item-id]')]
    .find((element) => element.dataset.itemId === String(id));
}

function getFrame(element, scene, item, viewSize) {
  if (item.kind === 'stroke' && Array.isArray(item.points) && item.points.length) {
    const pointBounds = item.points.reduce((bounds, point) => ({
      minX: Math.min(bounds.minX, Number(point.x) || 0),
      minY: Math.min(bounds.minY, Number(point.y) || 0),
      maxX: Math.max(bounds.maxX, Number(point.x) || 0),
      maxY: Math.max(bounds.maxY, Number(point.y) || 0),
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    const pad = Math.max(2, (Number(item.strokeWidth) || 3.5) / 2);
    return {
      left: pointBounds.minX * viewSize.width - pad,
      top: pointBounds.minY * viewSize.height - pad,
      width: Math.max(1, (pointBounds.maxX - pointBounds.minX) * viewSize.width + pad * 2),
      height: Math.max(1, (pointBounds.maxY - pointBounds.minY) * viewSize.height + pad * 2),
    };
  }

  if (element.offsetParent === scene) {
    return {
      left: element.offsetLeft,
      top: element.offsetTop,
      width: Math.max(1, element.offsetWidth),
      height: Math.max(1, element.offsetHeight),
    };
  }
  return {
    left: Number.parseFloat(element.style.left) || 0,
    top: Number.parseFloat(element.style.top) || 0,
    width: Math.max(1, element.offsetWidth),
    height: Math.max(1, element.offsetHeight),
  };
}

export default function RotationHandles({ sceneRef, id, item, viewSize, onPointerDown, onPointerMove, onPointerUp }) {
  const [frame, setFrame] = useState(null);

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    const element = scene && findObjectElement(scene, id);
    if (!scene || !element) {
      setFrame(null);
      return undefined;
    }
    const measure = () => {
      const next = getFrame(element, scene, item, viewSize);
      setFrame((current) => current
        && current.left === next.left
        && current.top === next.top
        && current.width === next.width
        && current.height === next.height
        ? current
        : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [id, item.kind, item.x, item.y, item.width, item.height, item.points, item.strokeWidth, sceneRef, viewSize.width, viewSize.height]);

  if (!frame) return null;
  const rotation = Number(item.rotation) || 0;
  return <div className="object-rotation-frame" style={{ ...frame, transform: `rotate(${rotation}deg)` }} aria-hidden="true">
    {corners.map((corner) => <span
      key={corner}
      className={`object-rotation-handle rotate-${corner}`}
      title="바깥 모서리를 드래그해 회전"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        onPointerDown(event, id, item);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />)}
  </div>;
}

export { rotationAtPointer };
