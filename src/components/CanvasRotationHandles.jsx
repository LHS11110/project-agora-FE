import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { useLayoutEffect, useState } from 'react';
import { strokeSelectionGeometry } from '../canvas/strokeSelection.js';
import { rotationAtPointer } from './objectRotation.js';
import './rotation-handles.css';

const corners = ['nw', 'ne', 'se', 'sw'];
const DEFAULT_WIDTHS = { image: 0.3, code: 0.32, shape: 0.14, math: 0.2, text: 0.22, note: 0.22, table: 0.42, link: 0.3 };
const DEFAULT_HEIGHTS = { shape: 0.12, math: 0.09, text: 0.12, note: 0.15, table: 0.32, link: 0.15 };

function findObjectElement(scene, id) {
  const key = String(id);
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return scene.querySelector(`[data-item-id="${CSS.escape(key)}"]`);
  }
  const nodes = scene.querySelectorAll('[data-item-id]');
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].dataset.itemId === key) return nodes[i];
  }
  return null;
}

function computeStaticFrame(item, viewSize) {
  const vw = Number(viewSize?.width) || 0;
  const vh = Number(viewSize?.height) || 0;
  if (!item || vw <= 0 || vh <= 0) return null;
  if (item.kind === 'stroke') {
    const geom = strokeSelectionGeometry(item, { width: vw, height: vh });
    if (!geom) return null;
    return {
      left: geom.x,
      top: geom.y,
      width: Math.max(1, geom.width),
      height: Math.max(1, geom.height),
    };
  }
  const hasExplicitHeight = Number(item.height) > 0;
  if (!hasExplicitHeight && item.kind !== 'shape') return null;
  const width = Number(item.width) || DEFAULT_WIDTHS[item.kind] || 0.2;
  const height = Number(item.height) || DEFAULT_HEIGHTS[item.kind] || 0.2;
  return {
    left: (Number(item.x) || 0) * vw,
    top: (Number(item.y) || 0) * vh,
    width: Math.max(1, width * vw),
    height: Math.max(1, height * vh),
  };
}

function getFrame(element, scene) {
  if (element.offsetParent === scene || element.offsetParent?.classList.contains('canvas-world-layer')) {
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

export default function CanvasRotationHandles({ sceneRef, id, item, viewSize, onPointerDown, onPointerMove, onPointerUp }) {
  useUiLocale();
  const elementId = String(id);
  const staticFrame = computeStaticFrame(item, viewSize);
  const [measuredFrame, setMeasuredFrame] = useState(null);

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    const element = scene && findObjectElement(scene, elementId);
    if (!scene || !element) {
      setMeasuredFrame(null);
      return undefined;
    }
    const measure = () => {
      const next = getFrame(element, scene);
      const expected = computeStaticFrame(item, viewSize);
      if (
        expected
        && Math.abs(expected.left - next.left) < 0.5
        && Math.abs(expected.top - next.top) < 0.5
        && Math.abs(expected.width - next.width) < 0.5
        && Math.abs(expected.height - next.height) < 0.5
      ) {
        setMeasuredFrame((current) => (current ? null : current));
        return;
      }
      setMeasuredFrame((current) => (
        current
        && current.id === elementId
        && current.left === next.left
        && current.top === next.top
        && current.width === next.width
        && current.height === next.height
          ? current
          : { id: elementId, ...next }
      ));
    };
    if (typeof ResizeObserver !== 'function') {
      measure();
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [elementId, item.kind, item.x, item.y, item.width, item.height, item.points, item.strokeWidth, item.rotation, viewSize?.width, viewSize?.height, sceneRef]);

  const activeFrame = measuredFrame?.id === elementId ? measuredFrame : staticFrame;
  if (!activeFrame) return null;
  const rotation = Number(item.rotation) || 0;
  return <div
    className="object-rotation-frame"
    style={{ left: activeFrame.left, top: activeFrame.top, width: activeFrame.width, height: activeFrame.height, transform: `rotate(${rotation}deg)` }}
    aria-hidden="true"
  >
    {corners.map((corner) => <span
      key={corner}
      className={`object-rotation-handle rotate-${corner}`}
      title={ui("바깥 모서리를 드래그해 회전")}
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
