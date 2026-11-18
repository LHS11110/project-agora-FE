const FINE_SHIFT = 7; // 128 x 128 1px grid units per tile
const MACRO_SHIFT = 3; // 8 x 8 fine tiles per 1024 x 1024 macro page
const MAX_SPAN_TILES = 48;
const COORD_BIAS = 1048576; // 2^20
const COORD_STRIDE = 2097152; // 2^21 (max key < 2^42 << MAX_SAFE_INTEGER)

function packCoord(x, y) {
  return (x + COORD_BIAS) * COORD_STRIDE + (y + COORD_BIAS);
}

/**
 * Hierarchical 2-level 1px-grid spatial index (1024px macro bitset + 128px fine buckets).
 * Uses integer-packed coordinates and monotonic stamp arrays to eliminate per-query Set/string allocations.
 */
export default class CanvasGridIndex {
  constructor(worldWidth = 1600, worldHeight = 1000) {
    this.worldWidth = Math.max(1, Number(worldWidth) || 1);
    this.worldHeight = Math.max(1, Number(worldHeight) || 1);
    this.tiles = new Map();
    this.macroPages = new Map();
    this.oversize = new Set();
    this.records = new Map(); // entry -> meta
    this.freeSlots = [];
    this.nextSlot = 0;
    this.stamps = new Uint32Array(256);
    this.stamp = 0;
    this.revision = 0;
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
    this.minMx = Infinity;
    this.minMy = Infinity;
    this.maxMx = -Infinity;
    this.maxMy = -Infinity;
    this.boundsDirty = false;
    this.lastQuery = null;
  }

  setWorldSize(worldWidth, worldHeight) {
    const w = Math.max(1, Number(worldWidth) || 1);
    const h = Math.max(1, Number(worldHeight) || 1);
    if (w === this.worldWidth && h === this.worldHeight) return;
    const entries = [...this.records.keys()];
    this.clear();
    this.worldWidth = w;
    this.worldHeight = h;
    if (entries.length) this.load(entries);
  }

  clear() {
    this.tiles.clear();
    this.macroPages.clear();
    this.oversize.clear();
    this.records.clear();
    this.freeSlots.length = 0;
    this.nextSlot = 0;
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
    this.minMx = Infinity;
    this.minMy = Infinity;
    this.maxMx = -Infinity;
    this.maxMy = -Infinity;
    this.boundsDirty = false;
    this.lastQuery = null;
    this.revision++;
  }

  _allocSlot() {
    const slot = this.freeSlots.length ? this.freeSlots.pop() : this.nextSlot++;
    if (slot >= this.stamps.length) {
      const next = new Uint32Array(Math.max(slot + 1, this.stamps.length * 2));
      next.set(this.stamps);
      this.stamps = next;
    }
    return slot;
  }

  _spanForBounds(bounds) {
    const minPxX = Number(bounds.minX) * this.worldWidth;
    const minPxY = Number(bounds.minY) * this.worldHeight;
    const maxPxX = Number(bounds.maxX) * this.worldWidth;
    const maxPxY = Number(bounds.maxY) * this.worldHeight;
    if (!Number.isFinite(minPxX) || !Number.isFinite(minPxY) || !Number.isFinite(maxPxX) || !Number.isFinite(maxPxY)) {
      return null;
    }
    const gx0 = Math.floor(minPxX) >> FINE_SHIFT;
    const gy0 = Math.floor(minPxY) >> FINE_SHIFT;
    const gx1 = Math.floor(maxPxX) >> FINE_SHIFT;
    const gy1 = Math.floor(maxPxY) >> FINE_SHIFT;
    return { gx0, gy0, gx1, gy1 };
  }

  _setMacroBit(gx, gy) {
    const mx = gx >> MACRO_SHIFT;
    const my = gy >> MACRO_SHIFT;
    const mKey = packCoord(mx, my);
    let page = this.macroPages.get(mKey);
    if (!page) {
      page = { lo: 0, hi: 0, count: 0 };
      this.macroPages.set(mKey, page);
      if (mx < this.minMx) this.minMx = mx;
      if (mx > this.maxMx) this.maxMx = mx;
      if (my < this.minMy) this.minMy = my;
      if (my > this.maxMy) this.maxMy = my;
    }
    const bit = ((gy & 7) << 3) | (gx & 7);
    if (bit < 32) page.lo |= 1 << bit;
    else page.hi |= 1 << (bit - 32);
    page.count++;
  }

