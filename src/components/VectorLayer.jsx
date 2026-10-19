import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { drawVectorItems } from '../canvas/drawVectorItems.js';
export { drawVectorItems } from '../canvas/drawVectorItems.js';
import { CONNECTOR_METRICS_EVENT } from '../canvas/connectors/objectMetrics.js';
import { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';
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
  const appRef = useRef(null);
  const sceneRef = useRef(null);
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
    const app = appRef.current;
    const scene = sceneRef.current;
    if (!app || !scene || !hostRef.current) return;
    const viewportWidth = Math.max(1, hostRef.current.clientWidth);
    const viewportHeight = Math.max(1, hostRef.current.clientHeight);
    const width = Math.max(1, worldSizeRef.current?.width || viewportWidth);
    const height = Math.max(1, worldSizeRef.current?.height || viewportHeight);
    app.renderer.resize(viewportWidth, viewportHeight);
    const currentCamera = cameraRef.current;
    app.stage.position.set(currentCamera.x, currentCamera.y);
    app.stage.scale.set(currentCamera.scale);
    const activeDraft = hostRef.current.__agoraDraft;
    drawVectorItems(scene, itemsRef.current, width, height, visibleItemIdsRef.current, referenceItemsRef.current);
    inkRendererRef.current?.render({
      items: itemsRef.current, visibleItemIds: visibleItemIdsRef.current,
      previews: previewStrokesRef.current, draft: activeDraft,
      width, height, viewportWidth, viewportHeight, camera: currentCamera,
    });
    app.renderer.render(app.stage);
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
    let appInitialized = false;
    let observer;
    let inkDraftFrame = null;
    const host = hostRef.current;
    if (!host) return undefined;
    const app = new Application();

    app.init({
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      autoStart: false,
      preference: 'webgl',
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    }).then(() => {
      appInitialized = true;
      if (disposed) {
        app.destroy();
        return;
      }
      const scene = new Graphics();
      app.stage.addChild(scene);
      host.appendChild(app.canvas);
      inkRendererRef.current = createInkStrokeRenderer(host, app.canvas);
      appRef.current = app;
      sceneRef.current = scene;
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
    }).catch(() => {
      if (!disposed) host.dataset.renderer = 'unavailable';
    });

    return () => {
      disposed = true;
      if (inkDraftFrame !== null) cancelAnimationFrame(inkDraftFrame);
      observer?.disconnect();
      onReady?.(null);
      delete host.__agoraSetDraft;
      delete host.__agoraDraft;
      if (appRef.current === app) {
        appRef.current = null;
        sceneRef.current = null;
        inkRendererRef.current?.destroy();
        inkRendererRef.current = null;
      }
      if (appInitialized) {
        const canvas = app.canvas;
        if (canvas && host.contains(canvas)) host.removeChild(canvas);
        app.destroy();
      }
    };
  }, []);

  return <div className="vector-layer" ref={hostRef} aria-label={ui("벡터 그래픽 캔버스")} />;
}
