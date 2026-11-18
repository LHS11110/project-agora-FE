import CameraIdleTask from './CameraIdleTask.js';
import { shouldCommitCamera } from './cameraCommitSchedule.js';
import { useCallback, useLayoutEffect, useMemo, useRef, useState, startTransition } from 'react';
import { applyGridProjection, gridProjection } from './gridProjection.js';
import { CANVAS_SPACE, formatCanvasZoom } from './canvasSpace.js';

// Camera motion is a compositor update. React refreshes scene membership at
// viewport coverage changes, without a fixed refresh interval.
export function useCanvasCamera(boardRef, sceneRef) {
  const current = useRef({ x: 0, y: 0, scale: 1 }), committed = useRef(current.current);
  const [revision, setRevision] = useState(0);
  const work = useRef({
    frame: 0, idle: null, detailScale: 1, observer: null, size: null,
    refs: { stage: null, grid: null, axes: null, coordX: null, coordY: null, coordOrigin: null, laser: null, laserMissing: false, minimapRect: null, minimapMissing: false, zoom: null },
    last: { x: NaN, y: NaN, scale: NaN, width: 0, height: 0, gx: 0, gy: 0, layers: 0, axisChildren: 0, stageChildCount: -1, gridSpec: '', gridTileKey: '', gridTransform: '', gridPending: false, wasActive: false, zoomText: '', coordXTr: '', coordYTr: '', coordOriginShown: null, coordOriginTr: '' },
  });
  const commit = useCallback((settled = false) => {
    committed.current = { ...current.current };
    if (settled) {
      startTransition(() => {
        work.current.detailScale = current.current.scale;
        setRevision(value => value + 1);
      });
    } else {
      startTransition(() => setRevision(value => value + 1));
    }
  }, []);
  const apply = useCallback(() => {
    const stage = boardRef.current, scene = sceneRef.current, camera = current.current;
    if (!stage || !scene) return;
    const state = work.current;
    if (state.size?.stage !== stage) {
      state.observer?.disconnect(); state.size = { stage, width: stage.clientWidth, height: stage.clientHeight };
      state.observer = new ResizeObserver(([entry]) => { state.size = { stage, width: entry.contentRect.width, height: entry.contentRect.height }; }); state.observer.observe(stage);
    }
    const { width, height } = state.size;
    const gx = Number(stage.dataset.gridSpacingX) || 20, gy = Number(stage.dataset.gridSpacingY) || 20;
    const worldLayers = scene.getElementsByClassName('canvas-world-layer');
    const refs = state.refs, last = state.last;
    const stageChanged = refs.stage !== stage;
    if (stageChanged) {
      refs.stage = stage; refs.grid = null; refs.axes = null; refs.coordX = null; refs.coordY = null; refs.coordOrigin = null;
      refs.laser = null; refs.laserMissing = false; refs.minimapRect = null; refs.minimapMissing = false; refs.zoom = null;
      last.gridTransform = ''; last.coordXTr = ''; last.coordYTr = ''; last.coordOriginShown = null; last.coordOriginTr = '';
    }
    const stageChildCount = stage.childElementCount;
    const structureChanged = stageChanged || last.stageChildCount !== stageChildCount;
    const axes = refs.axes?.isConnected ? refs.axes : (refs.axes = stage.querySelector('.coordinate-plane'));
    const axisChildren = axes ? axes.childElementCount : 0;
    const stageActive = stage.classList.contains('camera-moving') || stage.classList.contains('camera-zooming');
    const gridZooming = stage.classList.contains('camera-zooming');
    const settlingGrid = !gridZooming && last.gridPending;
    const settleNotify = !stageActive && last.wasActive;
    const camMoved = last.x !== camera.x || last.y !== camera.y || last.scale !== camera.scale;
    const viewChanged = camMoved || last.width !== width || last.height !== height;
    const transform = `translate3d(${camera.x}px,${camera.y}px,0) scale(${camera.scale})`;
    for (let i = 0; i < worldLayers.length; i++) {
      if (worldLayers[i].style.transform !== transform) worldLayers[i].style.transform = transform;
    }
    if (!structureChanged && !viewChanged && !settlingGrid && !settleNotify && last.gx === gx && last.gy === gy && last.layers === worldLayers.length && last.axisChildren === axisChildren) return;
    const grid = refs.grid?.isConnected ? refs.grid : (refs.grid = stage.querySelector('.canvas-grid-surface'));
    if (grid) {
      const proj = gridProjection(camera, { x: gx, y: gy });
      const gridSpec = `${proj.coarse ? 1 : 0}:${proj.spacingX}:${proj.spacingY}`;
      const gridTileKey = `${gx}:${gy}`;
      if (!proj.coarse && (last.gridSpec === gridSpec || (gridZooming && last.gridTileKey === gridTileKey))) {
        if (last.gridTransform !== proj.transform) {
          grid.style.transform = proj.transform;
          last.gridTransform = proj.transform;
        }
        if (gridZooming && last.gridSpec !== gridSpec) last.gridPending = true;
      } else {
        applyGridProjection(grid, camera, { x: gx, y: gy });
        last.gridTransform = proj.transform;
        last.gridTileKey = proj.coarse ? '' : gridTileKey;
        last.gridSpec = gridSpec;
        last.gridPending = false;
      }
    }
    if (axes) {
      const hadX = refs.coordX?.isConnected, hadY = refs.coordY?.isConnected, hadOrigin = refs.coordOrigin?.isConnected;
      const coordX = hadX ? refs.coordX : (refs.coordX = axes.querySelector('.coordinate-x'));
      const coordY = hadY ? refs.coordY : (refs.coordY = axes.querySelector('.coordinate-y'));
      const coordOrigin = hadOrigin ? refs.coordOrigin : (refs.coordOrigin = axes.querySelector('.coordinate-origin'));
      if (viewChanged || (coordX && !hadX) || (coordY && !hadY) || (coordOrigin && !hadOrigin)) {
        const x = CANVAS_SPACE.width * camera.scale / 2 + camera.x, y = CANVAS_SPACE.height * camera.scale / 2 + camera.y;
        const displayX = Math.max(8, Math.min(Math.max(8, width - 8), x)), displayY = Math.max(8, Math.min(Math.max(8, height - 8), y));
        const nextXArrow = x <= width ? '1' : '0', nextYArrow = y >= 0 ? '1' : '0';
        if (coordX) {
          const xTr = `translate3d(0,${displayY}px,0)`;
          if (!hadX || last.coordXTr !== xTr) { coordX.style.transform = xTr; last.coordXTr = xTr; }
          if (coordX.style.getPropertyValue('--axis-x-arrow-opacity') !== nextXArrow) coordX.style.setProperty('--axis-x-arrow-opacity', nextXArrow);
        }
        if (coordY) {
          const yTr = `translate3d(${displayX}px,0,0)`;
          if (!hadY || last.coordYTr !== yTr) { coordY.style.transform = yTr; last.coordYTr = yTr; }
          if (coordY.style.getPropertyValue('--axis-y-arrow-opacity') !== nextYArrow) coordY.style.setProperty('--axis-y-arrow-opacity', nextYArrow);
        }
        if (coordOrigin) {
          const shown = x >= 0 && x <= width && y >= 0 && y <= height;
          if (!hadOrigin || last.coordOriginShown !== shown) {
            coordOrigin.style.display = shown ? '' : 'none';
            last.coordOriginShown = shown;
          }
          if (shown) {
            const oTr = `translate3d(${x}px,${y}px,0)`;
            if (!hadOrigin || last.coordOriginTr !== oTr) { coordOrigin.style.transform = oTr; last.coordOriginTr = oTr; }
          }
        }
      }
    }
    let laser = refs.laser?.isConnected ? refs.laser : null;
    if (!laser && (!refs.laserMissing || structureChanged)) {
      for (let i = 0; i < stage.children.length; i++) {
        if (stage.children[i].classList?.contains('laser-layer')) {
          const g = stage.children[i].firstElementChild;
          if (g && g.tagName.toLowerCase() === 'g') laser = g;
          break;
        }
      }
      refs.laser = laser;
      refs.laserMissing = !laser;
    }
    if (laser && camMoved) laser.setAttribute('transform', `translate(${camera.x} ${camera.y}) scale(${camera.scale})`);
    let rect = refs.minimapRect?.isConnected ? refs.minimapRect : null;
    if (!rect && (!refs.minimapMissing || structureChanged || !stageActive)) {
      rect = stage.querySelector('.canvas-minimap-viewport');
      refs.minimapRect = rect;
      refs.minimapMissing = !rect;
    }
    const minimapEl = rect ? (refs.minimapEl?.isConnected ? refs.minimapEl : (refs.minimapEl = rect.closest('.canvas-minimap'))) : null;
    const minimapOpen = Boolean(rect && (!minimapEl || !minimapEl.classList.contains('is-collapsed')));
    if (minimapOpen && (viewChanged || !last.minimapOpen)) {
      rect.setAttribute('x', -camera.x / camera.scale);
      rect.setAttribute('y', -camera.y / camera.scale);
      rect.setAttribute('width', width / camera.scale);
      rect.setAttribute('height', height / camera.scale);
    }
    last.minimapOpen = minimapOpen;
    const zoom = refs.zoom?.isConnected ? refs.zoom : (refs.zoom = stage.parentElement?.querySelector('.zoom-value'));
    if (zoom) {
      const nextZoomText = formatCanvasZoom(camera.scale);
      if (nextZoomText !== last.zoomText) {
        if (zoom.firstChild && zoom.firstChild.nodeType === 3 && zoom.childNodes.length === 1) {
          zoom.firstChild.nodeValue = nextZoomText;
        } else {
          zoom.textContent = nextZoomText;
        }
        last.zoomText = nextZoomText;
      }
    }
    if (viewChanged || settleNotify) {
      stage.dispatchEvent(new CustomEvent('agora-camera', { detail: { camera: { x: camera.x, y: camera.y, scale: camera.scale }, viewport: { width, height }, settled: !stageActive } }));
    }
    last.x = camera.x; last.y = camera.y; last.scale = camera.scale; last.width = width; last.height = height; last.gx = gx; last.gy = gy; last.layers = worldLayers.length; last.axisChildren = axisChildren; last.stageChildCount = stageChildCount; last.wasActive = stageActive;
  }, [boardRef, sceneRef]);
  const setCamera = useCallback(update => {
    const next = typeof update === 'function' ? update(current.current) : update;
    if (!next || ![next.x, next.y, next.scale].every(Number.isFinite) || next.scale <= 0) return;
    if (next.x === current.current.x && next.y === current.current.y && next.scale === current.current.scale) return;
    const zooming = next.scale !== current.current.scale;
    current.current = next;
    const stage = boardRef.current;
    if (stage) {
      if (!stage.classList.contains('camera-moving')) stage.classList.add('camera-moving');
      if (zooming && !stage.classList.contains('camera-zooming')) stage.classList.add('camera-zooming');
    }
    if (!work.current.frame) work.current.frame = requestAnimationFrame(() => {
      work.current.frame = 0; apply();
      const before = committed.current, now = current.current;
      if (shouldCommitCamera(before, now, work.current.size, boardRef.current?.__agoraPreparedScene)) commit();
    });
    work.current.idle ||= new CameraIdleTask(() => {
      const target = boardRef.current;
      if (target && (target.classList.contains('camera-moving') || target.classList.contains('camera-zooming'))) {
        target.classList.remove('camera-moving', 'camera-zooming');
      }
      commit(true);
    }, 160);
    work.current.idle.touch();
  }, [apply, commit, boardRef]);
  const camera = useMemo(() => ({ get x() { return current.current.x }, get y() { return current.current.y }, get scale() { return current.current.scale }, get detailScale() { return work.current.detailScale } }), [revision]);
  useLayoutEffect(apply);
  useLayoutEffect(() => () => {
    cancelAnimationFrame(work.current.frame); work.current.frame = 0; work.current.idle?.cancel(); work.current.idle = null; work.current.observer?.disconnect(); work.current.observer = null; work.current.size = null;
    const target = boardRef.current;
    if (target && (target.classList.contains('camera-moving') || target.classList.contains('camera-zooming'))) {
      target.classList.remove('camera-moving', 'camera-zooming');
    }
  }, [boardRef]);
  return [camera, setCamera];
}
