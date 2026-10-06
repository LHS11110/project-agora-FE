import { useEffect, useMemo, useRef, useState } from 'react';
import { objectBounds } from '../components/CanvasSpatialBTree.js';

const MINIMAP_ASPECT = 1.6;
const MINIMAP_OVERVIEW_SCALE = 1.5;
const MINIMAP_POSITION_KEY = 'agora_canvas_minimap_position';
const MINIMAP_ITEM_KINDS = new Set(['image', 'link', 'code', 'note', 'table', 'shape', 'text', 'math', 'stroke', 'connector']);
const MINIMAP_ITEM_COLORS = {
  image: '#c58b68', link: '#cf876b', code: '#708d78', note: '#d1ae62', table: '#7587a6',
  shape: '#6d9a91', text: '#809084', math: '#9a7ea1', stroke: '#526d5f', connector: '#a0a59b',
};

export function useCanvasMinimap({ boardRef, boardSize, viewportSize = boardSize, camera, setCamera, items }) {
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
    const scale = Math.max(0.001, camera.scale);
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
    const viewportWidth = Math.max(1, boardSize.width);
    const viewportHeight = Math.max(1, boardSize.height);
    const minimapItems = Object.entries(items)
      .filter(([, item]) => MINIMAP_ITEM_KINDS.has(item?.kind))
      .map(([id, item]) => {
        const normalizedBounds = objectBounds(item, items, viewportWidth, viewportHeight);
        return {
          id,
          item,
          bounds: {
            minX: normalizedBounds.minX * viewportWidth,
            minY: normalizedBounds.minY * viewportHeight,
            maxX: normalizedBounds.maxX * viewportWidth,
            maxY: normalizedBounds.maxY * viewportHeight,
          },
        };
      });
    const viewport = visibleWorldBounds;
    const bounds = {
      minX: -viewportWidth,
      minY: -viewportHeight,
      maxX: viewportWidth * 2,
      maxY: viewportHeight * 2,
    };
    const include = (next) => {
      bounds.minX = Math.min(bounds.minX, next.minX);
      bounds.minY = Math.min(bounds.minY, next.minY);
      bounds.maxX = Math.max(bounds.maxX, next.maxX);
      bounds.maxY = Math.max(bounds.maxY, next.maxY);
    };
    minimapItems.forEach(({ bounds: itemBounds }) => include(itemBounds));
    include(viewport);

    const padding = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.1;
    bounds.minX -= padding;
    bounds.minY -= padding;
    bounds.maxX += padding;
    bounds.maxY += padding;
    let width = bounds.maxX - bounds.minX;
    let height = bounds.maxY - bounds.minY;
    if (width / height < MINIMAP_ASPECT) {
      const expandedWidth = height * MINIMAP_ASPECT;
      bounds.minX -= (expandedWidth - width) / 2;
      width = expandedWidth;
    } else {
      const expandedHeight = width / MINIMAP_ASPECT;
      bounds.minY -= (expandedHeight - height) / 2;
      height = expandedHeight;
    }
    const overviewWidth = width * MINIMAP_OVERVIEW_SCALE;
    const overviewHeight = height * MINIMAP_OVERVIEW_SCALE;
    bounds.minX -= (overviewWidth - width) / 2;
    bounds.minY -= (overviewHeight - height) / 2;
    width = overviewWidth;
    height = overviewHeight;
    bounds.maxX = bounds.minX + width;
    bounds.maxY = bounds.minY + height;
    return { bounds: { ...bounds, width, height }, viewport, items: minimapItems };
  }, [boardSize, items, visibleWorldBounds]);

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
