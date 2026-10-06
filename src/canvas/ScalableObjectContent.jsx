import { Children, Fragment, cloneElement, isValidElement, useLayoutEffect, useRef, useState } from 'react';
import ResizeHandles from '../components/ResizeHandles.jsx';
import { isContentScalable, objectContentScale } from './objectContentScale.js';
import './scalable-object-content.css';

function ScalableObjectContent({ children, className, scaleX, scaleY, fixedHeight, fillSpace }) {
  // Axis scales describe the available box, not stretching of its contents.
  const fittedScale = Math.min(scaleX, scaleY);
  const contentRef = useRef(null);
  const [height, setHeight] = useState(1);
  useLayoutEffect(() => {
    const content = contentRef.current;
    const measure = () => { if (!fixedHeight) setHeight(content.offsetHeight * fittedScale); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [scaleX, fittedScale, fixedHeight]);
  return <div className={`object-content-viewport${fillSpace ? ' code-content-viewport' : ''}`} style={{ height: fixedHeight ? '100%' : height, '--content-scale-x': scaleX, '--content-scale-y': scaleY, '--content-fit-scale': fittedScale }}>
    <div ref={contentRef} className={`${className} scalable-object-content`} style={{ height: fixedHeight ? `calc(100% / var(${fillSpace ? '--content-fit-scale' : '--content-scale-y'}))` : undefined }}>{children}</div>
  </div>;
}

/** Keep manipulation handles in world space while the entire content scales. */
export function scaleObjectElement(element, item) {
  if (!isValidElement(element) || !isContentScalable(item)) return element;
  const content = [], controls = [];
  const split = children => Children.toArray(children).forEach(child => {
    if (isValidElement(child) && child.type === Fragment) split(child.props.children);
    else if (isValidElement(child) && (child.type === ResizeHandles || child.props.className === 'object-move-handle')) controls.push(child);
    else content.push(child);
  });
  split(element.props.children);
  const className = String(element.props.className || '').split(' ').filter(name =>
    !['canvas-object', 'tutorial-item', 'selected', 'movable', 'resizeable', 'connection-source'].includes(name)).join(' ');
  return cloneElement(element, { className: `${element.props.className} scalable-object-frame` },
    <ScalableObjectContent className={className} scaleX={objectContentScale(item, 'X')} scaleY={objectContentScale(item, 'Y')} fixedHeight={Boolean(item.height)} fillSpace={item.kind === 'code'}>{content}</ScalableObjectContent>, controls);
}
