import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { drawVectorItems } from '../canvas/drawVectorItems.js';
export { drawVectorItems } from '../canvas/drawVectorItems.js';
import { canvasGraphics } from '../canvas/canvasGraphics.js';
import { CONNECTOR_METRICS_EVENT } from '../canvas/connectors/objectMetrics.js';
import { useEffect, useRef } from 'react';
import { createInkStrokeRenderer } from '../canvas/inkStrokeRenderer.js';
import './vector-layer.css';

function vectorSceneChanged(previous, current) {
  if (!previous) return true;
  const oldKeys = Object.keys(previous);
  const nextKeys = Object.keys(current || {});
  if (oldKeys.length !== nextKeys.length) return true;
  for (const key of nextKeys) {
    const before = previous[key];
    const after = current[key];
    if (!before || !after || before.kind !== after.kind) return true;
    if (before === after) continue;
    if (['stroke', 'shape', 'connector'].includes(after.kind)) return true;
    if (before.x !== after.x || before.y !== after.y || before.width !== after.width || before.height !== after.height || before.rotation !== after.rotation || before.fontSize !== after.fontSize) return true;
  }
  return false;
}

export default function VectorLayer({ items, referenceItems = items, visibleItemIds, previewStrokes = [], camera, onReady, worldSize }) {
  useUiLocale();
  const hostRef = useRef(null);
  const surfaceRef = useRef(null);
  const inkRendererRef = useRef(null);
  const itemsRef = useRef(items);
  const referenceItemsRef = useRef(referenceItems);
  const previewStrokesRef = useRef(previewStrokes);
  const visibleItemIdsRef = useRef(visibleItemIds);
  const cameraRef = useRef(camera || { x: 0, y: 0, scale: 1 });
  const lastSceneItemsRef = useRef(null);
  const lastVisibleItemsRef = useRef(null);
  const worldSizeRef = useRef(worldSize);
  worldSizeRef.current = worldSize;

  const renderScene = () => {
    const surface = surfaceRef.current;
    if (!surface || !hostRef.current) return;
    const viewportWidth = Math.max(1, hostRef.current.clientWidth);
    const viewportHeight = Math.max(1, hostRef.current.clientHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(viewportWidth * ratio));
    const pixelHeight = Math.max(1, Math.round(viewportHeight * ratio));
    if (surface.width !== pixelWidth || surface.height !== pixelHeight) {
      surface.width = pixelWidth;
      surface.height = pixelHeight;
    }
    const width = Math.max(1, worldSizeRef.current?.width || viewportWidth);
    const height = Math.max(1, worldSizeRef.current?.height || viewportHeight);
    const currentCamera = cameraRef.current;
    const context = surface.getContext('2d');
    if (context) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, pixelWidth, pixelHeight);
      context.save();
      context.setTransform(
        ratio * currentCamera.scale,
        0,
        0,
        ratio * currentCamera.scale,
        ratio * currentCamera.x,
        ratio * currentCamera.y,
      );
      drawVectorItems(
        canvasGraphics(context),
        itemsRef.current,
        width,
        height,
        visibleItemIdsRef.current,
        referenceItemsRef.current,
      );
      context.restore();
    }
    const activeDraft = hostRef.current.__agoraDraft;
    inkRendererRef.current?.render({
      items: itemsRef.current, visibleItemIds: visibleItemIdsRef.current,
      previews: previewStrokesRef.current, draft: activeDraft,
      width, height, viewportWidth, viewportHeight, camera: currentCamera,
    });
  };

  useEffect(() => {
    itemsRef.current = items;
    referenceItemsRef.current = referenceItems;
    if (vectorSceneChanged(lastSceneItemsRef.current, referenceItems)
      || vectorSceneChanged(lastVisibleItemsRef.current, items)) renderScene();
    lastSceneItemsRef.current = referenceItems;
    lastVisibleItemsRef.current = items;
  }, [items, referenceItems]);

  useEffect(() => {
    window.addEventListener(CONNECTOR_METRICS_EVENT, renderScene);
    return () => window.removeEventListener(CONNECTOR_METRICS_EVENT, renderScene);
  }, []);

  useEffect(() => {
    visibleItemIdsRef.current = visibleItemIds;
    renderScene();
  }, [visibleItemIds]);

  useEffect(() => {
    cameraRef.current = camera || { x: 0, y: 0, scale: 1 };
    renderScene();
  }, [camera]);

  useEffect(() => {
    previewStrokesRef.current = previewStrokes;
    renderScene();
  }, [previewStrokes]);

  useEffect(() => {
    let disposed = false;
    let observer;
    let inkDraftFrame = null;
    const host = hostRef.current;
    if (!host) return undefined;

    const surface = document.createElement('canvas');
    host.appendChild(surface);
    surfaceRef.current = surface;
    host.dataset.renderer = 'canvas2d';
    inkRendererRef.current = createInkStrokeRenderer(host, surface);
    host.__agoraSetDraft = (value) => {
      host.__agoraDraft = value;
      if (inkDraftFrame !== null) return;
      inkDraftFrame = requestAnimationFrame(() => {
        inkDraftFrame = null;
        if (disposed) return;
        inkRendererRef.current?.renderDraft(host.__agoraDraft);
      });
    };
    observer = new ResizeObserver(renderScene);
    observer.observe(host);
    renderScene();
    onReady?.(host.__agoraSetDraft);

    return () => {
      disposed = true;
      if (inkDraftFrame !== null) cancelAnimationFrame(inkDraftFrame);
      observer?.disconnect();
      onReady?.(null);
      delete host.__agoraSetDraft;
      delete host.__agoraDraft;
      surfaceRef.current = null;
      inkRendererRef.current?.destroy();
      inkRendererRef.current = null;
      if (host.contains(surface)) host.removeChild(surface);
    };
  }, []);

  return <div className="vector-layer" ref={hostRef} aria-label={ui("벡터 그래픽 캔버스")} />;
}
