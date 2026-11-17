import RBush from 'rbush';

// Index painted bounds (including shadows/rotation), not just object geometry.
// Keep painter order when repainting a small dirty region of a large scene.
export default class RasterPaintIndex {
  constructor() { this.tree = new RBush(); this.entries = new Map(); }
  remove(record) {
    const entry = this.entries.get(record);
    if (entry) { this.tree.remove(entry); this.entries.delete(record); }
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
    this.entries.set(record, entry); this.tree.insert(entry);
  }
  query(bounds, ordered) {
    // Dense/full views are already in painter order; avoid sorting the scene.
    const root = this.tree.data;
    if (bounds.minX <= root.minX && bounds.minY <= root.minY && bounds.maxX >= root.maxX && bounds.maxY >= root.maxY) return ordered;
    const hits = this.tree.search(bounds);
    if (hits.length > ordered.length / 2) return ordered;
    return hits.sort((a,b) => a.order-b.order).map(entry => entry.record);
  }
}
