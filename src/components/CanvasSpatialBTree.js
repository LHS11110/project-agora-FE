const OBJECT_SIZES = {
  image: [0.3, 0.2],
  code: [0.32, 0.2],
  shape: [0.14, 0.12],
  math: [0.2, 0.09],
  text: [0.22, 0.12],
  note: [0.22, 0.15],
};

function unionBounds(entries) {
  return entries.reduce((bounds, entry) => ({
    minX: Math.min(bounds.minX, entry.bounds.minX),
    minY: Math.min(bounds.minY, entry.bounds.minY),
    maxX: Math.max(bounds.maxX, entry.bounds.maxX),
    maxY: Math.max(bounds.maxY, entry.bounds.maxY),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function objectBounds(item, items) {
  if (item?.kind === 'stroke' && Array.isArray(item.points) && item.points.length) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of item.points) {
      const x = Number(point.x) || 0;
      const y = Number(point.y) || 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const pad = Math.max(0.002, (Number(item.strokeWidth) || 3.5) / 1600);
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
    };
  }

  if (item?.kind === 'connector') {
    const from = items[item.from];
    const to = items[item.to];
    if (from && to) {
      const center = (object) => {
        const [defaultWidth, defaultHeight] = OBJECT_SIZES[object.kind] || [0.2, 0.12];
        const width = Number(object.width) || defaultWidth;
        const height = Number(object.height) || defaultHeight;
        return { x: (Number(object.x) || 0) + width / 2, y: (Number(object.y) || 0) + height / 2 };
      };
      const a = center(from);
      const b = center(to);
      return { minX: Math.min(a.x, b.x) - 0.012, minY: Math.min(a.y, b.y) - 0.012,
        maxX: Math.max(a.x, b.x) + 0.012, maxY: Math.max(a.y, b.y) + 0.012 };
    }
  }

  const [defaultWidth, defaultHeight] = OBJECT_SIZES[item?.kind] || [0.2, 0.12];
  const x = Number(item?.x) || 0;
  const y = Number(item?.y) || 0;
  const width = Number(item?.width) || defaultWidth;
  const height = Number(item?.height) || defaultHeight;
  return { minX: x, minY: y, maxX: x + width, maxY: y + height };
}

function intersects(a, b) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

// A packed spatial B-tree: each internal node stores a bounding rectangle for
// up to FANOUT children, and leaves store item rectangles. It is bulk-rebuilt
// on document changes and queried in logarithmic-ish time for the visible area.
export default class CanvasSpatialBTree {
  constructor(items = {}, fanout = 12) {
    this.fanout = fanout;
    const entries = Object.entries(items).map(([id, item]) => ({ id, item, bounds: objectBounds(item, items) }));
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
