import { memo, useEffect, useState } from 'react';
import { LASER_FADE_MS } from '../canvas/canvasConstants.js';

function pathForPoints(points, width, height) {
  if (!Array.isArray(points) || points.length === 0) return '';
  const scaled = points.map((point) => ({ x: point.x * width, y: point.y * height }));
  const first = scaled[0];
  if (scaled.length === 1) return `M ${first.x} ${first.y} l 0.02 0.02`;

  let path = `M ${first.x} ${first.y}`;
  for (let index = 1; index < scaled.length - 1; index += 1) {
    const point = scaled[index];
    const next = scaled[index + 1];
    path += ` Q ${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`;
  }
  const last = scaled[scaled.length - 1];
  return `${path} L ${last.x} ${last.y}`;
}

const LaserLayer = memo(function LaserLayer({ strokes: propStrokes, updaterRef, activeDrawingRef, width = 1, height = 1, camera, worldSize }) {
  const [internalStrokes, setInternalStrokes] = useState([]);
  const strokes = updaterRef ? internalStrokes : (propStrokes || []);

  useEffect(() => {
    if (!updaterRef) return undefined;
    updaterRef.current = setInternalStrokes;
    return () => {
      if (updaterRef.current === setInternalStrokes) updaterRef.current = null;
    };
  }, [updaterRef]);

  useEffect(() => {
    if (!updaterRef || !internalStrokes.length) return undefined;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setInternalStrokes((current) => {
        let changed = false;
        const next = current.flatMap((stroke) => {
          if (stroke.endedAt) {
            if (now - stroke.endedAt < LASER_FADE_MS + 120) return [stroke];
            changed = true;
            return [];
          }
          if ((stroke.active && activeDrawingRef?.current?.key === stroke.id) || now - stroke.updatedAt < 6000) return [stroke];
          changed = true;
          return [{ ...stroke, active: false, endedAt: now }];
        });
        return changed ? next : current;
      });
    }, 160);
    return () => window.clearInterval(timer);
  }, [updaterRef, internalStrokes.length, activeDrawingRef]);

  if (!strokes.length) return null;
  const viewWidth = Math.max(1, width);
  const viewHeight = Math.max(1, height);
  const worldWidth = worldSize?.width || viewWidth;
  const worldHeight = worldSize?.height || viewHeight;
  const view = camera || { x: 0, y: 0, scale: 1 };

  return <svg className="laser-layer" viewBox={`0 0 ${viewWidth} ${viewHeight}`} preserveAspectRatio="none" aria-hidden="true">
    <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
      {strokes.map((stroke) => <g
        key={stroke.id}
        className={`laser-trail${stroke.endedAt ? ' is-fading' : ''}`}
        style={{ '--laser-color': stroke.color || '#ff3d67' }}
      >
        <path className="laser-trail-glow" d={pathForPoints(stroke.points, worldWidth, worldHeight)} />
        <path className="laser-trail-line" d={pathForPoints(stroke.points, worldWidth, worldHeight)} />
        <path className="laser-trail-core" d={pathForPoints(stroke.points, worldWidth, worldHeight)} />
      </g>)}
    </g>
  </svg>;
});

export default LaserLayer;
