import { connectorGeometry, OBJECT_SIZES } from './connectorGeometry.js';

function unionBounds(entries) {
  return entries.reduce((bounds, entry) => ({
    minX: Math.min(bounds.minX, entry.bounds.minX),
    minY: Math.min(bounds.minY, entry.bounds.minY),
    maxX: Math.max(bounds.maxX, entry.bounds.maxX),
    maxY: Math.max(bounds.maxY, entry.bounds.maxY),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function rotatedBounds(bounds, rotation, viewportWidth, viewportHeight) {
  const degrees = Number(rotation);
  if (!Number.isFinite(degrees) || degrees === 0) return bounds;
  const centerX = (bounds.minX + bounds.maxX) / 2 * viewportWidth;
  const centerY = (bounds.minY + bounds.maxY) / 2 * viewportHeight;
  const angle = degrees * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const corners = [
    [bounds.minX * viewportWidth, bounds.minY * viewportHeight],
    [bounds.maxX * viewportWidth, bounds.minY * viewportHeight],
    [bounds.maxX * viewportWidth, bounds.maxY * viewportHeight],
    [bounds.minX * viewportWidth, bounds.maxY * viewportHeight],
  ].map(([x, y]) => {
    const dx = x - centerX;
    const dy = y - centerY;
    return {
      x: centerX + dx * cosine - dy * sine,
      y: centerY + dx * sine + dy * cosine,
    };
  });
  return corners.reduce((rotated, point) => ({
    minX: Math.min(rotated.minX, point.x / viewportWidth),
    minY: Math.min(rotated.minY, point.y / viewportHeight),
    maxX: Math.max(rotated.maxX, point.x / viewportWidth),
    maxY: Math.max(rotated.maxY, point.y / viewportHeight),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function objectBounds(item, items, viewportWidth = 1, viewportHeight = 1) {
  const width = Math.max(1, Number(viewportWidth) || 1);
  const height = Math.max(1, Number(viewportHeight) || 1);
  if (item?.kind === 'stroke' && Array.isArray(item.points) && item.points.length) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of item.points) {
      const x = (Number(point.x) || 0) * width;
      const y = (Number(point.y) || 0) * height;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const pad = Math.max(2, (Number(item.strokeWidth) || 3.5) / 2);
    const rotation = (Number(item.rotation) || 0) * Math.PI / 180;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const points = item.points.map((point) => {
      const dx = (Number(point.x) || 0) * width - centerX;
      const dy = (Number(point.y) || 0) * height - centerY;
      return { x: centerX + dx * cosine - dy * sine, y: centerY + dx * sine + dy * cosine };
    });
    const bounds = points.reduce((current, point) => ({
      minX: Math.min(current.minX, point.x),
      minY: Math.min(current.minY, point.y),
      maxX: Math.max(current.maxX, point.x),
      maxY: Math.max(current.maxY, point.y),
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    return { minX: (bounds.minX - pad) / width, minY: (bounds.minY - pad) / height,
      maxX: (bounds.maxX + pad) / width, maxY: (bounds.maxY + pad) / height };
  }

  if (item?.kind === 'connector') {
    const geometry = connectorGeometry(item, items, width, height);
    if (geometry?.points.length) {
      const pad = Math.max(8, (Number(item.strokeWidth) || 1.5) / 2 + 6);
      const bounds = geometry.points.reduce((current, point) => ({
        minX: Math.min(current.minX, point.x),
        minY: Math.min(current.minY, point.y),
        maxX: Math.max(current.maxX, point.x),
        maxY: Math.max(current.maxY, point.y),
      }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
      return { minX: (bounds.minX - pad) / width, minY: (bounds.minY - pad) / height,
        maxX: (bounds.maxX + pad) / width, maxY: (bounds.maxY + pad) / height };
    }
  }

  const [defaultWidth, defaultHeight] = OBJECT_SIZES[item?.kind] || [0.2, 0.12];
  const x = Number(item?.x) || 0;
  const y = Number(item?.y) || 0;
  const objectWidth = Number(item?.width) || defaultWidth;
  const objectHeight = Number(item?.height) || defaultHeight;
  return rotatedBounds({ minX: x, minY: y, maxX: x + objectWidth, maxY: y + objectHeight }, item?.rotation, width, height);
}

function intersects(a, b) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

// A packed spatial B-tree: each internal node stores a bounding rectangle for
// up to FANOUT children, and leaves store item rectangles. It is bulk-rebuilt
// on document changes and queried in logarithmic-ish time for the visible area.
export default class CanvasSpatialBTree {
  constructor(items = {}, viewSize = { width: 1, height: 1 }, fanout = 12) {
    this.fanout = fanout;
    const width = viewSize.width || 1;
    const height = viewSize.height || 1;
    const entries = Object.entries(items).map(([id, item]) => ({ id, item, bounds: objectBounds(item, items, width, height) }));
    this.root = this.#build(entries);
  }

  #build(entries) {
    if (!entries.length) return null;
    const bounds = unionBounds(entries);
    if (entries.length <= this.fanout) return { bounds, entries };

    const axis = bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY ? 'x' : 'y';
    const sorted = [...entries].sort((a, b) => {
      const centerA = axis === 'x' ? (a.bounds.minX + a.bounds.maxX) / 2 : (a.bounds.minY + a.bounds.maxY) / 2;
      const centerB = axis === 'x' ? (b.bounds.minX + b.bounds.maxX) / 2 : (b.bounds.minY + b.bounds.maxY) / 2;
      return centerA - centerB;
    });
    const childCount = Math.ceil(sorted.length / this.fanout);
    const chunkSize = Math.ceil(sorted.length / childCount);
    const children = [];
    for (let offset = 0; offset < sorted.length; offset += chunkSize) {
      children.push(this.#build(sorted.slice(offset, offset + chunkSize)));
    }
    return { bounds, children };
  }

  query(bounds) {
    if (!this.root) return [];
    const result = [];
    const visit = (node) => {
      if (!intersects(node.bounds, bounds)) return;
      if (node.entries) {
        for (const entry of node.entries) if (intersects(entry.bounds, bounds)) result.push(entry);
        return;
      }
      for (const child of node.children) visit(child);
    };
    visit(this.root);
    return result;
  }
}

export { objectBounds };
