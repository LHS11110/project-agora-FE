import { contentMode, isTextContent } from './content/contentPresentation.js';
import { objectFontSize, objectBaseFontSize, hasIndependentContentSize } from './objectSize.js';
import './object-size-controls.css';
import { Children, Fragment, cloneElement, isValidElement, useLayoutEffect, useRef, useState } from 'react';
import ResizeHandles from '../components/ResizeHandles.jsx';
import { isContentScalable, objectContentScale } from './objectContentScale.js';
import './scalable-object-content.css';

const observedContentNodes = new WeakMap();
let sharedContentResizeObserver = null;
function ensureContentResizeObserver() {
  if (sharedContentResizeObserver || typeof ResizeObserver !== 'function') return sharedContentResizeObserver;
  sharedContentResizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const callback = observedContentNodes.get(entry.target);
      if (callback) callback(entry);
    }
  });
  return sharedContentResizeObserver;
}

function ScalableObjectContent({ children, className, scaleX, scaleY, fixedHeight, fillSpace, fontScale }) {
  // Axis scales describe the available box, not stretching of its contents.
  const fittedScale = fontScale ?? Math.min(scaleX, scaleY);
  const contentRef = useRef(null);
  const [height, setHeight] = useState(1);
  useLayoutEffect(() => {
    if (fixedHeight) return undefined;
    const content = contentRef.current;
    if (!content) return undefined;
    const measure = (entry) => {
      const block = entry?.borderBoxSize?.[0]?.blockSize;
      const next = (Number.isFinite(block) && block > 0 ? block : content.offsetHeight) * fittedScale;
      setHeight((prev) => (prev === next ? prev : next));
    };
    const observer = ensureContentResizeObserver();
    if (observer) {
      observedContentNodes.set(content, measure);
      observer.observe(content);
      return () => {
        observedContentNodes.delete(content);
        observer.unobserve(content);
      };
    }
    measure();
    return undefined;
  }, [scaleX, fittedScale, fixedHeight]);
  return <div className={`object-content-viewport${fillSpace ? ` ${fillSpace}-content-viewport` : ''}`} style={{ height: fixedHeight ? '100%' : height, '--content-scale-x': scaleX, '--content-scale-y': scaleY, '--content-fit-scale': fittedScale }}>
    <div ref={contentRef} className={`${className} scalable-object-content`} style={{ height: fixedHeight ? `calc(100% / var(${fillSpace ? '--content-fit-scale' : '--content-scale-y'}))` : undefined }}>{children}</div>
  </div>;
}

/** Keep manipulation handles in world space while the entire content scales. */
const OUTER_FRAME_ONLY_CLASSES = new Set([
  'canvas-object',
  'tutorial-item',
  'selected',
  'movable',
  'resizeable',
  'connection-source',
  'object-locked',
  'presentation-entrance-pending',
  'canvas-object-hidden',
  'canvas-object-hidden-preview',
  'has-auto-layout-hug-w',
  'has-auto-layout-hug-h',
  'has-styled-filter',
]);

const OUTER_CONTROL_CLASSES = new Set([
  'object-move-handle',
  'object-lock-badge',
  'object-hidden-badge',
  'portfolio-frame-outline',
  'portfolio-frame-caption',
  'shape-arrow-bend-handle',
  'connector-bend-handles',
]);

export function scaleObjectElement(element, item) {
  if (!isValidElement(element) || !isContentScalable(item)) return element;
  const backdrops = [], content = [], controls = [];
  const split = children => Children.toArray(children).forEach(child => {
    if (isValidElement(child) && child.type === Fragment) split(child.props.children);
    else if (isValidElement(child) && (child.type?.isStyleBackdrop || String(child.key || '').includes('canvas-object-style-backdrop'))) backdrops.push(child);
    else if (isValidElement(child) && (child.type === ResizeHandles || String(child.props?.className || '').split(/\s+/).some(cls => OUTER_CONTROL_CLASSES.has(cls)))) controls.push(child);
    else content.push(child);
  });
  split(element.props.children);
  const className = String(element.props.className || '').split(/\s+/).filter(name =>
    name && !OUTER_FRAME_ONLY_CLASSES.has(name)).join(' ');
  return cloneElement(element, { className: `${element.props.className} scalable-object-frame` },
    backdrops,
    <ScalableObjectContent className={className} scaleX={objectContentScale(item, 'X')} scaleY={objectContentScale(item, 'Y')} fixedHeight={Boolean(item.height)} fillSpace={isTextContent(item) && contentMode(item) === 'code' ? 'code' : hasIndependentContentSize(item) ? item.kind : null} fontScale={hasIndependentContentSize(item) ? objectFontSize(item) / objectBaseFontSize(item) : undefined}>{content}</ScalableObjectContent>,
    controls);
}
