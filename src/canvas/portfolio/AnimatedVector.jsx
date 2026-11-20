import { useId, useLayoutEffect, useMemo, useRef } from 'react';
import { useCanvasGraphics } from '../CanvasGraphicsContext.jsx';
import { graphicsRasterItem, graphicsRasterRatio, GRAPHICS_PROFILES, normalizeGraphicsQuality } from '../graphicsQuality.js';
import { strokeSvgData } from '../inkStrokeRenderer.js';
import { shadowFilter } from '../objectShadow.js';
import { rasterDescriptor, rasterizeObject } from '../rasterObjectCache.js';
import { useAnimationItems } from './animationStore.js';

function AnimatedStrokeVector({ item, world, origin }) {
  const clipId = useId();
  const svg = useMemo(() => strokeSvgData(item, world.width, world.height), [item, world.width, world.height]);
  if (!svg || !svg.d) return null;
  const filter = shadowFilter(item);
  const groupTransform = svg.rotation ? `rotate(${svg.rotation} ${svg.centerX} ${svg.centerY})` : undefined;
  return (
    <span className="animated-vector-surface" aria-hidden="true">
      <svg
        viewBox={`${svg.left} ${svg.top} ${svg.width} ${svg.height}`}
        style={{
          position: 'absolute',
          left: `${svg.left - origin.x}px`,
          top: `${svg.top - origin.y}px`,
          width: `${svg.width}px`,
          height: `${svg.height}px`,
          overflow: 'visible',
          pointerEvents: 'none',
          filter: filter === 'none' ? undefined : filter,
        }}
      >
        <g transform={groupTransform}>
          {svg.isBrush ? (
            <>
              <defs>
                <clipPath id={clipId}>
                  <path d={svg.d} clipRule="nonzero" />
                </clipPath>
              </defs>
              <path d={svg.d} fill={svg.color} fillRule="nonzero" fillOpacity={svg.opacity} />
              {svg.bristles?.length > 0 && (
                <g
                  clipPath={`url(#${clipId})`}
                  fill="none"
                  stroke={svg.color}
                  strokeWidth={svg.bristleWidth}
                  strokeOpacity={svg.bristleOpacity}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {svg.bristles.map((d, index) => <path key={index} d={d} />)}
                </g>
              )}
            </>
          ) : svg.isFilled ? (
            <path d={svg.d} fill={svg.color} fillRule="nonzero" fillOpacity={svg.opacity} />
          ) : (
            <path
              d={svg.d}
              fill="none"
              stroke={svg.color}
              strokeWidth={svg.strokeWidth}
              strokeOpacity={svg.opacity}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </g>
      </svg>
    </span>
  );
}

function AnimatedRasterVector({ id, item, world, origin }) {
  const node = useRef(null), cached = useRef(null), getItems = useAnimationItems(), quality = useCanvasGraphics();
  useLayoutEffect(() => {
    const target = node.current, refs = getItems();
    const descriptor = rasterDescriptor(id, graphicsRasterItem(item, quality), world, refs);
    if (!descriptor) { target.replaceChildren(); cached.current = null; return; }
    const ratio = graphicsRasterRatio(quality, 4, devicePixelRatio || 1);
    const budget = GRAPHICS_PROFILES[normalizeGraphicsQuality(quality)].documentPixelBudget;
    const key = JSON.stringify([descriptor.key, ratio, budget]);
    // Playback, selection and position updates do not change the rendered pixels.
    // Keep the existing canvas (and its compositor texture) until its appearance changes.
    if (cached.current?.key !== key) {
      const raster = rasterizeObject(id, descriptor, world, refs, ratio, budget);
      const old = cached.current?.raster.canvas;
      cached.current = { key, raster }; target.replaceChildren(raster.canvas);
      // Free the replaced canvas's backing store now rather than at GC time.
      if (old && old !== raster.canvas) old.width = old.height = 1;
    }
    const raster = cached.current.raster;
    Object.assign(raster.canvas.style, {
      position: 'absolute',
      left: `${descriptor.x + raster.left - origin.x}px`,
      top: `${descriptor.y + raster.top - origin.y}px`,
      width: `${raster.width}px`,
      height: `${raster.height}px`,
      pointerEvents: 'none',
    });
  }, [id, item, world.width, world.height, origin.x, origin.y, getItems, quality]);
  useLayoutEffect(() => () => {
    const canvas = cached.current?.raster.canvas;
    cached.current = null;
    if (canvas) canvas.width = canvas.height = 1;
  }, []);
  return <span ref={node} className="animated-vector-surface" aria-hidden="true" />;
}

export default function AnimatedVector(props) {
  if (props.item?.kind === 'stroke') {
    return <AnimatedStrokeVector item={props.item} world={props.world} origin={props.origin} />;
  }
  return <AnimatedRasterVector {...props} />;
}
