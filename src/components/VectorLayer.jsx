import { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';
import './vector-layer.css';

const colorNumber = (value) => {
  const parsed = Number.parseInt(String(value || '#263b35').replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : 0x263b35;
};

function drawArrow(graphics, x1, y1, x2, y2, color, width = 2.5) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length < 1) return;
  const ux = dx / length;
  const uy = dy / length;
  const headLength = Math.min(16, Math.max(8, length * 0.18));
  const halfWidth = headLength * 0.48;
  const baseX = x2 - ux * headLength;
  const baseY = y2 - uy * headLength;
  const px = -uy * halfWidth;
  const py = ux * halfWidth;
  graphics.moveTo(x1, y1).lineTo(x2, y2).stroke({ color, width, cap: 'round', join: 'round' });
  graphics.poly([x2, y2, baseX + px, baseY + py, baseX - px, baseY - py]).fill(color);
}

export function drawVectorItems(graphics, items, width, height, visibleItemIds = null, referenceItems = items) {
  graphics.clear();
  const entries = Object.entries(items || {}).filter(([id]) => !visibleItemIds || visibleItemIds.has(id));

  for (const [, item] of entries) {
    if (item?.kind !== 'stroke' || !Array.isArray(item.points) || item.points.length < 1) continue;
    const points = item.points;
    const ink = colorNumber(item.color);
    const first = points[0];
    graphics.moveTo(first.x * width, first.y * height);
    if (points.length === 1) {
      graphics.lineTo(first.x * width + 0.1, first.y * height + 0.1);
    } else {
      for (const point of points.slice(1)) graphics.lineTo(point.x * width, point.y * height);
    }
    graphics.stroke({ color: ink, width: Number(item.strokeWidth) || 3.5, cap: 'round', join: 'round' });
  }

  for (const [, item] of entries) {
    if (item?.kind !== 'shape') continue;
    const x = (Number(item.x) || 0) * width;
    const y = (Number(item.y) || 0) * height;
    const w = (Number(item.width) || 0.14) * width;
    const h = (Number(item.height) || 0.12) * height;
    const ink = colorNumber(item.color);
    if (item.shapeType === 'ellipse') {
      graphics.ellipse(x + w / 2, y + h / 2, w / 2, h / 2).stroke({ color: ink, width: 2.5 });
    } else if (item.shapeType === 'arrow') {
      drawArrow(graphics, x, y + h, x + w, y, ink, 3);
    } else {
      graphics.roundRect(x, y, w, h, 5).stroke({ color: ink, width: 2.5 });
    }
  }

  for (const [, item] of entries) {
    if (item?.kind !== 'connector') continue;
    const from = referenceItems[item.from];
    const to = referenceItems[item.to];
    if (!from || !to) continue;
    const center = (object) => {
      const fallbackWidth = object.kind === 'code' ? 0.32 : 0.18;
      const fallbackHeight = object.kind === 'image' || object.kind === 'code' ? 0.2 : 0.12;
      return {
        x: ((Number(object.x) || 0) + (Number(object.width) || fallbackWidth) / 2) * width,
        y: ((Number(object.y) || 0) + (Number(object.height) || fallbackHeight) / 2) * height,
      };
    };
    const a = center(from);
    const b = center(to);
    drawArrow(graphics, a.x, a.y, b.x, b.y, colorNumber(item.color || '#6f9078'));
  }
}

function drawDraft(graphics, draft, width, height) {
  graphics.clear();
  if (!draft?.points?.length) return;
  const [first, ...remaining] = draft.points;
  graphics.moveTo(first.x * width, first.y * height);
  for (const point of remaining) graphics.lineTo(point.x * width, point.y * height);
  graphics.stroke({ color: colorNumber(draft.color), width: Number(draft.strokeWidth) || 3.5, cap: 'round', join: 'round' });
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
    if (before.x !== after.x || before.y !== after.y || before.width !== after.width || before.height !== after.height) return true;
  }
  return false;
}

export default function VectorLayer({ items, referenceItems = items, visibleItemIds, camera, onReady }) {
  const hostRef = useRef(null);
  const appRef = useRef(null);
  const sceneRef = useRef(null);
  const draftRef = useRef(null);
  const itemsRef = useRef(items);
  const referenceItemsRef = useRef(referenceItems);
  const visibleItemIdsRef = useRef(visibleItemIds);
  const cameraRef = useRef(camera || { x: 0, y: 0, scale: 1 });
  const lastSceneItemsRef = useRef(null);
  const lastVisibleItemsRef = useRef(null);
  const dimensionsRef = useRef({ width: 1, height: 1 });

  const renderScene = () => {
    const app = appRef.current;
    const scene = sceneRef.current;
    const draft = draftRef.current;
    if (!app || !scene || !hostRef.current) return;
    const width = Math.max(1, hostRef.current.clientWidth);
    const height = Math.max(1, hostRef.current.clientHeight);
    dimensionsRef.current = { width, height };
    app.renderer.resize(width, height);
    const currentCamera = cameraRef.current;
    app.stage.position.set(currentCamera.x, currentCamera.y);
    app.stage.scale.set(currentCamera.scale);
    drawVectorItems(scene, itemsRef.current, width, height, visibleItemIdsRef.current, referenceItemsRef.current);
    if (draft) drawDraft(draftRef.current, hostRef.current.__agoraDraft, width, height);
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
    visibleItemIdsRef.current = visibleItemIds;
    renderScene();
  }, [visibleItemIds]);

  useEffect(() => {
    cameraRef.current = camera || { x: 0, y: 0, scale: 1 };
    renderScene();
  }, [camera]);

  useEffect(() => {
    let disposed = false;
    let appInitialized = false;
    let observer;
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
      const draft = new Graphics();
      app.stage.addChild(scene, draft);
      host.appendChild(app.canvas);
      appRef.current = app;
      sceneRef.current = scene;
      draftRef.current = draft;
      let draftPointCount = 0;
      let draftColor = null;
      host.__agoraSetDraft = (value) => {
        host.__agoraDraft = value;
        const { width, height } = dimensionsRef.current;
        if (!value) {
          draft.clear();
          draftPointCount = 0;
          draftColor = null;
        } else {
          const points = value.points || [];
          if (draftPointCount > 0 && points.length === draftPointCount + 1 && draftColor === value.color) {
            const from = points[points.length - 2];
            const to = points[points.length - 1];
            draft.moveTo(from.x * width, from.y * height).lineTo(to.x * width, to.y * height)
              .stroke({ color: colorNumber(value.color), width: Number(value.strokeWidth) || 3.5, cap: 'round', join: 'round' });
          } else {
            drawDraft(draft, value, width, height);
          }
          draftPointCount = points.length;
          draftColor = value.color;
        }
        app.renderer.render(app.stage);
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
      observer?.disconnect();
      onReady?.(null);
      delete host.__agoraSetDraft;
      delete host.__agoraDraft;
      if (appRef.current === app) {
        appRef.current = null;
        sceneRef.current = null;
        draftRef.current = null;
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
