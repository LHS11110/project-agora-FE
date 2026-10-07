import { getStroke } from 'perfect-freehand';
import { freehandOptions } from './freehandOptions.js';
import { penStrokePoints } from './penStroke.js';

export const INK_BRUSH = 'ink';
export function inkStrokeSize(width) {
  return Math.max(0.5, Number(width) || 3.5) * 1.6;
}
export function strokePaintSize(stroke) {
  const width = Math.max(.5, Number(stroke.strokeWidth) || 3.5);
  return [INK_BRUSH, 'pen'].includes(stroke.brush) ? inkStrokeSize(width)
    : stroke.brush === 'highlighter' ? width * 3
    : stroke.brush === 'spray' ? width * 4.3 : width;
}
export function inkPointAtPointer(event, point) {
  return event.pointerType === 'pen'
    ? { ...point, pressure: Math.max(0.05, Math.min(1, Number(event.pressure) || 0.5)) }
    : point;
}

/** Pixel-space outline shared by saved strokes, live previews and local drawing. */
export function inkStrokeOutline(points, stroke) {
  const size = inkStrokeSize(stroke.strokeWidth);
  const samples = points.map(point => ({
    x: point.x, y: point.y,
    pressure: Number.isFinite(point.pressure) ? Math.max(0, Math.min(1, point.pressure)) : 0.5,
  }));
  return getStroke(stroke.brush === 'pen' ? penStrokePoints(samples, stroke) : samples, freehandOptions(stroke, size));
}
