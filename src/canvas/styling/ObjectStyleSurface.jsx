import { useId } from 'react';
import {
  readObjectStyle,
  fillLayerToCss,
  buildCornerRadiusCss,
  buildBoxShadowString,
  buildBackdropFilterString,
  buildStrokeDashArray,
  buildCssFilterString,
  hexToRgba,
  filtersEqualDefault,
} from './objectStyleModel.js';
import { objectCornerRadii } from '../objectCorners.js';
import { shapeOutlinePaths } from '../shapeGeometry.js';
import { shapeArrowGeometry } from '../../components/shapeArrowGeometry.js';
import ConnectorArrowheads from '../../components/canvas/ConnectorArrowheads.jsx';

export function roundedRectSvgPath(w, h, radii) {
  const cap = (v) => Math.max(0, Math.min(Number(v) || 0, w / 2, h / 2));
  const tl = cap(radii.tl);
  const tr = cap(radii.tr);
  const br = cap(radii.br);
  const bl = cap(radii.bl);
  return [
    `M ${tl} 0`,
    `L ${w - tr} 0`,
    tr > 0 ? `Q ${w} 0 ${w} ${tr}` : '',
    `L ${w} ${h - br}`,
    br > 0 ? `Q ${w} ${h} ${w - br} ${h}` : '',
    `L ${bl} ${h}`,
    bl > 0 ? `Q 0 ${h} 0 ${h - bl}` : '',
    `L 0 ${tl}`,
    tl > 0 ? `Q 0 0 ${tl} 0` : '',
    'Z',
  ].filter(Boolean).join(' ');
}

function pointsToSvgPath(points, close = true) {
  if (!points?.length) return '';
  const commands = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
  if (close) commands.push('Z');
  return commands.join(' ');
}

function fillLayerBgStyle(layer) {
  const bg = fillLayerToCss(layer);
  if (layer.type === 'image') {
    return {
      backgroundImage: bg,
      backgroundRepeat: layer.size === 'tile' ? 'repeat' : 'no-repeat',
      backgroundSize: layer.size === 'tile' ? 'auto' : layer.size,
      backgroundPosition: 'center center',
      opacity: layer.opacity,
      mixBlendMode: layer.blendMode,
    };
  }
  return {
    background: bg,
    opacity: layer.opacity,
    mixBlendMode: layer.blendMode,
  };
}

export function ObjectStyleBackdrop({ item, borderRadius }) {
  const uid = useId().replace(/:/g, '_');
  const style = readObjectStyle(item);
  const fills = (style.explicitFills || style.fills.some((f) => f.type !== 'solid'))
    ? style.fills.filter((f) => f.visible !== false)
    : [];
  const hasEffects = style.explicitEffects;
  const boxShadow = hasEffects ? buildBoxShadowString(style) : undefined;
  const backdropFilter = hasEffects ? buildBackdropFilterString(style) : undefined;
  const stroke = style.stroke;
  const showDomStroke = stroke?.explicit && !['shape', 'connector', 'stroke'].includes(item?.kind);

  if (!fills.length && !showDomStroke && !backdropFilter && boxShadow === undefined) {
    return null;
  }

  const radius = borderRadius ?? buildCornerRadiusCss(style, item) ?? 'inherit';
  const strokeDash = stroke?.dashPattern !== 'solid';
  const alignOffset = stroke?.align === 'outside'
    ? -stroke.width
    : stroke?.align === 'center'
      ? -stroke.width / 2
      : 0;

  let strokeRingStyle;
  if (showDomStroke && stroke.enabled && !strokeDash) {
    const s = stroke.sides;
    strokeRingStyle = {
      borderStyle: 'solid',
      borderColor: stroke.color,
      borderTopWidth: `${s.top}px`,
      borderRightWidth: `${s.right}px`,
      borderBottomWidth: `${s.bottom}px`,
      borderLeftWidth: `${s.left}px`,
      inset: `${alignOffset}px`,
      borderRadius: radius,
    };
  }

  const dashArray = buildStrokeDashArray(stroke);

  return (
    <div
      className={`canvas-object-style-backdrop${backdropFilter ? ' has-backdrop-blur' : ''}`}
      style={{ borderRadius: radius, backdropFilter, WebkitBackdropFilter: backdropFilter, boxShadow }}
      aria-hidden="true"
    >
      {fills.map((layer) => (
        <div
          key={layer.id}
          className="canvas-object-fill-layer"
          style={fillLayerBgStyle(layer)}
        />
      ))}
      {strokeRingStyle && <div className="canvas-object-stroke-ring" style={strokeRingStyle} />}
      {showDomStroke && stroke.enabled && strokeDash && (
        <svg className="canvas-object-stroke-dash-svg" width="100%" height="100%" aria-hidden="true">
          <rect
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            rx={style.cornerRadius.tl}
            ry={style.cornerRadius.tl}
            fill="none"
            stroke={stroke.color}
            strokeWidth={stroke.width}
            strokeDasharray={dashArray}
            strokeLinecap={stroke.cap}
            strokeLinejoin={stroke.join}
          />
          <defs><clipPath id={`dash_${uid}`} /></defs>
        </svg>
      )}
    </div>
  );
}

