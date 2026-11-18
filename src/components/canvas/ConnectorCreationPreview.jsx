import { useEffect, useRef } from 'react';
import { connectorGeometry } from '../connectorGeometry.js';
import { hitTestFrameBorder, hitTestVector } from '../../canvas/vectorHitTest.js';
import { objectBounds } from '../CanvasSpatialBTree.js';

function pointsToSvgPath(points, closed = false) {
  if (!Array.isArray(points) || points.length < 2) return '';
  const body = points.map((p, index) => `${index === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  return closed ? `${body} Z` : body;
}

export default function ConnectorCreationPreview({
  boardRef,
  itemsRef,
  startId,
  boardSize,
  pointerPosition,
  spatialIndex,
  vectorHitOrder,
  cameraScale = 1,
  representationScale = 1,
}) {
  const shaftRef = useRef(null);
  const filledHeadRef = useRef(null);
  const strokeHeadRef = useRef(null);
  const startDotRef = useRef(null);
  const targetBoxRef = useRef(null);
  const pointerPosRef = useRef(pointerPosition);
  const scaleRef = useRef({ cameraScale, representationScale, vectorHitOrder });
  const latestEventRef = useRef(null);
  const rafRef = useRef(0);

  pointerPosRef.current = pointerPosition;
  scaleRef.current = { cameraScale, representationScale, vectorHitOrder };

  useEffect(() => {
    const stage = boardRef?.current;
    if (!stage || startId == null) return undefined;

    const clearPreview = () => {
      if (shaftRef.current) shaftRef.current.setAttribute('d', '');
      if (filledHeadRef.current) filledHeadRef.current.setAttribute('d', '');
      if (strokeHeadRef.current) strokeHeadRef.current.setAttribute('d', '');
      if (startDotRef.current) startDotRef.current.setAttribute('opacity', '0');
      if (targetBoxRef.current) targetBoxRef.current.setAttribute('opacity', '0');
    };

    const renderPreview = () => {
      rafRef.current = 0;
      const event = latestEventRef.current;
      const currentItems = itemsRef?.current;
      if (!event || !currentItems || !currentItems[startId]) {
        clearPreview();
        return;
      }

      const pt = pointerPosRef.current?.(event);
      if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
        clearPreview();
        return;
      }

      const { cameraScale: cScale, representationScale: rScale, vectorHitOrder: hitOrder } = scaleRef.current;
      const worldWidth = Math.max(1, Number(boardSize?.width) || 1600);
      const worldHeight = Math.max(1, Number(boardSize?.height) || 1000);

      let targetId = null;
      const domTarget = event.target?.closest?.('.canvas-object[data-item-id]')?.dataset?.itemId;
      if (domTarget && String(domTarget) !== String(startId) && currentItems[domTarget]?.kind !== 'connector') {
        targetId = String(domTarget);
      }
      if (!targetId && spatialIndex) {
        const frameHit = hitTestFrameBorder(spatialIndex, pt, boardSize, cScale);
        if (frameHit && String(frameHit.id) !== String(startId)) {
          targetId = String(frameHit.id);
        } else {
          const vectorHit = hitTestVector(spatialIndex, pt, boardSize, cScale, hitOrder, rScale);
          if (vectorHit && String(vectorHit.id) !== String(startId) && vectorHit.item?.kind !== 'connector') {
            targetId = String(vectorHit.id);
          }
        }
      }

      const hasValidTarget = Boolean(targetId && currentItems[targetId]);
      const workingItems = hasValidTarget
        ? currentItems
        : Object.assign(Object.create(currentItems), {
            __preview_cursor__: {
              kind: 'shape',
              shapeType: 'rectangle',
              x: pt.x - 1 / worldWidth,
              y: pt.y - 1 / worldHeight,
              width: 2 / worldWidth,
              height: 2 / worldHeight,
            },
          });

      const geometry = connectorGeometry(
        {
          kind: 'connector',
          from: startId,
          to: hasValidTarget ? targetId : '__preview_cursor__',
          mode: 'curved',
          endHead: 'triangle',
          headSize: 12,
          strokeWidth: 2,
        },
        workingItems,
        worldWidth,
        worldHeight,
        spatialIndex
      );

      if (!geometry || !geometry.points || geometry.points.length < 2) {
        clearPreview();
        return;
      }

      if (shaftRef.current) {
        shaftRef.current.setAttribute('d', pointsToSvgPath(geometry.points, false));
      }

      let filledD = '';
      let strokedD = '';
      for (const head of geometry.heads || []) {
        for (const part of head.parts || []) {
          const d = pointsToSvgPath(part.points, Boolean(part.closed));
          if (!d) continue;
          if (part.filled) filledD += (filledD ? ' ' : '') + d;
          else strokedD += (strokedD ? ' ' : '') + d;
        }
      }
      if (filledHeadRef.current) filledHeadRef.current.setAttribute('d', filledD);
      if (strokeHeadRef.current) strokeHeadRef.current.setAttribute('d', strokedD);

      if (startDotRef.current && geometry.start) {
        startDotRef.current.setAttribute('cx', geometry.start.x.toFixed(2));
        startDotRef.current.setAttribute('cy', geometry.start.y.toFixed(2));
        startDotRef.current.setAttribute('opacity', '1');
      }

      if (targetBoxRef.current) {
        if (hasValidTarget) {
          const b = objectBounds(currentItems[targetId], currentItems, worldWidth, worldHeight);
          const pad = 4;
          targetBoxRef.current.setAttribute('x', (b.minX * worldWidth - pad).toFixed(1));
          targetBoxRef.current.setAttribute('y', (b.minY * worldHeight - pad).toFixed(1));
          targetBoxRef.current.setAttribute('width', Math.max(4, (b.maxX - b.minX) * worldWidth + pad * 2).toFixed(1));
          targetBoxRef.current.setAttribute('height', Math.max(4, (b.maxY - b.minY) * worldHeight + pad * 2).toFixed(1));
          targetBoxRef.current.setAttribute('opacity', '1');
        } else {
          targetBoxRef.current.setAttribute('opacity', '0');
        }
      }
    };

    const handlePointerMove = (event) => {
      if (event.buttons && event.buttons !== 1) return;
      latestEventRef.current = event;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(renderPreview);
      }
    };

    const handlePointerLeave = () => {
      latestEventRef.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      clearPreview();
    };

    stage.addEventListener('pointermove', handlePointerMove, { passive: true });
    stage.addEventListener('pointerleave', handlePointerLeave, { passive: true });

    return () => {
      stage.removeEventListener('pointermove', handlePointerMove);
      stage.removeEventListener('pointerleave', handlePointerLeave);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      clearPreview();
    };
  }, [boardRef, itemsRef, startId, boardSize?.width, boardSize?.height, spatialIndex]);

  if (startId == null) return null;

  const width = Math.max(1, Number(boardSize?.width) || 1600);
  const height = Math.max(1, Number(boardSize?.height) || 1000);

  return (
    <svg
      className="connector-creation-preview"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <rect
        ref={targetBoxRef}
        className="connector-creation-preview-target"
        rx="8"
        ry="8"
        opacity="0"
      />
      <path ref={shaftRef} className="connector-creation-preview-shaft" d="" />
      <path ref={filledHeadRef} className="connector-creation-preview-head-filled" d="" />
      <path ref={strokeHeadRef} className="connector-creation-preview-head-stroke" d="" />
      <circle ref={startDotRef} className="connector-creation-preview-start" r="4" opacity="0" />
    </svg>
  );
}