  _clearMacroBit(gx, gy) {
    const mx = gx >> MACRO_SHIFT;
    const my = gy >> MACRO_SHIFT;
    const mKey = packCoord(mx, my);
    const page = this.macroPages.get(mKey);
    if (!page) return;
    const bit = ((gy & 7) << 3) | (gx & 7);
    if (bit < 32) page.lo &= ~(1 << bit);
    else page.hi &= ~(1 << (bit - 32));
    page.count--;
    if (page.count <= 0) {
      this.macroPages.delete(mKey);
      if (this.macroPages.size === 0) {
        this.minMx = Infinity;
        this.minMy = Infinity;
        this.maxMx = -Infinity;
        this.maxMy = -Infinity;
      }
    }
  }

  insert(entry) {
    if (!entry) return;
    if (this.records.has(entry)) this.remove(entry);
    const span = this._spanForBounds(entry);
    if (!span) return;
    const slot = this._allocSlot();
    const { gx0, gy0, gx1, gy1 } = span;
    const spanW = gx1 - gx0 + 1;
    const spanH = gy1 - gy0 + 1;
    const inRange = gx0 >= -COORD_BIAS && gx1 < COORD_BIAS && gy0 >= -COORD_BIAS && gy1 < COORD_BIAS;
    const isOversize = !inRange || spanW * spanH > MAX_SPAN_TILES;

    const meta = { entry, slot, gx0, gy0, gx1, gy1, isOversize };
    this.records.set(entry, meta);
    if (entry.minX < this.minX) this.minX = entry.minX;
    if (entry.minY < this.minY) this.minY = entry.minY;
    if (entry.maxX > this.maxX) this.maxX = entry.maxX;
    if (entry.maxY > this.maxY) this.maxY = entry.maxY;

    if (isOversize) {
      this.oversize.add(meta);
    } else {
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const tKey = packCoord(gx, gy);
          let bucket = this.tiles.get(tKey);
          if (!bucket) {
            bucket = [];
            this.tiles.set(tKey, bucket);
            this._setMacroBit(gx, gy);
          }
          bucket.push(meta);
        }
      }
    }
    this.lastQuery = null;
    this.revision++;
  }

  load(entries) {
    if (!entries?.length) return;
    for (let i = 0; i < entries.length; i++) {
      this.insert(entries[i]);
    }
  }

  remove(entry) {
    const meta = this.records.get(entry);
    if (!meta) return;
    this.records.delete(entry);
    this.freeSlots.push(meta.slot);
    if (meta.isOversize) {
      this.oversize.delete(meta);
    } else {
      for (let gy = meta.gy0; gy <= meta.gy1; gy++) {
        for (let gx = meta.gx0; gx <= meta.gx1; gx++) {
          const tKey = packCoord(gx, gy);
          const bucket = this.tiles.get(tKey);
          if (!bucket) continue;
          const idx = bucket.indexOf(meta);
          if (idx >= 0) {
            const last = bucket.pop();
            if (idx < bucket.length) bucket[idx] = last;
            if (!bucket.length) {
              this.tiles.delete(tKey);
              this._clearMacroBit(gx, gy);
            }
          }
        }
      }
    }
    if (
      entry.minX <= this.minX ||
      entry.minY <= this.minY ||
      entry.maxX >= this.maxX ||
      entry.maxY >= this.maxY
    ) {
      this.boundsDirty = true;
    }
    this.lastQuery = null;
    this.revision++;
  }

  getRootBounds() {
    if (this.boundsDirty) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const entry of this.records.keys()) {
        if (entry.minX < minX) minX = entry.minX;
        if (entry.minY < minY) minY = entry.minY;
        if (entry.maxX > maxX) maxX = entry.maxX;
        if (entry.maxY > maxY) maxY = entry.maxY;
      }
      this.minX = minX;
      this.minY = minY;
      this.maxX = maxX;
      this.maxY = maxY;
      this.boundsDirty = false;
    }
    return { minX: this.minX, minY: this.minY, maxX: this.maxX, maxY: this.maxY };
  }

  _scanMacroPage(page, mx, my, gx0, gy0, gx1, gy1, bMinX, bMinY, bMaxX, bMaxY, stamp, out) {
    const baseGx = mx << MACRO_SHIFT;
    const baseGy = my << MACRO_SHIFT;
    const lxStart = Math.max(0, gx0 - baseGx);
    const lxEnd = Math.min(7, gx1 - baseGx);
    const lyStart = Math.max(0, gy0 - baseGy);
    const lyEnd = Math.min(7, gy1 - baseGy);
    const stamps = this.stamps;
    for (let ly = lyStart; ly <= lyEnd; ly++) {
      const word = ly < 4 ? page.lo : page.hi;
      const rowShift = (ly & 3) << 3;
      if (((word >>> rowShift) & 0xff) === 0) continue;
      for (let lx = lxStart; lx <= lxEnd; lx++) {
        if (((word >>> (rowShift + lx)) & 1) === 0) continue;
        const bucket = this.tiles.get(packCoord(baseGx + lx, baseGy + ly));
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k++) {
          const meta = bucket[k];
          if (stamps[meta.slot] === stamp) continue;
          const e = meta.entry;
          if (e.maxX >= bMinX && e.minX <= bMaxX && e.maxY >= bMinY && e.minY <= bMaxY) {
            stamps[meta.slot] = stamp;
            out.push(e);
          }
        }
      }
    }
  }

  search(bounds) {
    if (!bounds || !this.records.size) return [];
    const bMinX = Number(bounds.minX);
    const bMinY = Number(bounds.minY);
    const bMaxX = Number(bounds.maxX);
    const bMaxY = Number(bounds.maxY);
    if (!Number.isFinite(bMinX) || !Number.isFinite(bMinY) || !Number.isFinite(bMaxX) || !Number.isFinite(bMaxY)) {
      return [];
    }
    if (bMaxX < bMinX || bMaxY < bMinY) return [];

    const cached = this.lastQuery;
    if (
      cached &&
      cached.revision === this.revision &&
      cached.minX === bMinX &&
      cached.minY === bMinY &&
      cached.maxX === bMaxX &&
      cached.maxY === bMaxY
    ) {
      return cached.result;
    }

    let stamp = ++this.stamp;
    if (stamp >= 0xffffffff) {
      this.stamps.fill(0);
      this.stamp = 1;
      stamp = 1;
    }

    const out = [];
    const stamps = this.stamps;

    // 1. Check oversize entries directly
    if (this.oversize.size) {
      for (const meta of this.oversize) {
        const e = meta.entry;
        if (e.maxX >= bMinX && e.minX <= bMaxX && e.maxY >= bMinY && e.minY <= bMaxY) {
          stamps[meta.slot] = stamp;
          out.push(e);
        }
      }
    }

    // 2. Clamp tile span to occupied macro-pages so empty zoom-out space costs O(1)
    if (this.macroPages.size) {
      const span = this._spanForBounds(bounds);
      if (span) {
        const gx0 = Math.max(span.gx0, this.minMx << MACRO_SHIFT);
        const gx1 = Math.min(span.gx1, ((this.maxMx + 1) << MACRO_SHIFT) - 1);
        const gy0 = Math.max(span.gy0, this.minMy << MACRO_SHIFT);
        const gy1 = Math.min(span.gy1, ((this.maxMy + 1) << MACRO_SHIFT) - 1);

        if (gx0 <= gx1 && gy0 <= gy1) {
          const mx0 = gx0 >> MACRO_SHIFT;
          const mx1 = gx1 >> MACRO_SHIFT;
          const my0 = gy0 >> MACRO_SHIFT;
          const my1 = gy1 >> MACRO_SHIFT;

          // If the query covers far more macro cells than occupied pages, iterate occupied macroPages directly.
          const macroArea = (mx1 - mx0 + 1) * (my1 - my0 + 1);
          if (macroArea > this.macroPages.size * 2) {
            for (const [mKey, page] of this.macroPages) {
              const mx = Math.floor(mKey / COORD_STRIDE) - COORD_BIAS;
              const my = mKey - (mx + COORD_BIAS) * COORD_STRIDE - COORD_BIAS;
              if (mx < mx0 || mx > mx1 || my < my0 || my > my1) continue;
              this._scanMacroPage(page, mx, my, gx0, gy0, gx1, gy1, bMinX, bMinY, bMaxX, bMaxY, stamp, out);
            }
          } else {
            for (let my = my0; my <= my1; my++) {
              for (let mx = mx0; mx <= mx1; mx++) {
                const page = this.macroPages.get(packCoord(mx, my));
                if (!page) continue;
                this._scanMacroPage(page, mx, my, gx0, gy0, gx1, gy1, bMinX, bMinY, bMaxX, bMaxY, stamp, out);
              }
            }
          }
        }
      }
    }

    this.lastQuery = {
      revision: this.revision,
      minX: bMinX,
      minY: bMinY,
      maxX: bMaxX,
      maxY: bMaxY,
      result: out,
    };
    return out;
  }
}