function resolveShapePaths(item, w, h, radii) {
  const isRectLike = ['rectangle', 'square'].includes(item?.shapeType || 'rectangle');
  if (isRectLike && (radii.tl > 0 || radii.tr > 0 || radii.br > 0 || radii.bl > 0 || (radii.tl === 0 && radii.tr === 0))) {
    const hasDistinctRadii = new Set([radii.tl, radii.tr, radii.br, radii.bl]).size > 1;
    if (hasDistinctRadii || radii.tl > 0) {
      return [roundedRectSvgPath(w, h, radii)];
    }
  }
  if (item?.shapeType === 'ellipse') {
    return [`M ${w / 2} 0 A ${w / 2} ${h / 2} 0 1 0 ${w / 2} ${h} A ${w / 2} ${h / 2} 0 1 0 ${w / 2} 0 Z`];
  }
  const outline = shapeOutlinePaths(item?.shapeType || 'rectangle', w, h, item);
  return outline.map((pts) => pointsToSvgPath(pts, true)).filter(Boolean);
}

export function AdvancedShapeSurface({ id, item, widthPx, heightPx }) {
  const uid = useId().replace(/:/g, '_');
  const style = readObjectStyle(item);
  const w = Math.max(4, widthPx);
  const h = Math.max(4, heightPx);
  const radii = objectCornerRadii(item, w, h);

  if (item.shapeType === 'arrow') {
    const arrow = shapeArrowGeometry(w, h, item.bend, item.startHead, item.endHead, item);
    const d = pointsToSvgPath(arrow.curvePoints, false);
    const dashArray = buildStrokeDashArray(style.stroke);
    const strokeW = style.stroke.enabled ? style.stroke.width : 0;
    const filterCss = buildCssFilterString(style, 'none');
    return (
      <div className="canvas-shape-advanced-surface" style={{ filter: filterCss }}>
        <svg className="canvas-shape-svg" viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" aria-hidden="true">
          {strokeW > 0 && (
            <>
              <path
                d={d}
                fill="none"
                stroke={style.stroke.color}
                strokeWidth={strokeW}
                strokeDasharray={dashArray}
                strokeLinecap={style.stroke.cap}
                strokeLinejoin={style.stroke.join}
              />
              <ConnectorArrowheads
                geometry={arrow}
                visualStyle={item.visualStyle}
                seed={id}
                strokeWidth={strokeW}
              />
            </>
          )}
        </svg>
      </div>
    );
  }

  const shapePaths = resolveShapePaths(item, w, h, radii);
  const primaryPath = shapePaths[0] || `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
  const combinedPath = shapePaths.join(' ');
  const visibleFills = style.fills.filter((f) => f.visible !== false);
  const hasBackdropBlur = style.effects.some((fx) => fx.enabled !== false && fx.type === 'background-blur' && fx.blur > 0);
  const backdropCss = buildBackdropFilterString(style);
  const innerShadows = style.effects.filter((fx) => fx.enabled !== false && fx.type === 'inner-shadow');
  const isRectLike = ['rectangle', 'square'].includes(item?.shapeType || 'rectangle');
  const isEllipse = item?.shapeType === 'ellipse';
  const useHardwareBoxShadow = isRectLike || isEllipse;
  const filterCss = buildCssFilterString(
    style,
    item.shadowEnabled === false ? 'none' : undefined,
    { includeDropShadow: !useHardwareBoxShadow },
  );
  const rectDropShadow = useHardwareBoxShadow && style.explicitEffects
    ? (() => {
      const drops = style.effects
        .filter((fx) => fx.enabled !== false && fx.type === 'drop-shadow')
        .map((fx) => `${fx.x}px ${fx.y}px ${fx.blur * 1.6}px ${fx.spread}px ${hexToRgba(fx.color, fx.opacity)}`);
      return drops.length ? drops.join(', ') : undefined;
    })()
    : undefined;
  const dashArray = buildStrokeDashArray(style.stroke);
  const stroke = style.stroke;
  const clipId = `shape_clip_${uid}`;
  const outsideMaskId = `shape_out_${uid}`;
  const perSideActive = isRectLike && !stroke.sides.linked && stroke.enabled && !dashArray;
  const fillClipStyle = isRectLike
    ? { borderRadius: `${radii.tl}px ${radii.tr}px ${radii.br}px ${radii.bl}px`, overflow: 'hidden' }
    : isEllipse
      ? { borderRadius: '50%', overflow: 'hidden' }
      : { clipPath: shapePaths.length === 1 ? `path("${primaryPath}")` : `url(#${clipId})` };

  return (
    <div
      className={`canvas-shape-advanced-surface${hasBackdropBlur && useHardwareBoxShadow ? ' has-backdrop-blur' : ''}`}
      style={{
        filter: filterCss,
        ...(rectDropShadow ? { boxShadow: rectDropShadow } : {}),
        ...(isRectLike ? { borderRadius: `${radii.tl}px ${radii.tr}px ${radii.br}px ${radii.bl}px` } : {}),
        ...(isEllipse ? { borderRadius: '50%' } : {}),
        ...(hasBackdropBlur && useHardwareBoxShadow ? { backdropFilter: backdropCss, WebkitBackdropFilter: backdropCss, overflow: 'hidden' } : {}),
      }}
    >
      {visibleFills.length > 0 && (
        <div className="canvas-shape-fill-host" style={{ position: 'absolute', inset: 0, ...fillClipStyle }} aria-hidden="true">
          {visibleFills.map((layer) => (
            <div
              key={layer.id}
              className="canvas-object-fill-layer"
              style={fillLayerBgStyle(layer)}
            />
          ))}
        </div>
      )}

      {innerShadows.length > 0 && (isRectLike || isEllipse) && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: isEllipse ? '50%' : `${radii.tl}px ${radii.tr}px ${radii.br}px ${radii.bl}px`,
            boxShadow: innerShadows
              .map((fx) => `inset ${fx.x}px ${fx.y}px ${fx.blur}px ${fx.spread}px ${hexToRgba(fx.color, fx.opacity)}`)
              .join(', '),
          }}
        />
      )}

      <svg className="canvas-shape-svg" viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" aria-hidden="true">
        {(stroke.align === 'inside' || stroke.align === 'outside' || shapePaths.length > 1) && (
          <defs>
            {(stroke.align === 'inside' || shapePaths.length > 1) && (
              <clipPath id={clipId}>
                <path d={combinedPath} />
              </clipPath>
            )}
            {stroke.enabled && stroke.align === 'outside' && (
              <mask id={outsideMaskId} maskUnits="userSpaceOnUse" x={-80} y={-80} width={w + 160} height={h + 160}>
                <rect x={-80} y={-80} width={w + 160} height={h + 160} fill="#ffffff" />
                <path d={combinedPath} fill="#000000" />
              </mask>
            )}
          </defs>
        )}

        {stroke.enabled && !perSideActive && (
          stroke.align === 'inside' ? (
            <path
              d={primaryPath}
              fill="none"
              stroke={stroke.color}
              strokeWidth={stroke.width * 2}
              strokeDasharray={dashArray}
              strokeLinecap={stroke.cap}
              strokeLinejoin={stroke.join}
              clipPath={`url(#${clipId})`}
            />
          ) : stroke.align === 'outside' ? (
            <path
              d={primaryPath}
              fill="none"
              stroke={stroke.color}
              strokeWidth={stroke.width * 2}
              strokeDasharray={dashArray}
              strokeLinecap={stroke.cap}
              strokeLinejoin={stroke.join}
              mask={`url(#${outsideMaskId})`}
            />
          ) : (
            shapePaths.map((d, idx) => (
              <path
                key={idx}
                d={d}
                fill="none"
                stroke={stroke.color}
                strokeWidth={stroke.width}
                strokeDasharray={dashArray}
                strokeLinecap={stroke.cap}
                strokeLinejoin={stroke.join}
              />
            ))
          )
        )}
      </svg>

      {perSideActive && (
        <div
          className="canvas-object-stroke-ring"
          style={{
            borderStyle: 'solid',
            borderColor: stroke.color,
            borderTopWidth: `${stroke.sides.top}px`,
            borderRightWidth: `${stroke.sides.right}px`,
            borderBottomWidth: `${stroke.sides.bottom}px`,
            borderLeftWidth: `${stroke.sides.left}px`,
            borderRadius: `${radii.tl}px ${radii.tr}px ${radii.br}px ${radii.bl}px`,
            inset: stroke.align === 'outside' ? `-${stroke.width}px` : stroke.align === 'center' ? `-${stroke.width / 2}px` : '0',
          }}
          aria-hidden="true"
        />
      )}

      {Boolean(item.text) && (
        <div
          className="canvas-shape-text-overlay"
          style={{
            color: style.typography.textColor || stroke.color || 'var(--ink-strong)',
            fontFamily: style.typography.fontFamily || undefined,
            fontWeight: style.typography.fontWeight || 500,
            lineHeight: style.typography.lineHeight || 1.4,
            letterSpacing: style.typography.letterSpacing ? `${style.typography.letterSpacing}px` : undefined,
            textAlign: style.typography.textAlign || 'center',
            fontSize: item.fontSize ? `${item.fontSize}px` : undefined,
          }}
        >
          {item.text}
        </div>
      )}
    </div>
  );
}

