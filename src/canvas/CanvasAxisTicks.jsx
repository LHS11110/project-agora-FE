import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import { axisTickLayout } from './axisTicks.js';
import './canvas-axis-ticks.css';
const NS = 'http://www.w3.org/2000/svg';

function createTickNode(horizontal) {
  const node = document.createElementNS(NS, 'g');
  const line = document.createElementNS(NS, 'line');
  const text = document.createElementNS(NS, 'text');
  if (horizontal) {
    line.setAttribute('x1', '0'); line.setAttribute('x2', '0');
    line.setAttribute('y1', '-3'); line.setAttribute('y2', '3');
    text.setAttribute('x', '0'); text.setAttribute('text-anchor', 'middle');
  } else {
    line.setAttribute('x1', '-3'); line.setAttribute('x2', '3');
    line.setAttribute('y1', '0'); line.setAttribute('y2', '0');
    text.setAttribute('y', '3');
  }
  node.append(line, text);
  node._val = '';
  node._tr = '';
  node._tx = '';
  node._ty = '';
  node._anchor = '';
  node._label = '';
  return node;
}

function paint(group, rows, origin, size, horizontal) {
  const children = group.children;
  const rowKeys = new Set();
  for (let i = 0; i < rows.length; i++) rowKeys.add(String(rows[i].value));

  const byValue = new Map();
  const spare = [];
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node._val && rowKeys.has(node._val) && !byValue.has(node._val)) {
      byValue.set(node._val, node);
    } else {
      spare.push(node);
    }
  }

  const left = horizontal ? false : origin > size - 100;
  const textX = left ? '-8' : '8';
  const textAnchor = left ? 'end' : 'start';
  const textY = horizontal ? String(origin > size - 30 ? -8 : 15) : '';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const val = String(row.value);
    let node = byValue.get(val);
    if (!node) {
      node = spare.length ? spare.pop() : group.appendChild(createTickNode(horizontal));
    }
    if (node.style.display) node.style.display = '';
    const text = node.lastChild;
    if (node._val !== val) {
      node.setAttribute('data-value', val);
      node._val = val;
    }
    const tr = horizontal ? `translate(${row.position} ${origin})` : `translate(${origin} ${row.position})`;
    if (node._tr !== tr) {
      node.setAttribute('transform', tr);
      node._tr = tr;
    }
    if (horizontal) {
      if (node._ty !== textY) { text.setAttribute('y', textY); node._ty = textY; }
    } else {
      if (node._tx !== textX) { text.setAttribute('x', textX); node._tx = textX; }
      if (node._anchor !== textAnchor) { text.setAttribute('text-anchor', textAnchor); node._anchor = textAnchor; }
    }
    if (node._label !== row.label) {
      text.textContent = row.label;
      node._label = row.label;
    }
  }
  for (let i = 0; i < spare.length; i++) {
    const node = spare[i];
    if (node.style.display !== 'none') node.style.display = 'none';
  }
}

function getTickSprite(state, label, colors, dpr) {
  const key = `${dpr}:${colors.font}:${colors.text}:${colors.halo}:${label}`;
  let hit = state.sprites.get(key);
  if (hit) return hit;
  if (state.sprites.size > 512) state.sprites.clear();
  const c = document.createElement('canvas');
  const sctx = c.getContext('2d');
  if (!sctx) return null;
  sctx.font = colors.font;
  const tw = Math.ceil(sctx.measureText(label).width);
  const w = Math.max(4, tw + 6);
  const h = 14;
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.font = colors.font;
  sctx.textAlign = 'left';
  sctx.textBaseline = 'alphabetic';
  // Same halo as the SVG labels (canvas-axis-ticks.css) so moving and settled ticks match.
  sctx.lineJoin = 'round';
  sctx.lineWidth = 3;
  sctx.strokeStyle = colors.halo;
  sctx.globalAlpha = 0.9;
  sctx.strokeText(label, 3, 11);
  sctx.globalAlpha = 1;
  sctx.fillStyle = colors.text;
  sctx.fillText(label, 3, 11);
  hit = { canvas: c, w, h, tw };
  state.sprites.set(key, hit);
  return hit;
}

const STRIP_X_H = 44;
const STRIP_Y_W = 108;
const STRIP_OVERSCAN = 256;

function syncStripVisibility(el, stateKey, state, visible) {
  if (!el) return;
  if (state[stateKey] !== visible) {
    el.style.visibility = visible ? 'visible' : 'hidden';
    state[stateKey] = visible;
  }
}

