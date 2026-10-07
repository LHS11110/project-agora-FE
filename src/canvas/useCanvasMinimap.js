import { viewportOverview } from './minimap/viewportOverview.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { objectBounds } from '../components/CanvasSpatialBTree.js';

const MINIMAP_ASPECT = 1.6;
const MINIMAP_OVERVIEW_SCALE = 1.5;
const MINIMAP_POSITION_KEY = 'agora_canvas_minimap_position';
const MINIMAP_ITEM_KINDS = new Set(['image', 'link', 'code', 'note', 'table', 'shape', 'text', 'math', 'stroke', 'connector', 'pdf', 'user-group']);
const MINIMAP_ITEM_COLORS = {
  'user-group': '#8a75aa',
  pdf: '#b47768', image: '#c58b68', link: '#cf876b', code: '#708d78', note: '#d1ae62', table: '#7587a6',
  shape: '#6d9a91', text: '#809084', math: '#9a7ea1', stroke: '#526d5f', connector: '#a0a59b',
};

export function useCanvasMinimap({ boardRef, boardSize, viewportSize = boardSize, camera, setCamera, items, spatialIndex }) {
  const minimapWidgetRef = useRef(null);
  const minimapPointerRef = useRef(null);
  const minimapMoveRef = useRef(null);
  const minimapPositionRef = useRef(null);
  const [minimapPosition, setMinimapPosition] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(MINIMAP_POSITION_KEY) || 'null');
      return Number.isFinite(stored?.left) && Number.isFinite(stored?.top) ? stored : null;
    } catch {
      return null;
    }
  });
  minimapPositionRef.current = minimapPosition;

  const visibleWorldBounds = useMemo(() => {
    const width = Math.max(1, viewportSize.width);
    const height = Math.max(1, viewportSize.height);
    const scale = camera.scale;
    return {
      minX: -camera.x / scale,
      minY: -camera.y / scale,
      maxX: (width - camera.x) / scale,
      maxY: (height - camera.y) / scale,
    };
  }, [viewportSize, camera]);
  const visibleBounds = useMemo(() => ({
    minX: visibleWorldBounds.minX / Math.max(1, boardSize.width),
    minY: visibleWorldBounds.minY / Math.max(1, boardSize.height),
    maxX: visibleWorldBounds.maxX / Math.max(1, boardSize.width),
    maxY: visibleWorldBounds.maxY / Math.max(1, boardSize.height),
  }), [boardSize, visibleWorldBounds]);
  const minimap = useMemo(() => {
    const worldWidth = Math.max(1, boardSize.width), worldHeight = Math.max(1, boardSize.height);
    const viewport = visibleWorldBounds;
    const bounds = viewportOverview(viewport, MINIMAP_ASPECT, MINIMAP_OVERVIEW_SCALE);
    const query = { minX: bounds.minX / worldWidth, minY: bounds.minY / worldHeight, maxX: bounds.maxX / worldWidth, maxY: bounds.maxY / worldHeight };
    const entries = spatialIndex ? spatialIndex.query(query)
      : Object.entries(items).map(([id, item]) => ({ id, item, bounds: objectBounds(item, items, worldWidth, worldHeight) }));
    const minimapItems = entries.filter(entry => {
      const item = items[entry.id] || entry.item, b = entry.bounds;
      return MINIMAP_ITEM_KINDS.has(item?.kind) && b.maxX >= query.minX && b.minX <= query.maxX && b.maxY >= query.minY && b.minY <= query.maxY;
    }).map(entry => ({ id: entry.id, item: items[entry.id] || entry.item, bounds: {
      minX: entry.bounds.minX * worldWidth, minY: entry.bounds.minY * worldHeight,
      maxX: entry.bounds.maxX * worldWidth, maxY: entry.bounds.maxY * worldHeight,
    } }));
    return { bounds, viewport, items: minimapItems };
  }, [boardSize, items, visibleWorldBounds, spatialIndex]);

  useEffect(() => {
    if (!minimapPosition || viewportSize.width <= 1 || viewportSize.height <= 1) return;
    const widget = minimapWidgetRef.current?.getBoundingClientRect();
    if (!widget) return;
    const next = {
      left: Math.max(4, Math.min(Math.max(4, viewportSize.width - widget.width - 4), minimapPosition.left)),
      top: Math.max(4, Math.min(Math.max(4, viewportSize.height - widget.height - 4), minimapPosition.top)),
    };
    if (next.left !== minimapPosition.left || next.top !== minimapPosition.top) {
      minimapPositionRef.current = next;
      setMinimapPosition(next);
      try { localStorage.setItem(MINIMAP_POSITION_KEY, JSON.stringify(next)); } catch { /* Ignore unavailable local storage. */ }
    }
  }, [viewportSize, minimapPosition]);

  const moveCameraFromMinimap = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const xRatio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const yRatio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const worldX = minimap.bounds.minX + xRatio * minimap.bounds.width;
    const worldY = minimap.bounds.minY + yRatio * minimap.bounds.height;
    setCamera((current) => ({
      ...current,
      x: viewportSize.width / 2 - worldX * current.scale,
      y: viewportSize.height / 2 - worldY * current.scale,
    }));
  };
  const startMinimapWidgetMove = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const widget = minimapWidgetRef.current?.getBoundingClientRect();
    const stage = boardRef.current?.getBoundingClientRect();
    if (!widget || !stage) return;
    minimapMoveRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - widget.left,
      offsetY: event.clientY - widget.top,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveMinimapWidget = (event) => {
    event.stopPropagation();
    const drag = minimapMoveRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const widget = minimapWidgetRef.current?.getBoundingClientRect();
    const stage = boardRef.current?.getBoundingClientRect();
    if (!widget || !stage) return;
    const maxLeft = Math.max(4, stage.width - widget.width - 4);
    const maxTop = Math.max(4, stage.height - widget.height - 4);
    const next = {
      left: Math.max(4, Math.min(maxLeft, event.clientX - stage.left - drag.offsetX)),
      top: Math.max(4, Math.min(maxTop, event.clientY - stage.top - drag.offsetY)),
    };
    minimapPositionRef.current = next;
    setMinimapPosition(next);
  };
  const stopMinimapWidgetMove = (event) => {
    event.stopPropagation();
    if (minimapMoveRef.current?.pointerId !== event.pointerId) return;
    minimapMoveRef.current = null;
    if (event.type === 'pointerup' && minimapPositionRef.current) {
      try { localStorage.setItem(MINIMAP_POSITION_KEY, JSON.stringify(minimapPositionRef.current)); } catch { /* Ignore unavailable local storage. */ }
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const startMinimapPan = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    minimapPointerRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveMinimapPan = (event) => {
    event.stopPropagation();
    const press = minimapPointerRef.current;
    if (press?.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > 4) press.moved = true;
  };
  const stopMinimapPan = (event) => {
    event.stopPropagation();
    const press = minimapPointerRef.current;
    if (press?.pointerId !== event.pointerId) return;
    minimapPointerRef.current = null;
    if (event.type === 'pointerup' && !press.moved) moveCameraFromMinimap(event);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return {
    visibleBounds,
    minimap,
    minimapItemColors: MINIMAP_ITEM_COLORS,
    minimapPosition,
    minimapWidgetRef,
    startMinimapWidgetMove,
    moveMinimapWidget,
    stopMinimapWidgetMove,
    startMinimapPan,
    moveMinimapPan,
    stopMinimapPan,
  };
}