export function AdvancedConnectorSvg({ id, item, geometry, offsetX, offsetY, width, height }) {
  const style = readObjectStyle(item);
  const curvePath = geometry?.points?.map((point, index) => `${index ? 'L' : 'M'}${point.x - offsetX} ${point.y - offsetY}`).join(' ');
  if (!curvePath) return null;

  const stroke = style.stroke;
  const strokeWidth = stroke.enabled ? stroke.width : (Number(item.strokeWidth) || 1.5);
  const strokeColor = stroke.color || item.color || '#8b8f8c';
  const flow = style.connector.dashAnimation;
  const dashArray = buildStrokeDashArray(stroke) || (flow !== 'none' ? '8 6' : undefined);
  const filterCss = !filtersEqualDefault(style.filters) || style.explicitEffects
    ? buildCssFilterString(style, 'none')
    : undefined;
  const ends = [geometry?.start, geometry?.end].filter(Boolean);

  return (
    <svg
      className={`connector-hit-path connector-advanced-svg${flow !== 'none' ? ` connector-flow-${flow}` : ''}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{
        opacity: style.opacity,
        mixBlendMode: style.blendMode !== 'normal' ? style.blendMode : undefined,
        filter: filterCss,
        '--connector-flow-duration': `${(1.2 / (style.connector.animationSpeed || 1)).toFixed(2)}s`,
        '--object-color': strokeColor,
      }}
      aria-hidden="true"
    >
      {/* Invisible wide hit path preserves click selection */}
      <path d={curvePath} />
      {stroke.enabled && (
        <path
          d={curvePath}
          className="connector-visible-stroke"
          style={{
            stroke: strokeColor,
            strokeWidth,
            strokeDasharray: dashArray,
            strokeLinecap: stroke.cap,
            strokeLinejoin: stroke.join,
          }}
        />
      )}
      {ends.map((point, index) => (
        <circle key={index} cx={point.x - offsetX} cy={point.y - offsetY} r="9" />
      ))}
      <ConnectorArrowheads
        visualStyle={item.visualStyle}
        seed={id}
        geometry={geometry}
        offsetX={offsetX}
        offsetY={offsetY}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}