function drawFastStrip(canvas, ctxKey, trKey, cacheKey, state, camera, origin, viewportWidth, viewportHeight, horizontal, colors, trimEdges = false) {
  if (!canvas || !viewportWidth || !viewportHeight) return;
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const left = !horizontal && origin > viewportWidth - 100;
  const textFlip = horizontal ? (origin > viewportHeight - 30) : left;
  const stripPos = horizontal
    ? Math.round(origin - 22)
    : Math.round(left ? origin - 100 : origin - 6);
  const localOrigin = origin - stripPos;
  // The visible viewport decides the step; the overscanned strip only extends it.
  const visibleStep = axisTickLayout(camera, { width: viewportWidth, height: viewportHeight }).step;

  // Reuse the overscanned strip canvas during pure panning by translating only.
  const cached = state[cacheKey];
  if (
    cached
    && cached.dpr === dpr
    && cached.vw === viewportWidth
    && cached.vh === viewportHeight
    && cached.scale === camera.scale
    && cached.textFlip === textFlip
    && cached.colors === colors
    && cached.step === visibleStep
    && !cached.trimmed && !trimEdges
    && Math.abs(localOrigin - cached.localOrigin) < 0.75
  ) {
    const panDelta = horizontal ? (camera.x - cached.panOrigin) : (camera.y - cached.panOrigin);
    if (Math.abs(panDelta) <= STRIP_OVERSCAN - 16) {
      const tr = horizontal
        ? `translate3d(${panDelta - STRIP_OVERSCAN}px,${stripPos}px,0)`
        : `translate3d(${stripPos}px,${panDelta - STRIP_OVERSCAN}px,0)`;
      if (state[trKey] !== tr) {
        canvas.style.transform = tr;
        state[trKey] = tr;
      }
      return;
    }
  }

  const cssW = horizontal ? viewportWidth + STRIP_OVERSCAN * 2 : STRIP_Y_W;
  const cssH = horizontal ? STRIP_X_H : viewportHeight + STRIP_OVERSCAN * 2;
  const tw = Math.max(1, Math.round(cssW * dpr));
  const th = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== tw || canvas.height !== th || !state[ctxKey]) {
    canvas.width = tw;
    canvas.height = th;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    state[ctxKey] = canvas.getContext('2d');
  }
  const ctx = state[ctxKey];
  if (!ctx) return;

  const tr = horizontal
    ? `translate3d(${-STRIP_OVERSCAN}px,${stripPos}px,0)`
    : `translate3d(${stripPos}px,${-STRIP_OVERSCAN}px,0)`;
  if (state[trKey] !== tr) {
    canvas.style.transform = tr;
    state[trKey] = tr;
  }

  const expandedCamera = horizontal
    ? { x: camera.x + STRIP_OVERSCAN, y: camera.y, scale: camera.scale }
    : { x: camera.x, y: camera.y + STRIP_OVERSCAN, scale: camera.scale };
  const expandedLayout = axisTickLayout(expandedCamera, {
    width: horizontal ? cssW : viewportWidth,
    height: horizontal ? viewportHeight : cssH,
  }, undefined, visibleStep);
  // While zooming the strip is redrawn every frame, so hide the labels the settled view
  // hides near the viewport edges (see axisTicks.js); otherwise they pop out on settle.
  const length = horizontal ? viewportWidth : viewportHeight;
  const allRows = horizontal ? expandedLayout.x : expandedLayout.y;
  const rows = trimEdges
    ? allRows.filter(row => row.position - STRIP_OVERSCAN >= 18 && row.position - STRIP_OVERSCAN <= length - 42)
    : allRows;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  state[cacheKey] = {
    dpr,
    vw: viewportWidth,
    vh: viewportHeight,
    scale: camera.scale,
    textFlip,
    colors,
    step: visibleStep,
    trimmed: trimEdges,
    localOrigin,
    panOrigin: horizontal ? camera.x : camera.y,
  };
  if (!rows.length) return;

  ctx.beginPath();
  for (let i = 0; i < rows.length; i++) {
    const p = rows[i].position;
    if (horizontal) {
      ctx.moveTo(p + 0.5, localOrigin - 3);
      ctx.lineTo(p + 0.5, localOrigin + 3);
    } else {
      ctx.moveTo(localOrigin - 3, p + 0.5);
      ctx.lineTo(localOrigin + 3, p + 0.5);
    }
  }
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1;
  ctx.stroke();

  const textX = left ? -8 : 8;
  const textY = horizontal ? (origin > viewportHeight - 30 ? -8 : 15) : 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sprite = getTickSprite(state, row.label, colors, dpr);
    if (!sprite) continue;
    const dx = horizontal
      ? Math.round(row.position - sprite.w * 0.5)
      : Math.round(left ? localOrigin + textX - 3 - sprite.tw : localOrigin + textX - 3);
    const dy = horizontal
      ? Math.round(localOrigin + textY - 11)
      : Math.round(row.position + 3 - 11);
    ctx.drawImage(sprite.canvas, 0, 0, sprite.canvas.width, sprite.canvas.height, dx, dy, sprite.w, sprite.h);
  }
}

