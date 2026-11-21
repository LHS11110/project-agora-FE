import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import { ui } from '../../i18n/locale.js';
import '../../canvas/runtimeEn.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { STYLE_PRESETS, applyPresetToItem } from '../../canvas/styling/stylePresets.js';
import { isHideableObject, readObjectStyle, readObjectVisibility, writeObjectStylePatch } from '../../canvas/styling/objectStyleModel.js';
import { OBJECT_SIZES } from '../connectorGeometry.js';
import { objectFontSize, MIN_OBJECT_FONT_SIZE, MAX_OBJECT_FONT_SIZE } from '../../canvas/objectSize.js';
import { itemCapabilities } from '../../canvas/styling/selectionIntersection.js';

function computeWorldSelectionBounds(selectedIds, items, boardSize) {
  if (!selectedIds?.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasFrame = false;

  for (const id of selectedIds) {
    const item = items[String(id)];
    if (!item || item.kind === 'connector' || item.kind === 'stroke') continue;
    if (item.kind === 'frame') hasFrame = true;
    const def = OBJECT_SIZES[item.kind] || [0.2, 0.14];
    const wx = (Number(item.x) || 0) * boardSize.width;
    const wy = (Number(item.y) || 0) * boardSize.height;
    const ww = (Number(item.width) || def[0]) * boardSize.width;
    const wh = (Number(item.height) || def[1]) * boardSize.height;
    minX = Math.min(minX, wx);
    minY = Math.min(minY, wy);
    maxX = Math.max(maxX, wx + ww);
    maxY = Math.max(maxY, wy + wh);
  }

  if (!Number.isFinite(minX)) {
    for (const id of selectedIds) {
      const item = items[String(id)];
      if (!item) continue;
      if (item.kind === 'connector') {
        const f = items[item.from];
        const t = items[item.to];
        if (f && t) {
          const cx = (((Number(f.x) || 0) + (Number(t.x) || 0)) / 2 + 0.08) * boardSize.width;
          const cy = (((Number(f.y) || 0) + (Number(t.y) || 0)) / 2) * boardSize.height;
          minX = Math.min(minX, cx);
          maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy);
          maxY = Math.max(maxY, cy);
        }
      } else if (item.kind === 'stroke' && item.points?.length) {
        for (const p of item.points) {
          const wx = p.x * boardSize.width;
          const wy = p.y * boardSize.height;
          minX = Math.min(minX, wx);
          minY = Math.min(minY, wy);
          maxX = Math.max(maxX, wx);
          maxY = Math.max(maxY, wy);
        }
      }
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY, hasFrame } : null;
}

function computeBarCoords(worldBounds, cam, viewport, layout) {
  const minX = worldBounds.minX * cam.scale + cam.x;
  const minY = worldBounds.minY * cam.scale + cam.y;
  const maxX = worldBounds.maxX * cam.scale + cam.x;
  const maxY = worldBounds.maxY * cam.scale + cam.y;
  const vw = Math.max(1, viewport?.width || 1200);
  const vh = Math.max(1, viewport?.height || 800);
  const barHeight = layout.barHeight || 42;
  // Selected frames expose their external caption drag handle above the top edge.
  const captionOffset = worldBounds.hasFrame ? Math.max(24, Math.ceil(32 * (cam.scale || 1))) : 0;
  const aboveTop = minY - captionOffset - barHeight - 6;
  const placeBelow = aboveTop < 14;
  const topPx = placeBelow ? Math.min(vh - (barHeight + 18), maxY + 12) : aboveTop;
  const overlapsBarY = (r) => Boolean(r && (topPx + barHeight) > r.top && topPx < r.bottom);
  const safeMinX = overlapsBarY(layout.tools) ? Math.max(12, Math.round(layout.tools.right) + 12) : 12;
  const safeMaxX = overlapsBarY(layout.inspector) ? Math.min(vw - 12, Math.round(layout.inspector.left) - 12) : vw - 12;
  const usableWidth = Math.max(120, safeMaxX - safeMinX);
  const barWidth = layout.barWidth || 560;
  const halfW = barWidth / 2;
  const centerX = usableWidth <= barWidth
    ? (safeMinX + safeMaxX) / 2
    : Math.max(safeMinX + halfW, Math.min(safeMaxX - halfW, (minX + maxX) / 2));
  return { centerX, topPx };
}

let cachedToolbarLayoutMetrics = { barWidth: 560, barHeight: 42, tools: null, inspector: null };

const FloatingContextToolbar = memo(function FloatingContextToolbar({
  selectedIds,
  items,
  camera,
  boardSize,
  viewportSize,
  onPatchStyle,
  onFontSizeChange,
  onBringToFront,
  onSendToBack,
  onCopyStyle,
  onPasteStyle,
  hasCopiedStyle,
  onToggleLock,
  onToggleHidden,
}) {
  useUiLocale();
  const fieldId = useId();
  const [showPresets, setShowPresets] = useState(false);
  const barRef = useRef(null);
  const [layoutMetrics, setLayoutMetrics] = useState(() => cachedToolbarLayoutMetrics);
  const layoutMetricsRef = useRef(layoutMetrics);
  layoutMetricsRef.current = layoutMetrics;

  const worldBounds = useMemo(
    () => computeWorldSelectionBounds(selectedIds, items, boardSize),
    [selectedIds, items, boardSize],
  );
  const latestRef = useRef(null);
  latestRef.current = { worldBounds, viewportSize };

  useLayoutEffect(() => {
    const node = barRef.current;
    const stageEl = node?.closest?.('.canvas-stage');
    if (!node || !stageEl) return undefined;
    const scopeEl = stageEl.closest?.('.canvas-app-page') || document;
    const toolsEl = scopeEl.querySelector?.('.canvas-panel-slot-tools');
    const inspectorEl = scopeEl.querySelector?.('.canvas-panel-slot-inspector');

    const measure = () => {
      const stageRect = stageEl.getBoundingClientRect();
      const relRect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0 || getComputedStyle(el).display === 'none') return null;
        return {
          top: r.top - stageRect.top,
          bottom: r.bottom - stageRect.top,
          left: r.left - stageRect.left,
          right: r.right - stageRect.left,
        };
      };
      const barWidth = node.offsetWidth || 560;
      const barHeight = node.offsetHeight || 42;
      const tools = relRect(toolsEl);
      const inspector = relRect(inspectorEl);
      const prev = layoutMetricsRef.current;
      const sameRect = (a, b) => a === b || (a && b && a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right);
      if (Math.abs(barWidth - prev.barWidth) > 2 || Math.abs(barHeight - prev.barHeight) > 2 || !sameRect(tools, prev.tools) || !sameRect(inspector, prev.inspector)) {
        const nextMetrics = { barWidth, barHeight, tools, inspector };
        cachedToolbarLayoutMetrics = nextMetrics;
        setLayoutMetrics(nextMetrics);
      }
    };

    if (typeof ResizeObserver !== 'function') {
      measure();
      return undefined;
    }
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    ro.observe(stageEl);
    if (toolsEl) ro.observe(toolsEl);
    if (inspectorEl) ro.observe(inspectorEl);
    return () => ro.disconnect();
  }, [Boolean(worldBounds && selectedIds?.length)]);

  useEffect(() => {
    const node = barRef.current;
    const stageEl = node?.closest?.('.canvas-stage');
    if (!node || !stageEl) return undefined;
    const onCamera = (event) => {
      const bounds = latestRef.current?.worldBounds;
      if (!bounds || !barRef.current) return;
      const { camera: liveCam, viewport } = event.detail || {};
      if (!liveCam) return;
      const { centerX, topPx } = computeBarCoords(bounds, liveCam, viewport || latestRef.current.viewportSize, layoutMetricsRef.current);
      barRef.current.style.transform = `translate3d(${centerX}px, ${topPx}px, 0) translateX(-50%)`;
    };
    stageEl.addEventListener('agora-camera', onCamera);
    return () => stageEl.removeEventListener('agora-camera', onCamera);
  }, [Boolean(worldBounds && selectedIds?.length)]);

  if (!selectedIds?.length || !viewportSize?.width || !worldBounds) return null;

  const { centerX, topPx } = computeBarCoords(worldBounds, camera, viewportSize, layoutMetrics);

  const primary = items[selectedIds[0]];
  const style = readObjectStyle(primary);
  const caps = itemCapabilities(primary);
  const fillHex = style.fills?.[0]?.type === 'solid'
    ? style.fills[0].color
    : style.fills?.[0]?.stops?.[0]?.color || '#d8e8dc';
  const strokeHex = style.stroke?.color || '#617d68';
  const opacityPct = Math.round((style.opacity ?? 1) * 100);
  const currentFontSize = Math.round(objectFontSize(primary));
  const anyLocked = selectedIds.some((id) => items[id]?.locked === true);
  const hideableIds = selectedIds.filter((id) => isHideableObject(items[id]));
  const anyHidden = hideableIds.some((id) => readObjectVisibility(items[id]).hidden);

  return (
    <div
      ref={barRef}
      className="canvas-floating-context-bar"
      data-canvas-ui="true"
      role="toolbar"
      aria-label={ui('선택 객체 빠른 스타일 툴바')}
      style={{ left: 0, top: 0, transform: `translate3d(${centerX}px, ${topPx}px, 0) translateX(-50%)` }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {caps.fill && (
        <label className="floating-bar-color" title={ui('배경 색상')}>
          <span>{ui('채우기')}</span>
          <input
            id={`${fieldId}-fill-color`}
            name="floating-fill-color"
            type="color"
            aria-label={ui('빠른 채우기 색상')}
            value={fillHex}
            onChange={(e) => {
              const color = e.target.value;
              onPatchStyle(selectedIds, (item) => writeObjectStylePatch(item, (cur) => ({
                ...cur,
                explicitFills: true,
                fills: [{
                  id: 'quick-fill',
                  visible: true,
                  type: 'solid',
                  color,
                  opacity: cur.fills?.[0]?.opacity ?? 1,
                  blendMode: 'normal',
                }],
              })));
            }}
          />
        </label>
      )}

      {caps.stroke && (
        <label className="floating-bar-color" title={ui('테두리 색상')}>
          <span>{ui('선')}</span>
          <input
            id={`${fieldId}-stroke-color`}
            name="floating-stroke-color"
            type="color"
            aria-label={ui('빠른 테두리 색상')}
            value={strokeHex}
            onChange={(e) => {
              const color = e.target.value;
              onPatchStyle(selectedIds, (item) => writeObjectStylePatch(item, (cur) => ({
                ...cur,
                stroke: { ...cur.stroke, explicit: true, enabled: true, color },
              })));
            }}
          />
        </label>
      )}

      {caps.stroke && (
        <label className="floating-bar-num" title={ui('테두리 두께')}>
          <input
            id={`${fieldId}-stroke-width`}
            name="floating-stroke-width"
            type="number"
            min="0.5"
            max="32"
            step="0.5"
            aria-label={ui('빠른 테두리 두께')}
            value={style.stroke.width}
            onChange={(e) => {
              const w = Math.max(0.5, Math.min(32, Number(e.target.value) || 1));
              onPatchStyle(selectedIds, (item) => writeObjectStylePatch(item, (cur) => ({
                ...cur,
                stroke: {
                  ...cur.stroke,
                  explicit: true,
                  enabled: true,
                  width: w,
                  sides: { linked: true, top: w, right: w, bottom: w, left: w },
                },
              })));
            }}
          />
        </label>
      )}

      <label className="floating-bar-num" title={ui('투명도')}>
        <span>%</span>
        <input
          id={`${fieldId}-opacity`}
          name="floating-opacity"
          type="number"
          min="0"
          max="100"
          step="5"
          aria-label={ui('빠른 투명도')}
          value={opacityPct}
          onChange={(e) => {
            const o = Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100;
            onPatchStyle(selectedIds, (item) => writeObjectStylePatch(item, (cur) => ({ ...cur, opacity: o })));
          }}
        />
      </label>

      {caps.typography && (
        <>
          <span className="floating-bar-sep" />
          <button
            type="button"
            className="floating-bar-btn"
            aria-label={ui('글자 크기 줄이기')}
            onClick={() => onFontSizeChange(selectedIds, Math.max(MIN_OBJECT_FONT_SIZE, currentFontSize - 2))}
          >
            A-
          </button>
          <span style={{ fontSize: 10, minWidth: 22, textAlign: 'center', fontWeight: 600 }}>{currentFontSize}</span>
          <button
            type="button"
            className="floating-bar-btn"
            aria-label={ui('글자 크기 키우기')}
            onClick={() => onFontSizeChange(selectedIds, Math.min(MAX_OBJECT_FONT_SIZE, currentFontSize + 2))}
          >
            A+
          </button>
        </>
      )}

      <span className="floating-bar-sep" />

      <button
        type="button"
        className="floating-bar-btn"
        title={ui('맨 앞으로 가져오기')}
        aria-label={ui('맨 앞으로 가져오기')}
        onClick={() => onBringToFront(selectedIds)}
      >
        ↑{ui('앞')}
      </button>
      <button
        type="button"
        className="floating-bar-btn"
        title={ui('맨 뒤로 보내기')}
        aria-label={ui('맨 뒤로 보내기')}
        onClick={() => onSendToBack(selectedIds)}
      >
        ↓{ui('뒤')}
      </button>

      <span className="floating-bar-sep" />

      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className={`floating-bar-btn${showPresets ? ' active' : ''}`}
          aria-expanded={showPresets}
          onClick={() => setShowPresets((v) => !v)}
        >
          {ui('프리셋')}
        </button>
        {showPresets && (
          <div className="canvas-floating-context-popover">
            {STYLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="canvas-floating-preset-chip"
                onClick={() => {
                  onPatchStyle(selectedIds, (item) => applyPresetToItem(item, preset.id));
                  setShowPresets(false);
                }}
              >
                <span className="canvas-floating-preset-swatch" style={preset.preview} />
                <span>{ui(preset.name)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="floating-bar-btn"
        title={ui('스타일 복사 (Alt+Ctrl+C)')}
        aria-label={ui('스타일 복사')}
        onClick={onCopyStyle}
      >
        {ui('복사')}
      </button>
      <button
        type="button"
        className="floating-bar-btn"
        disabled={!hasCopiedStyle}
        title={ui('스타일 붙여넣기 (Alt+Ctrl+V)')}
        aria-label={ui('스타일 붙여넣기')}
        onClick={onPasteStyle}
      >
        {ui('붙이기')}
      </button>
      <button
        type="button"
        className={`floating-bar-btn${anyLocked ? ' active' : ''}`}
        title={anyLocked ? ui('빠른 잠금 해제') : ui('빠른 잠금')}
        aria-label={anyLocked ? ui('빠른 잠금 해제') : ui('빠른 잠금')}
        onClick={() => onToggleLock(selectedIds, !anyLocked)}
      >
        {anyLocked ? '🔒' : '🔓'}
      </button>
      {onToggleHidden && hideableIds.length > 0 && (
        <button
          type="button"
          className={`floating-bar-btn${anyHidden ? ' active' : ''}`}
          title={anyHidden ? ui('선택 객체 표시') : ui('선택 객체 숨김')}
          aria-label={anyHidden ? ui('선택 객체 표시') : ui('선택 객체 숨김')}
          onClick={() => onToggleHidden(hideableIds, !anyHidden)}
        >
          <Icon name={anyHidden ? 'eye' : 'eyeOff'} size={13} />
        </button>
      )}
    </div>
  );
});

export default FloatingContextToolbar;
