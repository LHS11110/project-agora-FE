import { strokePaintSize } from '../canvas/inkStroke.js';

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const progress = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * progress), point.y - (start.y + dy * progress));
}

function interpolate(start, end, progress) {
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
    ...(Number.isFinite(start.pressure) || Number.isFinite(end.pressure) ? {
      pressure: (start.pressure ?? end.pressure) + ((end.pressure ?? start.pressure) - (start.pressure ?? end.pressure)) * progress,
    } : {}),
  };
}

function distanceAlongStroke(progress, start, end, eraserStart, eraserEnd) {
  return pointToSegmentDistance(interpolate(start, end, progress), eraserStart, eraserEnd);
}

function erasedInterval(start, end, eraserStart, eraserEnd, radius) {
  const distanceAt = (progress) => distanceAlongStroke(progress, start, end, eraserStart, eraserEnd);
  let low = 0;
  let high = 1;

  // Distance to a line segment is convex along this stroke segment, so ternary search
  // locates the closest point before finding the two brush-edge intersections.
  for (let step = 0; step < 24; step += 1) {
    const first = low + (high - low) / 3;
    const second = high - (high - low) / 3;
    if (distanceAt(first) <= distanceAt(second)) high = second;
    else low = first;
  }

  const closest = (low + high) / 2;
  if (distanceAt(closest) > radius) return null;

  let from = 0;
  if (distanceAt(0) > radius) {
    low = 0;
    high = closest;
    for (let step = 0; step < 24; step += 1) {
      const middle = (low + high) / 2;
      if (distanceAt(middle) <= radius) high = middle;
      else low = middle;
    }
    from = high;
  }

  let to = 1;
  if (distanceAt(1) > radius) {
    low = closest;
    high = 1;
    for (let step = 0; step < 24; step += 1) {
      const middle = (low + high) / 2;
      if (distanceAt(middle) <= radius) low = middle;
      else high = middle;
    }
    to = low;
  }

  return [from, to];
}

function rotate(point, center, angle) {
  if (!angle) return point;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const x = point.x - center.x;
  const y = point.y - center.y;
  return { x: center.x + x * cosine - y * sine, y: center.y + x * sine + y * cosine };
}

function appendPoint(points, point) {
  const previous = points[points.length - 1];
  if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 1e-9) points.push(point);
}

/**
 * Remove the part of a stroke swept by the eraser and return the surviving paths.
 * Returns null when the eraser misses, an empty array when it removes all ink, or
 * one or more point arrays for the remaining pieces.
 */
export function eraseStrokeWithEraser(stroke, eraserStart, eraserEnd, viewSize, scale = 1, radius = 12) {
  const source = stroke?.points;
  if (!Array.isArray(source) || source.length === 0) return null;

  const width = Math.max(1, Number(viewSize?.width) || 1);
  const height = Math.max(1, Number(viewSize?.height) || 1);
  const zoom = Math.max(0.01, Number(scale) || 1);
  const toPixels = (point) => ({ x: (Number(point.x) || 0) * width * zoom, y: (Number(point.y) || 0) * height * zoom });
  const eraserA = toPixels(eraserStart);
  const eraserB = toPixels(eraserEnd);
  const strokeRadius = strokePaintSize(stroke) * zoom / 2;
  const hitDistance = Math.max(1, Number(radius) || 12) + strokeRadius;
  const pixels = source.map(toPixels);
  const bounds = pixels.reduce((current, point) => ({
    minX: Math.min(current.minX, point.x),
    minY: Math.min(current.minY, point.y),
    maxX: Math.max(current.maxX, point.x),
    maxY: Math.max(current.maxY, point.y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  const angle = (Number(stroke.rotation) || 0) * Math.PI / 180;
  const hitPixels = pixels.map((point) => rotate(point, center, angle));

  if (source.length === 1) return pointToSegmentDistance(hitPixels[0], eraserA, eraserB) <= hitDistance ? [] : null;

  const paths = [];
  let current = [];
  let didErase = false;
  const finishCurrent = () => {
    if (current.length) paths.push(current);
    current = [];
  };

  for (let index = 1; index < source.length; index += 1) {
    const sourceStart = source[index - 1];
    const sourceEnd = source[index];
    const hit = erasedInterval(hitPixels[index - 1], hitPixels[index], eraserA, eraserB, hitDistance);

    if (!hit) {
      if (!current.length) current.push(sourceStart);
      else appendPoint(current, sourceStart);
      appendPoint(current, sourceEnd);
      continue;
    }

    didErase = true;
    const [from, to] = hit;
    if (from > 1e-7) {
      if (!current.length) current.push(sourceStart);
      else appendPoint(current, sourceStart);
      appendPoint(current, interpolate(sourceStart, sourceEnd, from));
    }
    finishCurrent();

    if (to < 1 - 1e-7) {
      current.push(interpolate(sourceStart, sourceEnd, to));
      appendPoint(current, sourceEnd);
    }
  }
  finishCurrent();

  return didErase ? paths : null;
}