const CanvasAxisTicks = memo(function CanvasAxisTicks({ boardRef, camera, showXAxis, showYAxis }) {
  const svg = useRef(null), fastX = useRef(null), fastY = useRef(null), xGroup = useRef(null), yGroup = useRef(null), draw = useRef(null), latest = useRef(null);
  latest.current = { camera, showXAxis, showYAxis };
  useEffect(() => {
    const stage = boardRef.current; if (!stage) return undefined;
    let width = stage.clientWidth, height = stage.clientHeight, last = '', lastSvg = '', lastW = -1, lastH = -1, lastStep = null;
    let svgHidden = false, cachedThemeKey = '', cachedColors = null;
    const canvasState = { ctxX: null, ctxY: null, trX: '', trY: '', cacheX: null, cacheY: null, visX: false, visY: false, sprites: new Map() };
    // The label halo must match the canvas behind it: a white halo on the tinted stage
    // showed as blotches that clipped grid dots ("·100'") next to every label.
    const stageBackground = () => {
      for (let node = stage; node && node.nodeType === 1; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor;
        if (color && color !== 'transparent' && !/^rgba\([^)]*,\s*0\)$/.test(color)) return color;
      }
      return '';
    };
    const readColors = () => {
      const page = stage.closest('.canvas-app-page');
      // A custom canvas color is set inline on the stage; include it so the halo follows it.
      const themeKey = `${page?.dataset?.theme || 'light'}|${stage.style.backgroundColor}`;
      if (cachedColors && cachedThemeKey === themeKey) return cachedColors;
      cachedThemeKey = themeKey;
      const cs = getComputedStyle(svg.current);
      const ink = cs.getPropertyValue('--ink-muted').trim() || '#77798d';
      const halo = stageBackground() || cs.getPropertyValue('--surface').trim() || '#ffffff';
      const mono = cs.getPropertyValue('--mono').trim() || 'monospace';
      svg.current.style.setProperty('--axis-label-halo', halo);
      cachedColors = { line: ink, text: ink, halo, font: `10px ${mono}` };
      return cachedColors;
    };
    const update = (event) => {
      const c = latest.current;
      const settled = event?.detail ? Boolean(event.detail.settled) : !(stage.classList.contains('camera-moving') || stage.classList.contains('camera-zooming'));
      const key = `${c.camera.x}|${c.camera.y}|${c.camera.scale}|${width}|${height}|${c.showXAxis}|${c.showYAxis}|${settled ? 1 : 0}`;
      if (key === last) return; last = key;
      const layout = axisTickLayout(c.camera, { width, height });
      if (!settled && (fastX.current || fastY.current)) {
        if (!svgHidden) { svg.current.style.visibility = 'hidden'; svgHidden = true; }
        const colors = readColors();
        syncStripVisibility(fastX.current, 'visX', canvasState, Boolean(c.showXAxis));
        syncStripVisibility(fastY.current, 'visY', canvasState, Boolean(c.showYAxis));
        const zooming = stage.classList.contains('camera-zooming');
        if (c.showXAxis) drawFastStrip(fastX.current, 'ctxX', 'trX', 'cacheX', canvasState, c.camera, layout.displayY ?? layout.originY, width, height, true, colors, zooming);
        if (c.showYAxis) drawFastStrip(fastY.current, 'ctxY', 'trY', 'cacheY', canvasState, c.camera, layout.displayX ?? layout.originX, width, height, false, colors, zooming);
        return;
      }
      readColors();
      syncStripVisibility(fastX.current, 'visX', canvasState, false);
      syncStripVisibility(fastY.current, 'visY', canvasState, false);
      if (svgHidden) { svg.current.style.visibility = ''; svgHidden = false; }
      const svgKey = `${c.camera.x}|${c.camera.y}|${c.camera.scale}|${width}|${height}|${c.showXAxis}|${c.showYAxis}`;
      if (svgKey === lastSvg) return; lastSvg = svgKey;
      if (lastW !== width || lastH !== height) {
        lastW = width; lastH = height;
        svg.current.setAttribute('viewBox', `0 0 ${Math.max(1, width)} ${Math.max(1, height)}`);
      }
      const nextStep = String(layout.step ?? '');
      if (lastStep !== nextStep) {
        lastStep = nextStep;
        svg.current.setAttribute('data-step', nextStep);
      }
      paint(xGroup.current, c.showXAxis ? layout.x : [], layout.displayY ?? layout.originY, height, true);
      paint(yGroup.current, c.showYAxis ? layout.y : [], layout.displayX ?? layout.originX, width, false);
    };
    draw.current = update; stage.addEventListener('agora-camera', update);
    const observer = new ResizeObserver(([entry]) => { width = entry.contentRect.width; height = entry.contentRect.height; update(); }); observer.observe(stage); update();
    return () => { observer.disconnect(); stage.removeEventListener('agora-camera', update); draw.current = null; };
  }, [boardRef]);
  useLayoutEffect(() => { draw.current?.(); }, [camera, showXAxis, showYAxis]);
  return (
    <>
      <canvas className="canvas-axis-ticks-fast canvas-axis-ticks-fast--x" ref={fastX} aria-hidden="true" style={{ visibility: 'hidden' }} />
      <canvas className="canvas-axis-ticks-fast canvas-axis-ticks-fast--y" ref={fastY} aria-hidden="true" style={{ visibility: 'hidden' }} />
      <svg className="canvas-axis-ticks" ref={svg} aria-hidden="true"><g ref={xGroup} data-axis="x" /><g ref={yGroup} data-axis="y" /></svg>
    </>
  );
});

export default CanvasAxisTicks;
