export const MIN_SHAPE_STROKE_WIDTH = .5;
export const MAX_SHAPE_STROKE_WIDTH = 64;
export const shapeStrokeWidth = item => Number.isFinite(item?.strokeWidth) ? Math.max(MIN_SHAPE_STROKE_WIDTH, Math.min(MAX_SHAPE_STROKE_WIDTH, item.strokeWidth)) : 2.5;
export const MAX_POLYGON_VERTICES = 64;
const vertexDefaults = { triangle: 3, pentagon: 5, hexagon: 6, polygon: 6, star: 5 };
export const polygonVertexCount = item => Number.isInteger(item?.vertexCount) && item.vertexCount >= 3 && item.vertexCount <= MAX_POLYGON_VERTICES ? item.vertexCount : vertexDefaults[item?.shapeType] || 6;
export const hasPolygonVertices = type => Object.hasOwn(vertexDefaults, type);
export const hasShapeCorners = type => hasPolygonVertices(type) || ['square', 'rectangle', 'diamond', 'trapezoid', 'paper-a1', 'paper-a2', 'paper-a3', 'paper-a4'].includes(type);
export const shapeFillOpacity = item => Number.isFinite(item?.fillOpacity) ? Math.max(0, Math.min(1, item.fillOpacity)) : 1;
export const sketchFillOpacity = item => Number.isFinite(item?.sketchFillOpacity) ? Math.max(0, Math.min(1, item.sketchFillOpacity)) : .8;
export function validShapeAppearance(field, value) {
  return field === 'strokeWidth' && typeof value === 'number' && Number.isFinite(value) && value >= MIN_SHAPE_STROKE_WIDTH && value <= MAX_SHAPE_STROKE_WIDTH
    || ['fillOpacity', 'sketchFillOpacity'].includes(field) && typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    || field === 'vertexCount' && Number.isInteger(value) && value >= 3 && value <= MAX_POLYGON_VERTICES
    || field === 'cornerStyle' && ['sharp', 'rounded'].includes(value);
}
