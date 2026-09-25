import { useLayoutEffect, useState } from 'react';
import { rotationAtPointer } from './objectRotation.js';
import './rotation-handles.css';

function findObjectElement(scene, id) {
  return [...scene.querySelectorAll('[data-item-id]')]
    .find((element) => element.dataset.itemId === String(id));
}

function getFrame(element, scene) {
  if (element.offsetParent === scene) {
    return {
      left: element.offsetLeft,
      top: element.offsetTop,
      width: Math.max(1, element.offsetWidth),
      height: Math.max(1, element.offsetHeight),
    };
  }
  const elementRect = element.getBoundingClientRect();
  const sceneRect = scene.getBoundingClientRect();
  const scale = scene.offsetWidth ? sceneRect.width / scene.offsetWidth : 1;
  return {
    left: (elementRect.left - sceneRect.left) / scale,
    top: (elementRect.top - sceneRect.top) / scale,
    width: Math.max(1, elementRect.width / scale),
    height: Math.max(1, elementRect.height / scale),
  };
}

export default function CanvasRotationHandles({ sceneRef, id, item, onPointerDown, onPointerMove, onPointerUp }) {
  const [frame, setFrame] = useState(null);

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    const element = scene && findObjectElement(scene, id);
    if (!scene || !element) {
      setFrame(null);
      return undefined;
    }
    const measure = () => {
      const next = getFrame(element, scene);
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
  }, [id, item.kind, item.x, item.y, item.width, item.height, item.points, item.rotation, sceneRef]);

  if (!frame) return null;
  const rotation = Number(item.rotation) || 0;
  return <div className="object-rotation-frame" style={{ ...frame, transform: `rotate(${rotation}deg)` }} aria-hidden="true">
    <span
      className="object-rotation-handle rotate-n"
      title="드래그해 마우스 방향으로 회전"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        onPointerDown(event, id, item);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  </div>;
}

export { rotationAtPointer };
