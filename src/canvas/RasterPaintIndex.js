import CanvasGridIndex from './grid/CanvasGridIndex.js';

// Index painted bounds (including shadows/rotation) in 1px-aligned coarse grid tiles.
// Keep painter order when repainting a small dirty region of a large scene.
export default class RasterPaintIndex {
  constructor() { this.grid = new CanvasGridIndex(1, 1); this.entries = new Map(); }
  remove(record) {
    const entry = this.entries.get(record);
    if (entry) { this.grid.remove(entry); this.entries.delete(record); }
  }
  update(record, order) {
    const bounds = record.paintedBounds;
    if (!bounds || record.hidden) { this.remove(record); return; }
    const previous = this.entries.get(record);
    if (previous && ['minX','minY','maxX','maxY'].every(key => previous[key] === bounds[key])) {
      previous.order = order; return;
    }
    this.remove(record);
    const entry = { ...bounds, record, order };
    this.entries.set(record, entry); this.grid.insert(entry);
  }
  query(bounds, ordered) {
    if (!this.entries.size) return [];
    const root = this.grid.getRootBounds();
    if (bounds.minX <= root.minX && bounds.minY <= root.minY && bounds.maxX >= root.maxX && bounds.maxY >= root.maxY) return ordered;
    const hits = this.grid.search(bounds);
    if (hits.length > ordered.length / 2) return ordered;
    return hits.sort((a,b) => a.order-b.order).map(entry => entry.record);
  }
}
