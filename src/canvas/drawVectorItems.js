import { shapeFillOpacity, shapeStrokeWidth, sketchFillOpacity } from './shapeAppearance.js';
import { vectorStrokePaths, arrowheadStrokeParts, sketchHatchPaths } from './vectorStyle.js';
import { shapeOutlinePaths, shapeFillPaths } from './shapeGeometry.js';
import { connectorGeometry } from '../components/connectorGeometry.js';
import { shapeArrowGeometry } from '../components/shapeArrowGeometry.js';

const colorNumber = (value) => {
  const parsed = Number.parseInt(String(value || '#263b35').replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : 0x263b35;
};

function drawArrowHead(graphics, head, color, width, transform = (point) => point, visualStyle = 'standard', seed = '') {
  for (const part of arrowheadStrokeParts(head, visualStyle, seed, transform)) {
    drawHatches(graphics, part.hatches, color, Math.max(.7, head.strokeWidth * .45));
    for (const [index, stroke] of part.strokes.entries()) {
      const points = stroke.points;
      if (part.center && visualStyle !== 'sketch') graphics.circle(part.center.x, part.center.y, part.radius);
      else if (part.closed) graphics.poly(points.flatMap(point => [point.x, point.y]));
      else if (points.length) {
        graphics.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(point => graphics.lineTo(point.x, point.y));
      }
      if (part.filled && index === 0 && visualStyle !== 'sketch') graphics.fill({ color, alpha: 1 });
      graphics.stroke({ color, width: head.strokeWidth * stroke.widthScale, alpha: stroke.alpha, cap: 'round', join: 'round' });
    }
  }
}

function drawHatches(graphics, hatches, color, width = 1.2) {
  for (const stroke of hatches) {
    graphics.moveTo(stroke.points[0].x, stroke.points[0].y);
    graphics.lineTo(stroke.points[1].x, stroke.points[1].y);
    graphics.stroke({ color, width: width * stroke.widthScale, alpha: stroke.alpha, cap: 'round' });
  }
}

function drawShapeArrow(graphics, x, y, width, height, angle, color, bend, startHead, endHead, visualStyle, seed, item) {
  const geometry = shapeArrowGeometry(width, height, bend, startHead, endHead, item);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const rotate = (point) => rotatePoint(x + point.x, y + point.y, centerX, centerY, angle);
  const curve = geometry.points.map(rotate);
  drawPolyline(graphics, curve, color, shapeStrokeWidth(item), visualStyle, seed);
  geometry.heads.forEach((head, index) => drawArrowHead(graphics, head, color, shapeStrokeWidth(item), rotate, visualStyle, `${seed}:${index}`));
}

function rotatePoint(x, y, centerX, centerY, angle) {
  if (!angle) return { x, y };
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const dx = x - centerX;
  const dy = y - centerY;
  return { x: centerX + dx * cosine - dy * sine, y: centerY + dx * sine + dy * cosine };
}

function drawPolyline(graphics, points, color, width, visualStyle = 'standard', seed = '') {
  if (!points.length) return;
  for (const stroke of vectorStrokePaths(points, visualStyle, seed)) {
    const path = stroke.points;
    graphics.moveTo(path[0].x, path[0].y);
    for (const point of path.slice(1)) graphics.lineTo(point.x, point.y);
    graphics.stroke({ color, width: width * stroke.widthScale, alpha: stroke.alpha, cap: 'round', join: 'round' });
  }
}

function drawCurvedArrow(graphics, geometry, color, width, visualStyle, seed) {
  if (!geometry?.points?.length) return;
  drawPolyline(graphics, geometry.points, color, width, visualStyle, seed);
  geometry.heads?.forEach((head, index) => drawArrowHead(graphics, head, color, width, undefined, visualStyle, `${seed}:${index}`));
}

export function drawVectorItems(graphics, items, width, height, visibleItemIds = null, referenceItems = items) {
  graphics.clear();
  const entries = Object.entries(items || {}).filter(([id]) => !visibleItemIds || visibleItemIds.has(id));

  for (const [id, item] of entries) {
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
      if (item.strokeEnabled !== false) drawShapeArrow(graphics, x, y, w, h, angle, ink, item.bend, item.startHead, item.endHead, item.visualStyle, id, item);
    } else {
      if (shapeFillOpacity(item) > 0 && /^#[0-9a-f]{6}$/i.test(item.fill || '')) {
        for (const path of shapeFillPaths(item.shapeType, w, h, item)) {
          if (item.visualStyle === 'sketch') {
            const hatches = sketchHatchPaths(path, `${id}:fill`, undefined, shapeFillOpacity(item), sketchFillOpacity(item)).map(stroke => ({ ...stroke,
              points: stroke.points.map(point => rotatePoint(x + point.x, y + point.y, centerX, centerY, angle)) }));
            drawHatches(graphics, hatches, colorNumber(item.fill));
            continue;
          }
          const points = path.map(point => rotatePoint(x + point.x, y + point.y, centerX, centerY, angle));
          graphics.poly(points.flatMap(point => [point.x, point.y])).fill({ color: colorNumber(item.fill), alpha: shapeFillOpacity(item) });
        }
      }
      for (const path of item.strokeEnabled === false ? [] : shapeOutlinePaths(item.shapeType, w, h, item)) {
        drawPolyline(graphics, path.map(point => rotatePoint(x + point.x, y + point.y, centerX, centerY, angle)), ink, shapeStrokeWidth(item), item.visualStyle, id);
      }
    }
  }

  for (const [id, item] of entries) {
    if (item?.kind !== 'connector') continue;
    const geometry = connectorGeometry(item, referenceItems, width, height);
    drawCurvedArrow(graphics, geometry, colorNumber(item.color || '#8b8f8c'), Number(item.strokeWidth) || 1.5, item.visualStyle, id);
  }
}

