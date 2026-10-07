import { CONNECTOR_METRICS_EVENT } from '../canvas/connectors/objectMetrics.js';
import { shapeOutlinePaths, shapeFillPaths } from '../canvas/shapeGeometry.js';
import { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';
import { createInkStrokeRenderer } from '../canvas/inkStrokeRenderer.js';
import { connectorGeometry } from './connectorGeometry.js';
import { shapeArrowGeometry } from './shapeArrowGeometry.js';
import './vector-layer.css';

const colorNumber = (value) => {
  const parsed = Number.parseInt(String(value || '#263b35').replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : 0x263b35;
};

function drawArrowHead(graphics, head, color, width, transform = (point) => point) {
  for (const part of head.parts) {
    const points = part.points.map(transform);
    if (part.center) {
      const center = transform(part.center);
      graphics.circle(center.x, center.y, part.radius);
    } else if (part.closed) graphics.poly(points.flatMap(point => [point.x, point.y]));
    else {
      graphics.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach(point => graphics.lineTo(point.x, point.y));
    }
    if (part.filled) graphics.fill(color);
    graphics.stroke({ color, width: head.strokeWidth, cap: 'round', join: 'round' });
  }
}

function drawShapeArrow(graphics, x, y, width, height, angle, color, bend, startHead, endHead) {
  const geometry = shapeArrowGeometry(width, height, bend, startHead, endHead);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const rotate = (point) => rotatePoint(x + point.x, y + point.y, centerX, centerY, angle);
  const curve = geometry.points.map(rotate);
  drawPolyline(graphics, curve, color, 2.5);
  geometry.heads.forEach((head) => drawArrowHead(graphics, head, color, 2.5, rotate));
}

function rotatePoint(x, y, centerX, centerY, angle) {
  if (!angle) return { x, y };
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const dx = x - centerX;
  const dy = y - centerY;
  return { x: centerX + dx * cosine - dy * sine, y: centerY + dx * sine + dy * cosine };
}

function drawPolyline(graphics, points, color, width) {
  if (!points.length) return;
  graphics.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
  graphics.stroke({ color, width, cap: 'round', join: 'round' });
}

function drawCurvedArrow(graphics, geometry, color, width) {
  if (!geometry?.points?.length) return;
  drawPolyline(graphics, geometry.points, color, width);
  geometry.heads?.forEach((head) => drawArrowHead(graphics, head, color, width));
}

export function drawVectorItems(graphics, items, width, height, visibleItemIds = null, referenceItems = items) {
  graphics.clear();
  const entries = Object.entries(items || {}).filter(([id]) => !visibleItemIds || visibleItemIds.has(id));

  for (const [, item] of entries) {
    if (item?.kind !== 'shape') continue;
    const x = (Number(item.x) || 0) * width;
    const y = (Number(item.y) || 0) * height;
    const w = (Number(item.width) || 0.14) * width;
    const h = (Number(item.height) || 0.12) * height;
    const ink = colorNumber(item.color);
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const angle = (Number(item.rotation) || 0) * Math.PI / 180;
    if (item.shapeType === 'arrow') {
      drawShapeArrow(graphics, x, y, w, h, angle, ink, item.bend, item.startHead, item.endHead);
    } else {
      if (/^#[0-9a-f]{6}$/i.test(item.fill || '')) {
        for (const path of shapeFillPaths(item.shapeType, w, h)) {
          const points = path.map(point => rotatePoint(x + point.x, y + point.y, centerX, centerY, angle));
          graphics.poly(points.flatMap(point => [point.x, point.y])).fill(colorNumber(item.fill));
        }
      }
      for (const path of shapeOutlinePaths(item.shapeType, w, h)) {
        drawPolyline(graphics, path.map(point => rotatePoint(x + point.x, y + point.y, centerX, centerY, angle)), ink, 2.5);
      }
    }
  }

  for (const [, item] of entries) {
    if (item?.kind !== 'connector') continue;
    const geometry = connectorGeometry(item, referenceItems, width, height);
    drawCurvedArrow(graphics, geometry, colorNumber(item.color || '#8b8f8c'), Number(item.strokeWidth) || 1.5);
  }
}

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

  return <div className="vector-layer" ref={hostRef} aria-label="벡터 그래픽 캔버스" />;
}
